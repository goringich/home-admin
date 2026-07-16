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
  queue_health: { queued: 1 },
  running_tasks: [{ task_id: "task-1", state: "verifying" }],
  agent_success_rate: 0.5,
  blocked_promotions: ["mini_swe_model_protocol_acceptance"],
};

test("accepts a complete fresh read-only projection", () => {
  const projection = normalizeLocalAgentPlatform(valid, now);
  assert.equal(projection.status, "available");
  assert.equal(projection.queueHealth.queued, 1);
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
