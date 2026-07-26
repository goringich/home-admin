import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  unavailableAiCompanyMissionControl,
  normalizeAiCompanyMissionControl,
} from "./ai-company-mission-control.mjs";


const CANONICAL_EXPORT_PATH = "/home/goringich/__home_organized/runtime/local-codex-stack/atlas/ai-company-mission-control.v1.json";


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

  const unavailablePayload = fixture();
  unavailablePayload.data_state.availability = "unavailable";
  unavailablePayload.data_state.freshness = "unavailable";
  const normalizedUnavailable = normalizeAiCompanyMissionControl(unavailablePayload, {
    nowMs: Date.parse("2026-07-26T12:05:00Z"),
  });
  assert.equal(normalizedUnavailable.state.availability, "unavailable");
  assert.equal(normalizedUnavailable.state.freshness, "unavailable");
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


test("a mixed root does not disable a fresh verified real approval for a real mission", () => {
  const payload = fixture();
  payload.data_state.data_class = "mixed";
  payload.data_state.verification = "unverified";
  payload.missions.items[0].data_class = "real";
  payload.missions.items[0].implementation_status = "verified";
  payload.approvals.data_state = {
    availability: "available",
    freshness: "fresh",
    verification: "partially_verified",
    data_class: "real",
  };
  payload.approvals.items[0].data_class = "real";

  const data = normalizeAiCompanyMissionControl(payload, {
    nowMs: Date.parse("2026-07-26T12:05:00Z"),
  });
  assert.equal(data.state.dataClass, "unknown");
  assert.equal(data.state.verification, "unverified");
  assert.equal(data.approvals[0].decision_trusted, true);
  assert.equal(data.approvals[0].decision_trust_reason, "trusted_real_approval");
});


test("canonical nested Mission Ledger export retains mission details and company operations", {
  skip: existsSync(CANONICAL_EXPORT_PATH) ? false : `canonical export unavailable at ${CANONICAL_EXPORT_PATH}`,
}, () => {
  const payload = JSON.parse(readFileSync(CANONICAL_EXPORT_PATH, "utf8"));
  const data = normalizeAiCompanyMissionControl(payload, {
    nowMs: Date.parse(payload.generated_at),
  });

  const demoMissionId = "mission_56cff22f6b6328350d0f754c0973f7f4";
  const masterMissionId = "mission_860f06105b4e0d22a75527fc34260d05";
  const atlasTaskId = "task_5fe7c53eaaa4017621c1279c";
  const demo = data.missions.find((mission) => mission.mission_id === demoMissionId);
  const master = data.missions.find((mission) => mission.mission_id === masterMissionId);

  assert.equal(data.state.dataClass, "unknown", "mixed data must not be promoted to real");
  assert.equal(demo?.title, "AI Company Governed Demo Mission");
  assert.equal(demo?.status, "completed");
  assert.equal(master?.title, "Build AI Company Control Plane v1");
  assert.equal(master?.status, "blocked");

  const missionTasks = (missionId) => data.tasks.filter((item) => item.mission_id === missionId);
  const connectedAttempts = (missionId) => {
    const taskIds = new Set(missionTasks(missionId).map((item) => item.task_id));
    return data.attempts.filter((item) => taskIds.has(item.task_id));
  };
  const connectedRuns = (missionId) => {
    const attemptIds = new Set(connectedAttempts(missionId).map((item) => item.attempt_id));
    return data.runs.filter((item) => attemptIds.has(item.attempt_id));
  };

  assert.equal(missionTasks(demoMissionId).length, 3);
  assert.equal(connectedAttempts(demoMissionId).length, 5);
  assert.equal(connectedRuns(demoMissionId).length, 3);
  assert.equal(data.evidence.filter((item) => item.mission_id === demoMissionId).length, 10);
  assert.equal(data.verifications.filter((item) => item.mission_id === demoMissionId).length, 5);
  assert.equal(data.approvals.filter((item) => item.mission_id === demoMissionId).length, 1);
  assert.equal(data.approvals.find((item) => item.mission_id === demoMissionId)?.decision_trusted, false);
  assert.equal(data.approvals.find((item) => item.mission_id === demoMissionId)?.decision_trust_reason, "mission_not_real");
  assert.equal(data.agentAssignments.filter((item) => item.mission_id === demoMissionId).length, 5);
  assert.equal(data.timeline.filter((item) => item.mission_id === demoMissionId).length, 90);
  assert.equal(data.outcomes.filter((item) => item.mission_id === demoMissionId).length, 1);

  assert.equal(missionTasks(masterMissionId).length, 10);
  assert.equal(connectedAttempts(masterMissionId).length, 9);
  assert.equal(data.evidence.filter((item) => item.mission_id === masterMissionId).length, 44);
  assert.equal(data.evidence.filter((item) => item.mission_id === masterMissionId && item.evidence_type === "commit").length, 13);
  assert.equal(data.agentAssignments.filter((item) => item.mission_id === masterMissionId).length, 9);
  assert.equal(data.incidents.filter((item) => item.mission_id === masterMissionId).length, 2);
  assert.equal(data.decisions.filter((item) => item.mission_id === masterMissionId).length, 1);
  assert.equal(data.timeline.filter((item) => item.mission_id === masterMissionId).length, 148);
  assert.equal(data.tasks.find((item) => item.task_id === atlasTaskId)?.status, "blocked");

  for (const key of ["offers", "leads", "opportunities", "experiments", "orders", "deliveries", "payments", "feedback"]) {
    assert.ok((data.operations.counters[key] ?? 0) > 0, `${key} counter must retain canonical records`);
  }
  assert.equal(data.operations.offers[0]?.offer_id, "offer_f081627fff38debb4c1fa4f794071fbf");
  assert.equal(data.operations.customerFeedback[0]?.feedback_id, "feedback_b51b2c7436738ec9c5d5be3949314734");
});
