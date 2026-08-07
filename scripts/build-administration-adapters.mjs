import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_CANONICAL = path.join(
  os.homedir(),
  "__home_organized",
  "local-codex-stack",
  "configs",
  "admin-surface-registry.json",
);
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

export function buildAdministrationManifest(options = {}) {
  const canonicalPath = options.canonicalPath
    || process.env.ATLAS_ADMIN_SURFACE_REGISTRY
    || DEFAULT_CANONICAL;
  const fallbackPath = options.fallbackPath || FALLBACK;
  const outputPath = options.outputPath || OUTPUT;

  let manifest;
  let source;
  if (fs.existsSync(canonicalPath)) {
    const registry = readJson(canonicalPath);
    if (!String(registry.schema_version || "").endsWith(".v2")) {
      throw new Error(`canonical administration registry is stale: ${registry.schema_version || "missing"}`);
    }
    manifest = {
      schemaVersion: "2026-08-07.atlas-administration-adapters.v1",
      generatedAt: new Date().toISOString(),
      sourceRegistry: canonicalPath,
      sourceSchemaVersion: String(registry.schema_version),
      sourceMode: "canonical",
      surfaces: (registry.surfaces || []).map(mapCanonicalSurface),
    };
    source = canonicalPath;
  } else {
    const fallback = readJson(fallbackPath);
    manifest = {
      ...fallback,
      generatedAt: new Date().toISOString(),
      sourceMode: "fallback",
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
