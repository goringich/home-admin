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
  assert.match(company, /Mission DAG/);
  assert.match(company, /Evidence & verification/);
  assert.match(company, /Approvals/);
  assert.match(company, /Company operations/);
  assert.match(company, /availability/);
  assert.match(company, /freshness/);
  assert.match(company, /verification/);
  assert.match(company, /data class/);
  assert.match(company, /typeof approval\.revision === "number"/);
  assert.match(company, /data\.state\.freshness === "fresh"/);
  assert.match(company, /data\.state\.dataClass === "real"/);
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
