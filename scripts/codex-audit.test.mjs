import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCodexAudit } from "./codex-audit.mjs";

test("current synced audit is healthy and keeps Git evidence", () => {
  const now = Date.parse("2026-07-26T12:00:00Z");
  const audit = normalizeCodexAudit({
    generated_at: "2026-07-26T11:30:00Z",
    freshness: { generated_at: "2026-07-26T11:30:00Z", max_age_hours: 2 },
    sync: { status: "synced" },
    task_count: 1,
    status_counts: { verified: 1 },
    tasks: [{ task_id: "root-task", status: "verified", repository: "home-admin", head_sha: "abc", failed_checks: [] }],
  }, { status: "ok", counts: {}, jobs: [] }, now);
  assert.equal(audit.sourceStatus, "healthy");
  assert.equal(audit.tasks[0].headSha, "abc");
});

test("stale, unsynced, degraded and missing sources fail soft", () => {
  const now = Date.parse("2026-07-26T12:00:00Z");
  assert.equal(normalizeCodexAudit(null, null, now).sourceStatus, "unavailable");
  const stale = normalizeCodexAudit({
    generated_at: "2026-07-24T10:00:00Z",
    freshness: { generated_at: "2026-07-24T10:00:00Z", max_age_hours: 24 },
    sync: { status: "unsynced" },
  }, { status: "degraded", counts: { degraded: 1 }, jobs: [] }, now);
  assert.equal(stale.sourceStatus, "stale");
  assert.equal(stale.syncStatus, "unsynced");
});
