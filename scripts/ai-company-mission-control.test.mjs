import assert from "node:assert/strict";
import test from "node:test";
import {
  unavailableAiCompanyMissionControl,
  normalizeAiCompanyMissionControl,
} from "./ai-company-mission-control.mjs";


function fixture() {
  return {
    schema_version: "2026-07-26.ai-company-atlas.v1",
    generated_at: "2026-07-26T12:00:00Z",
    export_hash: "a".repeat(64),
    safe_to_expose: true,
    data_state: {
      availability: "available",
      freshness: "fresh",
      verification: "partially_verified",
      data_class: "fixture",
    },
    portfolios: {
      items: [{ portfolio_id: "portfolio_1", title: "Control plane", status: "active", score: 7.5 }],
    },
    missions: {
      items: [{
        mission_id: "mission_1",
        portfolio_id: "portfolio_1",
        title: "Safe demo mission",
        status: "verification",
        implementation_status: "partially_verified",
        outcome_status: "not_measured",
        data_class: "fixture",
        objective: "Prove a bounded workflow",
        target_metric: "verified_demo",
        target_value: 1,
        prompt: "must never pass the parser",
      }],
    },
    workstreams: { items: [{ workstream_id: "workstream_1", mission_id: "mission_1", name: "Demo" }] },
    tasks: {
      items: [
        { task_id: "task_a", mission_id: "mission_1", workstream_id: "workstream_1", title: "A", status: "completed" },
        { task_id: "task_b", mission_id: "mission_1", workstream_id: "workstream_1", title: "B", status: "running" },
        { task_id: "task_c", mission_id: "mission_1", workstream_id: "workstream_1", title: "C", status: "queued" },
      ],
    },
    dependencies: { items: [{ task_id: "task_c", depends_on_task_id: "task_a", dependency_type: "blocks" }] },
    attempts: { items: [{ attempt_id: "attempt_1", task_id: "task_a", status: "verification" }] },
    runs: { items: [{ run_id: "run_1", attempt_id: "attempt_1", status: "completed" }] },
    evidence: { items: [{ evidence_id: "evidence_1", mission_id: "mission_1", task_id: "task_a", evidence_type: "unit_test", freshness: "fresh", summary: "passed" }] },
    verifications: { items: [{ verification_id: "verification_1", mission_id: "mission_1", task_id: "task_a", status: "verified", independent: true }] },
    approvals: { items: [{ approval_id: "approval_1", mission_id: "mission_1", status: "pending", approval_type: "owner_approval", requested_action: "Accept fixture", risk: "synthetic", revision: 2 }] },
    economics: { items: [{ cost_id: "cost_1", mission_id: "mission_1", task_id: "task_a", actual_cost: null, model_cost: 0.2, runtime_duration: 3.5 }] },
    offers: { items: [{ offer_id: "offer_1", mission_id: "mission_1", status: "draft", data_class: "fixture" }] },
    leads: { items: [{ lead_id: "lead_1", mission_id: "mission_1", status: "new", data_class: "fixture" }] },
    opportunities: { items: [] },
    experiments: { items: [{ experiment_id: "experiment_1", mission_id: "mission_1", status: "planned", data_class: "fixture" }] },
    orders: { items: [] },
    deliveries: { items: [] },
    payments: { items: [] },
    customer_feedback: { items: [] },
  };
}


test("parser connects mission entities and only retains the sanitized allowlist", () => {
  const data = normalizeAiCompanyMissionControl(fixture(), {
    nowMs: Date.parse("2026-07-26T12:05:00Z"),
  });

  assert.equal(data.state.availability, "available");
  assert.equal(data.state.freshness, "fresh");
  assert.equal(data.state.verification, "partially_verified");
  assert.equal(data.missions[0].mission_id, "mission_1");
  assert.equal(data.tasks.filter((item) => item.mission_id === "mission_1").length, 3);
  assert.equal(data.dependencies[0].depends_on_task_id, "task_a");
  assert.equal(data.attempts[0].task_id, "task_a");
  assert.equal(data.runs[0].attempt_id, "attempt_1");
  assert.equal(data.economics[0].actual_cost, null);
  assert.equal(data.operations.counters.offers, 1);
  assert.equal(data.operations.counters.orders, 0);
  assert.equal(JSON.stringify(data).includes("must never pass"), false);
});


test("stale, unavailable, fixture, and unknown states remain explicit", () => {
  const stale = normalizeAiCompanyMissionControl(fixture(), {
    nowMs: Date.parse("2026-07-26T14:00:00Z"),
    maxAgeMs: 15 * 60 * 1000,
  });
  assert.equal(stale.state.freshness, "stale");
  assert.equal(stale.state.dataClass, "fixture");
  assert.equal(stale.economics[0].actual_cost, null);

  const unavailable = unavailableAiCompanyMissionControl("source_missing");
  assert.equal(unavailable.state.availability, "unavailable");
  assert.equal(unavailable.state.freshness, "unavailable");
  assert.equal(unavailable.state.verification, "unverified");
  assert.equal(unavailable.missions.length, 0);
});


test("unsafe exports fail closed and expose no records", () => {
  const unsafe = fixture();
  unsafe.safe_to_expose = false;
  const data = normalizeAiCompanyMissionControl(unsafe);
  assert.equal(data.state.availability, "unavailable");
  assert.equal(data.state.reason, "unsafe_export");
  assert.deepEqual(data.approvals, []);
  assert.deepEqual(data.economics, []);
});
