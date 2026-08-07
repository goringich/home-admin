import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildAdministrationManifest } from "./build-administration-adapters.mjs";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "atlas-admin-adapters-"));
}

function canonicalRegistry(schemaVersion = "2026-08-07.admin-surface-registry.v2") {
  return {
    schema_version: schemaVersion,
    surfaces: [{
      id: "example",
      title: "Example",
      classification: "system",
      owner_repository: "goringich/example",
      source_of_truth_for: ["example state"],
      atlas_integration_modes: ["external", "native-projection"],
      embedding_capability: { default: "denied", supported: false, reason: "not enabled" },
      auth_boundary: "project auth",
      mutation_owner: "goringich/example",
      projection_allowlist: ["health"],
      secret_policy: "none",
      fallback_mode: "external",
      migration_state: "canonical",
      launch: { label: "Open", target: "https://example.invalid/app/" },
    }],
  };
}

test("fallback manifest covers canonical, product and excluded adapter modes", () => {
  const root = tempDir();
  const outputPath = path.join(root, "administration-adapters.json");
  const result = buildAdministrationManifest({
    canonicalPath: path.join(root, "missing-registry.json"),
    fallbackPath: path.resolve("data/administration-adapter-overrides.json"),
    outputPath,
  });
  const byId = new Map(result.manifest.surfaces.map((surface) => [surface.id, surface]));
  assert.equal(result.manifest.sourceMode, "fallback");
  assert.equal(result.manifest.sourceResolution, "bundled-fallback");
  assert.equal(byId.get("telegram-proxy-stack-admin")?.ownerRepository, "goringich/telegram-proxy-stack");
  assert.equal(byId.get("telegram-proxy-stack-admin")?.embedding.default, "denied");
  assert.equal(byId.get("elizabet-admin")?.classification, "product");
  assert.equal(byId.get("otlichniy-ulov-admin")?.migrationState, "excluded");
  assert.equal(fs.existsSync(outputPath), true);
});

test("canonical v2 registry is normalized without query parameters", () => {
  const root = tempDir();
  const canonicalPath = path.join(root, "registry.json");
  const outputPath = path.join(root, "manifest.json");
  fs.writeFileSync(canonicalPath, JSON.stringify(canonicalRegistry()), "utf8");
  const result = buildAdministrationManifest({ canonicalPath, outputPath });
  assert.equal(result.manifest.sourceMode, "canonical");
  assert.equal(result.manifest.sourceResolution, "working-tree");
  assert.equal(result.manifest.surfaces[0].sourceOfTruth, "example state");
  assert.equal(result.manifest.surfaces[0].launch.target.includes("?"), false);
});

test("stale local registry resolves canonical v2 from the configured git ref without mutating the checkout", () => {
  const root = tempDir();
  const canonicalPath = path.join(root, "registry.json");
  const outputPath = path.join(root, "manifest.json");
  fs.writeFileSync(canonicalPath, JSON.stringify(canonicalRegistry("2026-07-16.admin-surface-registry.v1")), "utf8");

  let invocation = null;
  const result = buildAdministrationManifest({
    canonicalPath,
    canonicalRepoPath: root,
    canonicalGitRef: "origin/master",
    canonicalRelativePath: "local-codex-stack/configs/admin-surface-registry.json",
    outputPath,
    gitShow(repoPath, gitRef, relativePath) {
      invocation = { repoPath, gitRef, relativePath };
      return JSON.stringify(canonicalRegistry());
    },
  });

  assert.deepEqual(invocation, {
    repoPath: root,
    gitRef: "origin/master",
    relativePath: "local-codex-stack/configs/admin-surface-registry.json",
  });
  assert.equal(result.manifest.sourceMode, "canonical");
  assert.equal(result.manifest.sourceResolution, "git-ref");
  assert.equal(result.manifest.sourceSchemaVersion, "2026-08-07.admin-surface-registry.v2");
  assert.match(result.manifest.sourceWarning, /2026-07-16\.admin-surface-registry\.v1/);
  assert.match(result.manifest.sourceRegistry, /^git:/);
});

test("stale local and unavailable git registry fail soft to the sanitized bundled manifest", () => {
  const root = tempDir();
  const canonicalPath = path.join(root, "registry.json");
  const outputPath = path.join(root, "manifest.json");
  fs.writeFileSync(canonicalPath, JSON.stringify(canonicalRegistry("2026-07-16.admin-surface-registry.v1")), "utf8");

  const result = buildAdministrationManifest({
    canonicalPath,
    canonicalRepoPath: root,
    fallbackPath: path.resolve("data/administration-adapter-overrides.json"),
    outputPath,
    gitShow() {
      throw new Error("git ref unavailable");
    },
  });

  assert.equal(result.manifest.sourceMode, "fallback");
  assert.equal(result.manifest.sourceResolution, "bundled-fallback");
  assert.match(result.manifest.sourceWarning, /working tree registry is stale/);
  assert.match(result.manifest.sourceWarning, /canonical git registry unavailable/);
});

test("secret-like keys and signed launch targets fail closed", () => {
  const root = tempDir();
  const fallbackPath = path.join(root, "bad.json");
  fs.writeFileSync(fallbackPath, JSON.stringify({
    schemaVersion: "2026-08-07.atlas-administration-adapters.v1",
    surfaces: [{
      id: "bad",
      title: "Bad",
      classification: "system",
      ownerRepository: "goringich/bad",
      sourceOfTruth: "bad",
      integrationModes: ["external"],
      embedding: { default: "denied", supported: false, reason: "bad" },
      authBoundary: "bad",
      mutationOwner: "goringich/bad",
      projectionAllowlist: [],
      secretPolicy: "bad",
      fallbackMode: "external",
      migrationState: "bad",
      launch: { label: "Open", target: "https://example.invalid/?token=secret" },
      password: "forbidden",
    }],
  }), "utf8");
  assert.throws(() => buildAdministrationManifest({
    canonicalPath: path.join(root, "missing.json"),
    fallbackPath,
    outputPath: path.join(root, "out.json"),
  }));
});
