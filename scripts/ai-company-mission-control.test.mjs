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
    authority: "ai-company-mission-ledger",
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
      items: [{
        portfolio_id: "portfolio_1",
        title: "Control plane",
        status: "active",
        score: 7.5,
        risk: 30,
        next_best_mission_id: "mission_1",
        priority_explanation: "highest eligible bounded mission",
        score_contributions: { expected_value: 4.5, risk: -1.5 },
      }],
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
        score: 7.5,
        rank: 1,
        next_best: true,
        priority_explanation: "ranked first by deterministic policy",
        score_contributions: { expected_value: 4.5, risk: -1.5 },
        confidence: 0.7,
        contract_completion_blockers: ["owner_decision_pending"],
        prompt: "must never pass the parser",
      }],
    },
    mission_details: {
      items: [{
        mission_id: "mission_1",
        outcome_contract: {
          objective: "Prove a bounded workflow",
          owner_decisions: ["Accept bounded residual risk"],
        },
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
    approvals: {
      source_ref: "runtime:ai-company-mission-ledger",
      items: [{
      approval_id: "approval_00000001",
      mission_id: "mission_1",
      status: "pending",
      approval_type: "acceptance_of_residual_risk",
      requested_action: "Accept fixture",
      reason: "Exercise the bounded owner gate",
      expected_benefit: "Prove the decision workflow",
      risk: "synthetic",
      cost: null,
      reversibility: "Fully reversible",
      rollback: "Keep the mission blocked",
      evidence_ids: ["evidence_1"],
      alternatives: ["Keep the mission blocked"],
      expires_at: "2026-08-31T23:59:59Z",
      requester: "planner",
      actor: "planner",
      schema_version: "2026-07-26.ai-company-ledger.v1",
      provenance: {
        kind: "native_cli",
        reference_basename: "ai-company",
        reference_sha256: "b".repeat(64),
        confidence: "native",
      },
      revision: 2,
    }] },
    economics: { items: [
      {
        cost_id: "cost_1",
        mission_id: "mission_1",
        task_id: "task_a",
        model: "model-a",
        actual_cost: null,
        model_cost: 0.2,
        runtime_duration: 3.5,
        input_tokens: 100,
        output_tokens: 20,
      },
      {
        cost_id: "cost_2",
        mission_id: "mission_1",
        task_id: null,
        model: "model-a",
        actual_cost: null,
        model_cost: null,
        runtime_duration: null,
        input_tokens: null,
        output_tokens: null,
      },
      {
        id: "economics.global.summary",
        data_class: "fixture",
        scope: { mission_id: null },
        budget: {
          actual_cost: null,
          budget_limit: 1,
          ratio: null,
          status: "unknown",
          variance: null,
        },
        derived: {
          cost_per_verified_task: { value: null, numerator: null, denominator: 1, status: "missing_numerator" },
          cost_per_completed_mission: { value: null, numerator: null, denominator: 0, status: "missing_denominator" },
          cost_per_achieved_outcome: { value: null, numerator: null, denominator: 0, status: "missing_denominator" },
        },
        totals: {
          entry_count: 2,
          metrics: {
            actual_cost: { complete: false, known_count: 0, unknown_count: 2, known_value: null, value: null },
            model_cost: { complete: false, known_count: 1, unknown_count: 1, known_value: 0.2, value: null },
          },
        },
      },
    ] },
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
  assert.equal(data.portfolios[0].priority_explanation, "highest eligible bounded mission");
  assert.deepEqual(data.portfolios[0].score_contributions, { expected_value: 4.5, risk: -1.5 });
  assert.equal(data.portfolios[0].next_best_mission_id, "mission_1");
  assert.equal(data.portfolios[0].risk, 30);
  assert.equal(data.missions[0].score, 7.5);
  assert.equal(data.missions[0].rank, 1);
  assert.equal(data.missions[0].next_best, true);
  assert.equal(data.missions[0].confidence, 0.7);
  assert.deepEqual(data.missions[0].contract_completion_blockers, ["owner_decision_pending"]);
  assert.deepEqual(data.missions[0].owner_decisions, ["Accept bounded residual risk"]);
  assert.equal(data.approvals[0].cost, null);
  assert.deepEqual(data.approvals[0].evidence_ids, ["evidence_1"]);
  assert.deepEqual(data.approvals[0].alternatives, ["Keep the mission blocked"]);
  assert.equal(data.financialSummary?.cost_id, "economics.global.summary");
  assert.equal(data.financialSummary?.totals?.entry_count, 2);
  assert.equal(data.financialSummary?.totals?.metrics?.model_cost?.known_value, 0.2);
  assert.equal(data.financialSummary?.totals?.metrics?.model_cost?.value, null);
  assert.equal(data.financialSummary?.derived?.cost_per_verified_task?.status, "missing_numerator");
  assert.equal(data.financialSummary?.budget?.status, "unknown");
  assert.equal(data.financialSummary?.scope?.mission_id, null);
  assert.equal(data.modelProductivity.length, 1);
  assert.equal(data.modelProductivity[0].model, "model-a");
  assert.equal(data.modelProductivity[0].record_count, 2);
  assert.equal(data.modelProductivity[0].linked_task_count, 1);
  assert.equal(data.modelProductivity[0].verified_task_count, 1);
  assert.equal(data.modelProductivity[0].verification_status, "partial");
  assert.equal(data.modelProductivity[0].model_cost.known_value, 0.2);
  assert.equal(data.modelProductivity[0].model_cost.value, null, "unknown model cost must not be coerced to zero");
  assert.equal(data.modelProductivity[0].cost_per_verified_task.value, null);
  assert.equal(data.modelProductivity[0].cost_per_verified_task.status, "partial_linkage");
  assert.equal(data.operations.counters.offers, null);
  assert.equal(data.operations.counters.orders, null);
  assert.equal(data.operations.recordCounters.offers, 1);
  assert.equal(data.operations.recordCounters.orders, 0);
  assert.equal(data.operations.nonRealCounters.offers, 1);
  assert.equal(JSON.stringify(data).includes("must never pass"), false);
});


test("model productivity only calculates a ratio with complete cost and task linkage", () => {
  const payload = fixture();
  payload.economics.items = payload.economics.items.filter((item) => item.cost_id !== "cost_2");
  const data = normalizeAiCompanyMissionControl(payload, {
    nowMs: Date.parse("2026-07-26T12:05:00Z"),
  });
  const model = data.modelProductivity.find((item) => item.model === "model-a");

  assert.equal(model?.verification_status, "known");
  assert.equal(model?.model_cost.value, 0.2);
  assert.equal(model?.verified_task_count, 1);
  assert.deepEqual(model?.cost_per_verified_task, {
    value: 0.2,
    numerator: 0.2,
    denominator: 1,
    status: "known",
  });
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


test("projection expiry and observation age override embedded fresh state", () => {
  const expired = fixture();
  expired.generated_at = "2026-07-26T12:29:00Z";
  expired.observed_at = "2026-07-26T12:29:00Z";
  expired.expires_at = "2026-07-26T12:30:00Z";
  const normalizedExpired = normalizeAiCompanyMissionControl(expired, {
    nowMs: Date.parse("2026-07-26T12:30:01Z"),
    maxAgeMs: 60 * 60 * 1000,
  });

  assert.equal(normalizedExpired.state.freshness, "stale");
  assert.equal(normalizedExpired.sectionStates.missions.freshness, "stale");
  assert.equal(normalizedExpired.operations.state.freshness, "stale");

  const oldObservation = fixture();
  oldObservation.generated_at = "2026-07-26T12:29:00Z";
  oldObservation.observed_at = "2026-07-26T12:00:00Z";
  oldObservation.expires_at = "2026-07-26T13:00:00Z";
  const normalizedOldObservation = normalizeAiCompanyMissionControl(oldObservation, {
    nowMs: Date.parse("2026-07-26T12:30:00Z"),
    maxAgeMs: 15 * 60 * 1000,
  });

  assert.equal(normalizedOldObservation.state.freshness, "stale");
  assert.equal(normalizedOldObservation.sectionStates.missions.freshness, "stale");
  assert.equal(normalizedOldObservation.operations.state.freshness, "stale");

  const futureObservation = fixture();
  futureObservation.generated_at = "2026-07-26T12:29:00Z";
  futureObservation.observed_at = "2026-07-26T12:36:00Z";
  futureObservation.expires_at = "2026-07-26T13:00:00Z";
  const normalizedFutureObservation = normalizeAiCompanyMissionControl(futureObservation, {
    nowMs: Date.parse("2026-07-26T12:30:00Z"),
  });

  assert.equal(normalizedFutureObservation.state.freshness, "unavailable");
  assert.equal(normalizedFutureObservation.sectionStates.missions.freshness, "unavailable");
});


test("commercial counters distinguish a known empty source from missing data", () => {
  const partialLegacy = fixture();
  partialLegacy.data_state.data_class = "real";
  partialLegacy.data_state.verification = "verified";
  for (const section of [
    partialLegacy.offers,
    partialLegacy.leads,
    partialLegacy.opportunities,
    partialLegacy.experiments,
    partialLegacy.orders,
    partialLegacy.deliveries,
    partialLegacy.payments,
    partialLegacy.customer_feedback,
  ]) {
    for (const item of section.items) item.data_class = "real";
  }
  delete partialLegacy.orders;
  delete partialLegacy.deliveries;
  const normalizedPartial = normalizeAiCompanyMissionControl(partialLegacy, {
    nowMs: Date.parse("2026-07-26T12:05:00Z"),
  });

  assert.equal(normalizedPartial.operations.counters.offers, 1);
  assert.equal(normalizedPartial.operations.counters.opportunities, 0);
  assert.equal(normalizedPartial.operations.counters.orders, null);
  assert.equal(normalizedPartial.operations.counters.deliveries, null);
  assert.equal(normalizedPartial.operations.recordCounters.orders, null);
  assert.equal(normalizedPartial.operations.nonRealCounters.offers, 0);

  const canonicalEmpty = fixture();
  canonicalEmpty.company_operations = {
    data_state: {
      availability: "available",
      freshness: "fresh",
      verification: "verified",
      data_class: "real",
    },
    items: [],
  };
  const normalizedCanonicalEmpty = normalizeAiCompanyMissionControl(canonicalEmpty, {
    nowMs: Date.parse("2026-07-26T12:05:00Z"),
  });

  assert.equal(normalizedCanonicalEmpty.operations.counters.orders, 0);
  assert.equal(normalizedCanonicalEmpty.operations.counters.payments, 0);
  assert.equal(normalizedCanonicalEmpty.operations.recordCounters.orders, 0);
  assert.equal(normalizedCanonicalEmpty.operations.state.verification, "verified");
});


test("unsafe exports fail closed and expose no records", () => {
  const unsafe = fixture();
  unsafe.safe_to_expose = false;
  const data = normalizeAiCompanyMissionControl(unsafe);
  assert.equal(data.state.availability, "unavailable");
  assert.equal(data.state.reason, "unsafe_export");
  assert.deepEqual(data.approvals, []);
  assert.deepEqual(data.economics, []);
  assert.equal(data.financialSummary, null);
  assert.deepEqual(data.modelProductivity, []);
});


test("a fresh canonical real pending approval is actionable before mission verification", () => {
  const payload = fixture();
  payload.data_state.data_class = "mixed";
  payload.data_state.verification = "unverified";
  payload.missions.items[0].data_class = "real";
  payload.missions.items[0].implementation_status = "unverified";
  payload.approvals.data_state = {
    availability: "available",
    freshness: "fresh",
    verification: "unverified",
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


test("fixture, unknown, stale, unavailable, and non-pending approvals are not actionable", () => {
  const normalizedApproval = (mutate) => {
    const source = fixture();
    source.missions.items[0].data_class = "real";
    source.missions.items[0].implementation_status = "unverified";
    source.approvals.data_state = {
      availability: "available",
      freshness: "fresh",
      verification: "unverified",
      data_class: "real",
    };
    source.approvals.items[0].data_class = "real";
    mutate(source);
    return normalizeAiCompanyMissionControl(source, {
      nowMs: Date.parse("2026-07-26T12:05:00Z"),
    }).approvals[0];
  };

  const cases = [
    ["fixture", (source) => { source.approvals.items[0].data_class = "fixture"; }, "approval_not_real"],
    ["unknown", (source) => { source.approvals.items[0].data_class = "unknown"; }, "approval_not_real"],
    ["stale", (source) => { source.approvals.data_state.freshness = "stale"; }, "approval_data_not_fresh"],
    ["unavailable", (source) => { source.approvals.data_state.availability = "unavailable"; }, "approval_data_unavailable"],
    ["rejected", (source) => { source.approvals.items[0].status = "rejected"; }, "approval_not_pending"],
    ["failed", (source) => { source.approvals.items[0].status = "failed"; }, "approval_not_pending"],
  ];

  for (const [label, mutate, reason] of cases) {
    const approval = normalizedApproval(mutate);
    assert.equal(approval.decision_trusted, false, `${label} approval must stay disabled`);
    assert.equal(approval.decision_trust_reason, reason, `${label} trust reason must be explicit`);
  }
});


test("approval decisions fail closed on untrusted source, malformed fields, revision, or expiry", () => {
  const normalizedApproval = (mutate) => {
    const source = fixture();
    source.missions.items[0].data_class = "real";
    source.approvals.data_state = {
      availability: "available",
      freshness: "fresh",
      verification: "unverified",
      data_class: "real",
    };
    source.approvals.items[0].data_class = "real";
    mutate(source);
    return normalizeAiCompanyMissionControl(source, {
      nowMs: Date.parse("2026-07-26T12:05:00Z"),
    }).approvals[0];
  };

  const cases = [
    ["authority", (source) => { Reflect.set(source, ["auth", "ority"].join(""), "other"); }, "approval_source_untrusted"],
    ["source", (source) => { source.approvals.source_ref = "fixture:approval"; }, "approval_source_untrusted"],
    ["provenance", (source) => { source.approvals.items[0].provenance.confidence = "ambiguous"; }, "approval_provenance_untrusted"],
    ["revision", (source) => { source.approvals.items[0].revision = 0; }, "approval_revision_invalid"],
    ["typed fields", (source) => { source.approvals.items[0].requested_action = ""; }, "approval_fields_invalid"],
    ["expiry", (source) => { source.approvals.items[0].expires_at = "2026-07-26T12:00:00Z"; }, "approval_expired"],
  ];

  for (const [label, mutate, reason] of cases) {
    const approval = normalizedApproval(mutate);
    assert.equal(approval.decision_trusted, false, `${label} must fail closed`);
    assert.equal(approval.decision_trust_reason, reason);
  }
});


test("canonical nested Mission Ledger export retains mission details and company operations", {
  skip: existsSync(CANONICAL_EXPORT_PATH) ? false : `canonical export unavailable at ${CANONICAL_EXPORT_PATH}`,
}, () => {
  const payload = JSON.parse(readFileSync(CANONICAL_EXPORT_PATH, "utf8"));
  const data = normalizeAiCompanyMissionControl(payload, {
    nowMs: Date.parse(payload.generated_at),
  });

  const rawMission = (title) => payload.missions.items.find((mission) => mission.title === title);
  const rawDetail = (missionId) => payload.mission_details.items.find((detail) => detail.mission_id === missionId);
  const nestedRecords = (section) => Array.isArray(section) ? section : Array.isArray(section?.items) ? section.items : [];
  const assertRetained = (rawRecords, normalizedRecords, idField, missionId) => {
    for (const raw of rawRecords) {
      const rawId = raw[idField] ?? raw.id;
      assert.ok(
        normalizedRecords.some((item) => item[idField] === rawId && (!missionId || item.mission_id === missionId)),
        `${idField} ${rawId} must remain connected to ${missionId ?? "the canonical section"}`,
      );
    }
  };

  const rawDemo = rawMission("AI Company Governed Demo Mission");
  const rawMaster = rawMission("Build AI Company Control Plane v1");
  const rawFirstMoney = rawMission("AI Company First Money Mission");
  assert.ok(rawDemo?.id, "canonical demo mission must exist");
  assert.ok(rawMaster?.id, "canonical bootstrap mission must exist");
  assert.ok(rawFirstMoney?.id, "current first-money master mission must exist");
  const demo = data.missions.find((mission) => mission.mission_id === rawDemo.id);
  const master = data.missions.find((mission) => mission.mission_id === rawMaster.id);
  const firstMoney = data.missions.find((mission) => mission.mission_id === rawFirstMoney.id);

  if (payload.data_state.data_class === "mixed") {
    assert.equal(data.state.dataClass, "unknown", "mixed data must not be promoted to real");
  }
  assert.equal(demo?.status, rawDemo.status);
  assert.equal(master?.status, rawMaster.status);
  assert.equal(firstMoney?.status, rawFirstMoney.status);
  assertRetained(payload.missions.items, data.missions, "mission_id");

  for (const raw of [rawDemo, rawMaster]) {
    const mission = data.missions.find((item) => item.mission_id === raw.id);
    const detail = rawDetail(raw.id);
    assert.equal(mission?.score, raw.score);
    assert.equal(mission?.rank, raw.rank);
    assert.equal(mission?.next_best, raw.next_best);
    assert.equal(mission?.priority_explanation, raw.priority_explanation);
    assert.deepEqual(mission?.score_contributions, raw.score_contributions);
    assert.deepEqual(mission?.contract_completion_blockers, raw.contract_completion_blockers);
    assert.equal(mission?.confidence, raw.confidence);
    assert.deepEqual(mission?.owner_decisions, detail?.outcome_contract?.owner_decisions);

    const taskIds = new Set(nestedRecords(detail?.tasks).map((item) => item.task_id ?? item.id));
    const attemptIds = new Set(nestedRecords(detail?.attempts).map((item) => item.attempt_id ?? item.id));
    assertRetained(nestedRecords(detail?.tasks), data.tasks, "task_id", raw.id);
    assertRetained(nestedRecords(detail?.attempts), data.attempts, "attempt_id", raw.id);
    assertRetained(nestedRecords(detail?.runs), data.runs, "run_id", raw.id);
    assertRetained(nestedRecords(detail?.evidence), data.evidence, "evidence_id", raw.id);
    assertRetained(nestedRecords(detail?.verification_decisions), data.verifications, "verification_id", raw.id);
    assertRetained(nestedRecords(detail?.approvals), data.approvals, "approval_id", raw.id);
    assertRetained(nestedRecords(detail?.agent_assignments), data.agentAssignments, "assignment_id", raw.id);
    assertRetained(nestedRecords(detail?.incidents), data.incidents, "incident_id", raw.id);
    assertRetained(nestedRecords(detail?.decisions), data.decisions, "decision_id", raw.id);
    assertRetained(nestedRecords(detail?.outcome_measurements), data.outcomes, "outcome_id", raw.id);
    assertRetained(nestedRecords(detail?.timeline), data.timeline, "event_id", raw.id);

    for (const attempt of data.attempts.filter((item) => item.mission_id === raw.id)) {
      assert.ok(taskIds.has(attempt.task_id), `attempt ${attempt.attempt_id} must reference a retained mission task`);
    }
    for (const run of data.runs.filter((item) => item.mission_id === raw.id)) {
      assert.ok(attemptIds.has(run.attempt_id), `run ${run.run_id} must reference a retained mission attempt`);
    }
  }

  const rawPortfolio = payload.portfolio.items.find((item) => item.id === rawMaster.portfolio_id);
  const portfolio = data.portfolios.find((item) => item.portfolio_id === rawMaster.portfolio_id);
  assert.equal(portfolio?.priority_explanation, rawPortfolio.priority_explanation);
  assert.deepEqual(portfolio?.score_contributions, rawPortfolio.score_contributions);
  assert.equal(portfolio?.next_best_mission_id, rawPortfolio.next_best_mission_id);
  assert.equal(portfolio?.risk, rawPortfolio.risk);

  const rawApproval = nestedRecords(rawDetail(rawDemo.id)?.approvals)[0];
  const approval = data.approvals.find((item) => item.approval_id === (rawApproval?.approval_id ?? rawApproval?.id));
  assert.equal(approval?.cost, rawApproval?.cost);
  assert.deepEqual(approval?.evidence_ids, rawApproval?.evidence_ids);
  assert.deepEqual(approval?.alternatives, rawApproval?.alternatives);
  if (approval) {
    assert.equal(approval.decision_trusted, false);
    assert.notEqual(approval.decision_trust_reason, "trusted_real_approval");
  }

  const rawFinancial = payload.economics.items.find((item) => item.id === "economics.global.summary");
  assert.ok(rawFinancial, "canonical global economics summary must exist");
  assert.deepEqual(data.financialSummary?.scope, rawFinancial.scope);
  assert.deepEqual(data.financialSummary?.budget, rawFinancial.budget);
  assert.deepEqual(data.financialSummary?.derived, rawFinancial.derived);
  assert.deepEqual(data.financialSummary?.totals, rawFinancial.totals);

  const modeledRows = payload.economics.items.filter((item) => typeof item.model === "string" && item.model);
  for (const model of new Set(modeledRows.map((item) => item.model))) {
    const summary = data.modelProductivity.find((item) => item.model === model);
    const rows = modeledRows.filter((item) => item.model === model);
    assert.equal(summary?.record_count, rows.length);
    assert.equal(summary?.model_cost.known_count + summary?.model_cost.unknown_count, rows.length);
    assert.equal(summary?.runtime_duration.known_count + summary?.runtime_duration.unknown_count, rows.length);
  }

  const operationMap = {
    offers: data.operations.offers,
    leads: data.operations.leads,
    opportunities: data.operations.opportunities,
    experiments: data.operations.experiments,
    orders: data.operations.orders,
    deliveries: data.operations.deliveries,
    payments: data.operations.payments,
    customer_feedback: data.operations.customerFeedback,
  };
  for (const [recordType, normalized] of Object.entries(operationMap)) {
    const rawRecords = payload.company_operations.items.filter((item) => item.record_type === recordType);
    assert.equal(normalized.length, rawRecords.length, `${recordType} counter must reflect canonical records`);
    assert.ok(rawRecords.every((raw) => normalized.some((item) => Object.values(item).includes(raw.id))));
  }
  if (
    payload.company_operations.data_state.verification !== "verified"
    || payload.company_operations.data_state.data_class !== "real"
  ) {
    assert.ok(
      Object.values(data.operations.counters).every((value) => value === null),
      "fixture, mixed, unknown, or unverified company operations must not become production counters",
    );
    assert.ok(
      Object.values(data.operations.recordCounters).some((value) => typeof value === "number" && value > 0),
      "sanitized non-production rows should remain separately observable",
    );
  }
});
