import assert from "node:assert/strict";
import test from "node:test";
import { reconcileRecentRuns, sanitizeSharedRunReport } from "./codex-orchestrator-projection.mjs";

test("sanitizes a shared report without exposing raw task text", () => {
  const report = sanitizeSharedRunReport({
    run_id: "run-42",
    task_title: "safe title",
    task_text: "private prompt must never leave the runtime report",
    status: "failed",
    queue_task_path: "/runtime/failed/run-42.task.failed",
    artifact_dir: "/artifacts/20260715-run-42",
    verification_results: [
      { status: "failed", command: "private shell command" },
      { status: "passed", summary: "ok" },
    ],
  }, { reportPath: "/reports/run-42.json", modifiedAt: "2026-07-15T00:00:00Z" });

  assert.equal(report.runId, "run-42");
  assert.equal(report.queueTaskId, "run-42");
  assert.equal(report.taskText, "");
  assert.deepEqual(report.verificationCommands, []);
  assert.equal(report.failedVerificationCount, 1);
  assert.deepEqual(report.failureReasons, ["failed"]);
});

test("reconciles an artifact directory to the shared canonical run id", () => {
  const reports = [sanitizeSharedRunReport({
    run_id: "run-42",
    status: "failed",
    queue_task_path: "/runtime/failed/run-42.task.failed",
    artifact_dir: "/artifacts/20260715-run-42",
  })];
  const recent = reconcileRecentRuns([
    {
      artifactId: "20260715-run-42",
      artifactDir: "/artifacts/20260715-run-42",
      title: "safe artifact title",
      exitCode: 1,
      updatedAt: "2026-07-15T00:00:00Z",
    },
  ], reports);

  assert.equal(recent[0].id, "run-42");
  assert.equal(recent[0].taskId, "run-42");
  assert.equal(recent[0].reconciliation, "matched_shared_report");
  assert.equal(recent[0].failureStatus, "failed");
});

test("keeps unmatched artifacts visible instead of inventing a report match", () => {
  const recent = reconcileRecentRuns([
    {
      artifactId: "artifact-only",
      artifactDir: "/artifacts/artifact-only",
      title: "artifact only",
      exitCode: 0,
      updatedAt: "2026-07-15T00:00:00Z",
    },
  ], []);

  assert.equal(recent[0].id, "artifact-only");
  assert.equal(recent[0].reconciliation, "unmatched_artifact");
  assert.equal(recent[0].taskId, "");
});
