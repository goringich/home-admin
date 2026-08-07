import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_CANONICAL_REPO = path.join(os.homedir(), "__home_organized");
const DEFAULT_CANONICAL_RELATIVE = path.join(
  "local-codex-stack",
  "configs",
  "admin-surface-registry.json",
);
const DEFAULT_CANONICAL = path.join(DEFAULT_CANONICAL_REPO, DEFAULT_CANONICAL_RELATIVE);
const FALLBACK = path.join(ROOT, "data", "administration-adapter-overrides.json");
const OUTPUT = path.join(ROOT, "public", "administration-adapters.json");

const ALLOWED_MODES = new Set([
  "external",
  "embedded",
  "proxied",
  "native-projection",
  "local-source",
]);

const SECRET_KEY_PATTERN = /(password|passwd|token|cookie|init.?data|private.?key|secret.?value|command.?payload|vpn.?body)/i;

function readJson(target) {
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

function assertNoSecretKeys(value, location = "root") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretKeys(item, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      throw new Error(`${location}.${key}: secret-like key is forbidden`);
    }
    assertNoSecretKeys(nested, `${location}.${key}`);
  }
}

function cleanList(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function mapCanonicalSurface(surface) {
  const launch = surface?.launch && typeof surface.launch === "object" ? surface.launch : {};
  const embedding = surface?.embedding_capability && typeof surface.embedding_capability === "object"
    ? surface.embedding_capability
    : {};
  return {
    id: String(surface?.id || ""),
    title: String(surface?.title || "Unnamed administration surface"),
    classification: String(surface?.classification || "unknown"),
    ownerRepository: String(surface?.owner_repository || ""),
    sourceOfTruth: cleanList(surface?.source_of_truth_for).join("; "),
    integrationModes: cleanList(surface?.atlas_integration_modes),
    embedding: {
      default: String(embedding.default || "denied"),
      supported: embedding.supported === true,
      reason: String(embedding.reason || "No embedding contract is registered."),
    },
    authBoundary: String(surface?.auth_boundary || "unknown"),
    mutationOwner: String(surface?.mutation_owner || "unknown"),
    projectionAllowlist: cleanList(surface?.projection_allowlist),
    secretPolicy: String(surface?.secret_policy || "No secrets may be projected."),
    fallbackMode: String(surface?.fallback_mode || "external"),
    migrationState: String(surface?.migration_state || "unknown"),
    availability: String(surface?.availability || "registered"),
    launch: {
      label: String(launch.label || "Open"),
      target: String(launch.target || ""),
    },
    runbookTarget: String(surface?.runbook_target || ""),
  };
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object") throw new Error("manifest must be an object");
  if (!String(manifest.schemaVersion || "").includes("administration-adapters")) {
    throw new Error("invalid administration adapter schema version");
  }
  if (!Array.isArray(manifest.surfaces) || manifest.surfaces.length === 0) {
    throw new Error("administration adapter manifest must contain surfaces");
  }
  const seen = new Set();
  for (const surface of manifest.surfaces) {
    if (!surface.id || seen.has(surface.id)) throw new Error(`invalid or duplicate surface id: ${surface.id || "empty"}`);
    seen.add(surface.id);
    if (!surface.ownerRepository) throw new Error(`${surface.id}: ownerRepository is required`);
    if (!surface.mutationOwner) throw new Error(`${surface.id}: mutationOwner is required`);
    if (!surface.embedding || !["allowed", "denied"].includes(surface.embedding.default)) {
      throw new Error(`${surface.id}: invalid embedding contract`);
    }
    if (!Array.isArray(surface.integrationModes) || surface.integrationModes.length === 0) {
      throw new Error(`${surface.id}: integrationModes are required`);
    }
    for (const mode of surface.integrationModes) {
      if (!ALLOWED_MODES.has(mode)) throw new Error(`${surface.id}: unsupported integration mode ${mode}`);
    }
    if (surface.launch?.target?.includes("?")) {
      throw new Error(`${surface.id}: launch target must not contain signed or secret query parameters`);
    }
    if (surface.embedding.supported && !surface.integrationModes.includes("embedded") && surface.id !== "project-atlas") {
      throw new Error(`${surface.id}: embedding is supported but embedded mode is absent`);
    }
  }
  assertNoSecretKeys(manifest);
  return manifest;
}

function isCanonicalV2(registry) {
  return Boolean(registry && typeof registry === "object" && String(registry.schema_version || "").endsWith(".v2"));
}

function defaultGitShow(repoPath, gitRef, relativePath) {
  return execFileSync(
    "git",
    ["-C", repoPath, "show", `${gitRef}:${relativePath}`],
    {
      encoding: "utf8",
      env: {
        HOME: os.homedir(),
        LANG: "C.UTF-8",
        PATH: "/usr/local/bin:/usr/bin:/bin",
      },
      shell: false,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
    },
  );
}

function resolveCanonicalRegistry(options, canonicalPath) {
  let staleLocalSchema = "";

  if (fs.existsSync(canonicalPath)) {
    const localRegistry = readJson(canonicalPath);
    if (isCanonicalV2(localRegistry)) {
      return {
        registry: localRegistry,
        source: canonicalPath,
        sourceResolution: "working-tree",
        staleLocalSchema: "",
      };
    }
    staleLocalSchema = String(localRegistry?.schema_version || "missing");
  }

  const gitRecoveryEnabled = Object.prototype.hasOwnProperty.call(options, "canonicalRepoPath")
    || canonicalPath === DEFAULT_CANONICAL;
  if (!gitRecoveryEnabled) {
    return { registry: null, staleLocalSchema, staleGitSchema: "" };
  }

  const canonicalRepoPath = options.canonicalRepoPath
    || process.env.ATLAS_ADMIN_SURFACE_REPO
    || DEFAULT_CANONICAL_REPO;
  const canonicalGitRef = options.canonicalGitRef
    || process.env.ATLAS_ADMIN_SURFACE_GIT_REF
    || "origin/master";
  const canonicalRelativePath = options.canonicalRelativePath || DEFAULT_CANONICAL_RELATIVE;
  const gitShow = options.gitShow || defaultGitShow;

  if (!fs.existsSync(canonicalRepoPath) && !options.gitShow) {
    return { registry: null, staleLocalSchema, staleGitSchema: "" };
  }

  try {
    const registry = JSON.parse(gitShow(canonicalRepoPath, canonicalGitRef, canonicalRelativePath));
    if (isCanonicalV2(registry)) {
      return {
        registry,
        source: `git:${canonicalRepoPath}@${canonicalGitRef}:${canonicalRelativePath}`,
        sourceResolution: "git-ref",
        staleLocalSchema,
      };
    }
    return {
      registry: null,
      staleLocalSchema,
      staleGitSchema: String(registry?.schema_version || "missing"),
    };
  } catch {
    return { registry: null, staleLocalSchema, staleGitSchema: "unavailable" };
  }
}

export function buildAdministrationManifest(options = {}) {
  const canonicalPath = options.canonicalPath
    || process.env.ATLAS_ADMIN_SURFACE_REGISTRY
    || DEFAULT_CANONICAL;
  const fallbackPath = options.fallbackPath || FALLBACK;
  const outputPath = options.outputPath || OUTPUT;

  const canonical = resolveCanonicalRegistry(options, canonicalPath);
  let manifest;
  let source;

  if (canonical.registry) {
    const registry = canonical.registry;
    manifest = {
      schemaVersion: "2026-08-07.atlas-administration-adapters.v1",
      generatedAt: new Date().toISOString(),
      sourceRegistry: canonical.source,
      sourceSchemaVersion: String(registry.schema_version),
      sourceMode: "canonical",
      sourceResolution: canonical.sourceResolution,
      sourceWarning: canonical.staleLocalSchema
        ? `working tree registry is stale (${canonical.staleLocalSchema}); canonical git ref used`
        : "",
      surfaces: (registry.surfaces || []).map(mapCanonicalSurface),
    };
    source = canonical.source;
  } else {
    const fallback = readJson(fallbackPath);
    const warnings = [];
    if (canonical.staleLocalSchema) warnings.push(`working tree registry is stale (${canonical.staleLocalSchema})`);
    if (canonical.staleGitSchema) warnings.push(`canonical git registry unavailable or stale (${canonical.staleGitSchema})`);
    manifest = {
      ...fallback,
      generatedAt: new Date().toISOString(),
      sourceMode: "fallback",
      sourceResolution: "bundled-fallback",
      sourceWarning: warnings.join("; "),
    };
    source = fallbackPath;
  }

  validateManifest(manifest);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifest, outputPath, source };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildAdministrationManifest();
  console.log(`administration adapters: ${result.manifest.surfaces.length} surfaces from ${result.source}`);
}
