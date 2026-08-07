import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const builder = fs.readFileSync(path.join(root, "scripts", "build-architecture-universe.mjs"), "utf8");
const enricher = fs.readFileSync(path.join(root, "scripts", "enrich-architecture-universe.mjs"), "utf8");
const runtimeEnricher = fs.readFileSync(path.join(root, "scripts", "enrich-architecture-runtime-snapshot.mjs"), "utf8");
const liveOverlay = fs.readFileSync(path.join(root, "scripts", "apply-architecture-live-census.mjs"), "utf8");
const component = fs.readFileSync(path.join(root, "src", "ArchitectureWorkspace.tsx"), "utf8");
const main = fs.readFileSync(path.join(root, "src", "main.tsx"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

test("architecture universe composes every canonical census class", () => {
  for (const required of [
    "architecture-observatory-v1.json",
    "technology-census.json",
    "satellite-systems-census.json",
    "owner-repository-census-v1.json",
    "product-registry.json",
    "snapshot.json",
  ]) assert.match(builder, new RegExp(required.replaceAll(".", "\\.")));
  for (const required of [
    "architecture-manifest.json",
    "admin-surface-registry.json",
    "project-tails-registry.json",
  ]) assert.match(enricher, new RegExp(required.replaceAll(".", "\\.")));
  assert.match(builder, /total_nodes/);
  assert.match(builder, /live_gap_nodes/);
  assert.match(builder, /source_live_separation/);
  assert.match(enricher, /architecture_manifest_components/);
  assert.match(enricher, /administration_surfaces/);
  assert.match(enricher, /explicit_inventory_gaps/);
});

test("runtime snapshot expands hosts services models agents skills and routing", () => {
  for (const required of ["hostPlacement", "localAiControl", "localCodexLab", "aiTelemetry"]) {
    assert.match(runtimeEnricher, new RegExp(required));
  }
  for (const required of ["host_nodes", "service_nodes", "model_nodes", "agent_nodes", "skill_nodes"]) {
    assert.match(runtimeEnricher, new RegExp(required));
  }
  assert.match(runtimeEnricher, /agentRouting/);
  assert.match(runtimeEnricher, /roleMap/);
  assert.match(runtimeEnricher, /skillRegistry/);
});

test("architecture composition has no external network or shell execution", () => {
  for (const source of [builder, enricher, runtimeEnricher, liveOverlay]) {
    assert.doesNotMatch(source, /fetch\s*\(/);
    assert.doesNotMatch(source, /https?:\/\//);
    assert.doesNotMatch(source, /exec(File|Sync|\s*\()/);
    assert.doesNotMatch(source, /child_process/);
  }
});

test("fresh live overlay is bounded and stale-safe", () => {
  assert.match(liveOverlay, /LIVE_TTL_SECONDS = 900/);
  assert.match(liveOverlay, /architecture-live-census\.result\.v1/);
  assert.match(liveOverlay, /status: "stale"/);
  assert.match(liveOverlay, /repository_identity/);
  assert.doesNotMatch(liveOverlay, /readFileSync\([^\n]*\.env/);
});

test("Architecture is a native Atlas route with two graph views", () => {
  assert.match(main, /ArchitectureWorkspace/);
  assert.match(main, /#\/architecture/);
  assert.match(main, /createPortal/);
  assert.match(component, /System Universe/);
  assert.match(component, /Layer Map/);
  assert.match(component, /live-gaps/);
  assert.match(component, /Node inspector/);
});

test("normal Atlas build composes enriches runtime-expands and live-overlays", () => {
  assert.equal(
    packageJson.scripts.architecture,
    "node scripts/build-architecture-universe.mjs && node scripts/enrich-architecture-universe.mjs && node scripts/enrich-architecture-runtime-snapshot.mjs && node scripts/apply-architecture-live-census.mjs",
  );
  assert.match(packageJson.scripts.snapshot, /npm run architecture/);
  assert.match(packageJson.scripts.prebuild, /npm run architecture/);
});
