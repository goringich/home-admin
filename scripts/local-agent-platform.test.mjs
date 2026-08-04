import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLocalAgentPlatform } from "./local-agent-platform.mjs";

const now = new Date("2026-07-16T15:00:00Z");
const valid = {
  schema_version: "2026-07-16.atlas-local-agent-platform.v1",
  authority: "codex-orchestrator ledger",
  source: ["ledger", "reports"],
  generated_at: "2026-07-16T14:58:00Z",
  observed_at: "2026-07-16T14:57:00Z",
  expires_at: "2026-07-16T15:13:00Z",
  freshness_state: "fresh",
  verification_status: "verified",
  queue_health: { queue_depth: 1, counts: { queued: 1 }, active_leases: 1, dead_letter_depth: 0 },
  latest_run: { task_id: "task-0", state: "verified", trace_id: "trace-0" },
  gateway_health: { gateway: "ok", backend: "ok", loopback_only: true },
  running_tasks: [{ task_id: "task-1", state: "verifying" }],
  task_lifecycle: { task_id: "task-1", state: "verifying", trace_id: "trace-1" },
  sandbox_status: { status: "clean", main_worktree_modified: false },
  verification_results: { status: "verified" },
  benchmark_trends: [],
  agent_success_rate: 0.5,
  stale_evidence: [],
  blocked_promotions: ["mini_swe_model_protocol_acceptance"],
  role_champions: {},
  challengers: {},
  analysis_pack: { freshness_state: "fresh" },
};

test("accepts a complete fresh read-only projection", () => {
  const projection = normalizeLocalAgentPlatform(valid, now);
  assert.equal(projection.status, "available");
  assert.equal(projection.queueHealth.queue_depth, 1);
  assert.equal(projection.queueHealth.counts.queued, 1);
  assert.equal(projection.authority, "codex-orchestrator ledger");
  assert.equal(projection.runningTasks[0].state, "verifying");
  assert.equal(projection.agentSuccessRate, 0.5);
});

test("marks expired evidence stale instead of current", () => {
  const projection = normalizeLocalAgentPlatform({ ...valid, expires_at: "2026-07-16T14:59:00Z" }, now);
  assert.equal(projection.status, "stale");
  assert.equal(projection.freshnessState, "stale");
});

test("rejects malformed or partially verified metadata", () => {
  const projection = normalizeLocalAgentPlatform({ schema_version: valid.schema_version }, now);
  assert.equal(projection.status, "malformed");
  assert.equal(projection.verificationStatus, "rejected");
  assert.ok(projection.missingFields.includes("authority"));
});

test("rejects invalid nested task records instead of exposing crashable values", () => {
  const projection = normalizeLocalAgentPlatform({ ...valid, running_tasks: [null] }, now);
  assert.equal(projection.status, "malformed");
  assert.equal(projection.verificationStatus, "rejected");
  assert.ok(projection.missingFields.includes("running_tasks"));
  assert.deepEqual(projection.runningTasks, []);
});

test("normalizes task fields to bounded strings", () => {
  const projection = normalizeLocalAgentPlatform({
    ...valid,
    running_tasks: [{ task_id: { nested: "value" }, state: "running", trace_id: 42 }],
  }, now);
  assert.equal(projection.status, "available");
  assert.equal(projection.runningTasks[0].task_id, "");
  assert.equal(projection.runningTasks[0].trace_id, "");
});
