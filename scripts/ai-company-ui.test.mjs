import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";


test("Company is one connected Atlas workspace with explicit trust states", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const company = readFileSync(new URL("../src/CompanyWorkspace.tsx", import.meta.url), "utf8");
  const types = readFileSync(new URL("../src/types.ts", import.meta.url), "utf8");
  const host = readFileSync(new URL("./atlas-host.mjs", import.meta.url), "utf8");

  assert.match(app, /id: "company"/);
  assert.match(company, /function CompanyWorkspace/);
  assert.match(company, /Portfolio/);
  assert.match(company, /priority explanation/);
  assert.match(company, /next best mission/);
  assert.match(company, /score contributions/);
  assert.match(company, /Mission DAG/);
  assert.match(company, /Workstream:/);
  assert.match(company, /groupMissionTasks\(connected\.workstreams, connected\.tasks\)/);
  assert.match(company, /task\.workstream_id/);
  assert.match(company, /completion blockers/);
  assert.match(company, /owner decisions/);
  assert.match(company, /confidence/);
  assert.match(company, /Evidence & verification/);
  assert.match(company, /Agent assignments/);
  assert.match(company, /attempt\.attempt_id/);
  assert.match(company, /run\.run_id/);
  assert.match(company, /reference_basename/);
  assert.match(company, /Incidents, decisions & outcomes/);
  assert.match(company, /Event timeline/);
  assert.match(company, /event\.event_type/);
  assert.match(company, /outcome\.outcome_id/);
  assert.match(company, /incident\.incident_id/);
  assert.match(company, /decision\.decision_id/);
  assert.match(company, /Approvals/);
  assert.match(company, /evidence IDs/);
  assert.match(company, /alternatives/);
  assert.match(company, /Financial summary/);
  assert.match(company, /cost per verified task/);
  assert.match(company, /cost per completed mission/);
  assert.match(company, /Model productivity/);
  assert.match(company, /unknown values are not treated as zero/);
  assert.match(company, /Company operations/);
  assert.match(company, /availability/);
  assert.match(company, /freshness/);
  assert.match(company, /verification/);
  assert.match(company, /data class/);
  assert.match(company, /mission\.data_class/);
  assert.match(company, /missionTone\(mission, data\.state, missionSectionState\)/);
  assert.match(company, /typeof approval\.revision === "number"/);
  assert.match(company, /approval\.decision_trusted === true/);
  assert.match(company, /approval\.decision_trust_reason/);
  assert.match(company, /Fixture, unknown, stale, unavailable, and unsafe approval data never enable typed decisions/);
  assert.match(company, /approval\.status !== "pending"/);
  assert.match(company, /const APPROVAL_DECISION_ENDPOINT = "\.\/api\/company\/approvals\/decision"/);
  assert.match(company, /underlying action was not executed/);
  assert.match(types, /aiCompany: AiCompanyMissionControl/);
  assert.match(host, /\/api\/company\/approvals\/decision/);
  assert.match(host, /forwardApprovalDecision/);
  for (const field of ["approval_id", "decision", "actor", "reason", "expected_revision", "idempotency_key"]) {
    assert.match(company, new RegExp(field));
  }
  assert.doesNotMatch(company, /fetch\([^)]*command/);
});


test("Vite build is source-only and snapshot refresh remains an explicit command", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const snapshotSource = readFileSync(new URL("./build-snapshot.mjs", import.meta.url), "utf8");

  assert.equal(packageJson.scripts.build, "tsc -b && vite build");
  assert.equal(packageJson.scripts.snapshot, "node scripts/build-snapshot.mjs");
  assert.match(snapshotSource, /fileURLToPath\(new URL\("\.\."/);
  assert.match(snapshotSource, /ai-company-mission-control\.v1\.json/);
});
