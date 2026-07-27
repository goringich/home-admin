import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCAL_CODEX_LAB_SCHEMA,
  localCodexLabCompatible,
  normalizeAtlasServiceStatus,
  selectLocalCodexLabRecord,
} from "./snapshot-source-selection.mjs";

const now = new Date("2026-07-25T20:00:00Z");

function compatiblePayload(overrides = {}) {
  return {
    schema_version: LOCAL_CODEX_LAB_SCHEMA,
    safe_to_expose: true,
    generated_at: "2026-07-25T19:00:00Z",
    host_health: "attention",
    fast_model: "local-fast",
    balanced_model: "local-coding",
    ai_lab: { status: "ready" },
    agent_routing: { routes: [] },
    ...overrides,
  };
}

const partialCanonical = {
  path: "/runtime/local-codex-lab.json",
  payload: compatiblePayload({
    generated_at: "2026-07-25T19:30:00Z",
    goal_capsules: [{ goal_id: "goal-1" }],
  }),
};

const richerLegacy = {
  path: "/tracked/local-codex-lab.json",
  payload: compatiblePayload({
    generated_at: "2026-07-25T18:30:00Z",
    ai_lab: { status: "ready", control: {} },
    latest_hermes: { status: "pilot_ready" },
    model_evolution: { status: "ok" },
    local_gpu_live_bench_status: { status: "ok" },
    active_runs: [{ run_id: "run-1" }],
    latest_run_reports: [{ run_id: "run-1" }],
  }),
};

test("a partial canonical artifact cannot mask a richer compatible source", () => {
  const selected = selectLocalCodexLabRecord([partialCanonical, richerLegacy], now);

  assert.equal(selected.path, richerLegacy.path);
  assert.equal(selected.payload.ai_lab.status, "ready");
  assert.ok(selected.qualityScore > 0);
});

test("equal-quality candidates resolve deterministically by freshness then input priority", () => {
  const older = {
    path: "/runtime/older.json",
    payload: { ...richerLegacy.payload, generated_at: "2026-07-25T18:00:00Z" },
  };
  const newer = {
    path: "/tracked/newer.json",
    payload: { ...richerLegacy.payload, generated_at: "2026-07-25T19:00:00Z" },
  };

  assert.equal(selectLocalCodexLabRecord([older, newer], now).path, newer.path);
  assert.equal(selectLocalCodexLabRecord([newer, { ...newer, path: "/tracked/equal.json" }], now).path, newer.path);
});

test("rejects incompatible, unsafe, and expired artifacts", () => {
  const incompatible = compatiblePayload({ schema_version: "legacy" });
  const unsafe = compatiblePayload({ safe_to_expose: false });
  const expired = compatiblePayload({ generated_at: "2026-07-20T19:00:00Z" });

  assert.equal(localCodexLabCompatible(incompatible), false);
  assert.equal(localCodexLabCompatible(unsafe), false);
  assert.equal(selectLocalCodexLabRecord([
    { path: "/incompatible.json", payload: incompatible },
    { path: "/unsafe.json", payload: unsafe },
    { path: "/expired.json", payload: expired },
  ], now).path, "");
});

test("an old rich artifact cannot outrank a fresh compatible source", () => {
  const oldRich = {
    ...richerLegacy,
    payload: compatiblePayload({
      generated_at: "2026-07-25T10:00:00Z",
      model_evolution: { status: "ok" },
      latest_hermes: { status: "ready" },
      active_runs: [{ run_id: "old" }],
    }),
  };

  assert.equal(selectLocalCodexLabRecord([partialCanonical, oldRich], now).path, partialCanonical.path);
});

test("cached, stale, and future Atlas service evidence cannot render healthy", () => {
  const cached = normalizeAtlasServiceStatus({
    unit: "project-atlas.service",
    enabled: true,
    active_state: "active",
    health_status: "ok",
    health_url: "http://127.0.0.1:4174/api/health",
    updated_at: "2026-07-25T19:59:00Z",
    evidence_source: "cached_live_export",
  }, now);
  assert.equal(cached.freshness, "stale");
  assert.equal(cached.healthStatus, "stale");
  assert.equal(cached.reportedHealthStatus, "ok");

  const oldLive = normalizeAtlasServiceStatus({
    unit: "project-atlas.service",
    enabled: true,
    active_state: "active",
    health_status: "ok",
    updated_at: "2026-07-25T18:00:00Z",
    evidence_source: "live_probe",
  }, now);
  assert.equal(oldLive.freshness, "stale");
  assert.equal(oldLive.healthStatus, "stale");

  const future = normalizeAtlasServiceStatus({
    unit: "project-atlas.service",
    health_status: "ok",
    updated_at: "2026-07-25T20:06:00Z",
    evidence_source: "live_probe",
  }, now);
  assert.equal(future.freshness, "unavailable");
  assert.equal(future.healthStatus, "unknown");

  const freshLive = normalizeAtlasServiceStatus({
    unit: "project-atlas.service",
    enabled: true,
    active_state: "active",
    health_status: "ok",
    updated_at: "2026-07-25T19:59:00Z",
    evidence_source: "live_probe",
  }, now);
  assert.equal(freshLive.freshness, "fresh");
  assert.equal(freshLive.healthStatus, "ok");

  const unknownEvidence = normalizeAtlasServiceStatus({
    unit: "project-atlas.service",
    enabled: true,
    active_state: "active",
    health_status: "ok",
    updated_at: "2026-07-25T19:59:00Z",
    evidence_source: "forged",
  }, now);
  assert.equal(unknownEvidence.evidenceSource, "unknown");
  assert.equal(unknownEvidence.freshness, "unavailable");
  assert.equal(unknownEvidence.healthStatus, "unknown");
});
