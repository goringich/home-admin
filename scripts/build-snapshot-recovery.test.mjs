import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const recoveryScript = path.join(rootDir, "scripts", "build-snapshot-recovery.mjs");

function runRecovery(builderSource, existingSnapshot = null) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-snapshot-recovery-"));
  const builderPath = path.join(tempDir, "builder.mjs");
  const outputPath = path.join(tempDir, "snapshot.json");
  const recoveryStatePath = path.join(tempDir, "recovery.json");
  fs.writeFileSync(builderPath, builderSource, "utf8");
  if (existingSnapshot) fs.writeFileSync(outputPath, `${JSON.stringify(existingSnapshot)}\n`, "utf8");
  const result = spawnSync(process.execPath, [recoveryScript], {
    cwd: rootDir,
    env: {
      ...process.env,
      ATLAS_SNAPSHOT_BUILDER: builderPath,
      ATLAS_SNAPSHOT_OUTPUT: outputPath,
      ATLAS_SNAPSHOT_RECOVERY_STATE: recoveryStatePath,
    },
    encoding: "utf8",
  });
  return {
    tempDir,
    result,
    outputPath,
    recoveryStatePath,
    output: fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, "utf8")) : null,
    state: fs.existsSync(recoveryStatePath) ? JSON.parse(fs.readFileSync(recoveryStatePath, "utf8")) : null,
  };
}

test("writes a structurally safe fallback when canonical snapshot generation fails cold", () => {
  const run = runRecovery('console.error("synthetic snapshot failure"); process.exit(17);\n');
  assert.equal(run.result.status, 0);
  assert.equal(run.state.status, "fallback_written");
  assert.equal(run.output.recovery.status, "fallback");
  assert.equal(run.output.system.safeMode, true);
  assert.equal(run.output.system.overall, "unavailable");
  assert.deepEqual(run.output.projects, []);
  assert.deepEqual(run.output.tasks, []);
  assert.deepEqual(run.output.localCodexLab.goalCapsules, []);
  assert.deepEqual(run.output.localCodexLab.runSummaries, []);
  assert.deepEqual(run.output.localAiControl.runtimes, []);
  assert.equal(run.output.localAgentPlatform.readOnly, true);
  assert.equal(run.output.commercialReadiness.revenueAutopilot.status, "unavailable");
  assert.equal(run.output.administration.status, "unavailable");
});

test("preserves the last parseable snapshot when a refresh fails", () => {
  const previous = { generatedAt: "2026-08-07T00:00:00Z", marker: "keep-me" };
  const run = runRecovery('console.error("synthetic refresh failure"); process.exit(9);\n', previous);
  assert.equal(run.result.status, 0);
  assert.equal(run.state.status, "preserved_previous");
  assert.equal(run.output.marker, "keep-me");
});

test("keeps canonical output when the canonical builder succeeds", () => {
  const builder = `import fs from "node:fs";\nfs.writeFileSync(process.env.ATLAS_SNAPSHOT_OUTPUT, JSON.stringify({ generatedAt: "canonical", marker: "canonical" }) + "\\n");\n`;
  const run = runRecovery(builder);
  assert.equal(run.result.status, 0);
  assert.equal(run.state.status, "canonical");
  assert.equal(run.output.marker, "canonical");
});
