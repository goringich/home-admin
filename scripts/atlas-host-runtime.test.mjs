import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { rebuildSnapshotWithColdStartRecovery } from "./atlas-host-preload.mjs";

const rootDir = fileURLToPath(new URL("..", import.meta.url));

test("always-on host preloads the projection refresh helper before legacy Atlas starts", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  assert.match(packageJson.scripts.host, /atlas-host-preload\.mjs/);
  assert.match(packageJson.scripts.host, /atlas-resilient-host\.mjs/);

  const probe = spawnSync(
    process.execPath,
    [
      "--import=./scripts/atlas-host-preload.mjs",
      "--input-type=module",
      "-e",
      "if (typeof rebuildSnapshotAfterProjectionRefresh !== 'function') process.exit(42)",
    ],
    {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10_000,
    },
  );

  assert.equal(probe.status, 0, probe.stderr || probe.stdout || "preload probe failed");
});

test("legacy host call site remains protected by the preload compatibility bridge", () => {
  const hostSource = fs.readFileSync(path.join(rootDir, "scripts", "atlas-host.mjs"), "utf8");
  const preloadSource = fs.readFileSync(path.join(rootDir, "scripts", "atlas-host-preload.mjs"), "utf8");

  assert.match(hostSource, /rebuildSnapshotAfterProjectionRefresh\s*\(/);
  assert.match(preloadSource, /globalThis\.rebuildSnapshotAfterProjectionRefresh\s*=/);
});

test("legacy host writes a recovery snapshot when the canonical cold-start build fails", () => {
  let snapshotPresent = false;
  let recoveryCalls = 0;

  const result = rebuildSnapshotWithColdStartRecovery({
    rebuildSnapshot: () => {
      throw new Error("canonical snapshot failed");
    },
    refreshProjection: () => ({ refreshed: false, status: "stale_preserved" }),
    snapshotExists: () => snapshotPresent,
    recoverSnapshot: () => {
      recoveryCalls += 1;
      snapshotPresent = true;
    },
  });

  assert.equal(recoveryCalls, 1);
  assert.equal(result.rebuilt, false);
  assert.equal(result.recovered, true);
  assert.equal(result.status, "recovery_snapshot_written");
});

test("legacy host preserves a stale snapshot without unnecessary recovery", () => {
  let recoveryCalls = 0;

  const result = rebuildSnapshotWithColdStartRecovery({
    rebuildSnapshot: () => {
      throw new Error("canonical snapshot failed");
    },
    refreshProjection: () => ({ refreshed: false, status: "stale_preserved" }),
    snapshotExists: () => true,
    recoverSnapshot: () => {
      recoveryCalls += 1;
    },
  });

  assert.equal(recoveryCalls, 0);
  assert.equal(result.rebuilt, false);
  assert.equal(result.status, "stale_snapshot_preserved");
});
