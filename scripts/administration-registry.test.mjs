import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const registryPath = "/home/goringich/__home_organized/local-codex-stack/configs/admin-surface-registry.json";
const snapshotPath = path.join(process.cwd(), "public", "snapshot.json");

test("administration registry is represented in the Atlas snapshot without secret launch URLs", () => {
  execFileSync(process.execPath, ["scripts/build-snapshot.mjs"], { cwd: process.cwd(), stdio: "ignore" });
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));

  assert.equal(registry.status, "adopted");
  assert.equal(snapshot.administration.status, "registered");
  assert.equal(snapshot.administration.surfaces.length, registry.surfaces.length);
  assert.deepEqual(
    snapshot.administration.surfaces.map((surface) => surface.id),
    registry.surfaces.map((surface) => surface.id),
  );
  for (const surface of snapshot.administration.surfaces) {
    assert.equal(surface.launch.target.includes("?"), false);
  }
});
