import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("./build-snapshot.mjs", import.meta.url),
  "utf8",
);

test("build snapshot imports every projection helper it executes", () => {
  for (const symbol of [
    "normalizeCommercialSummary",
    "normalizeRevenueAutopilot",
    "normalizeCommercialBilling",
    "normalizeCommercialLaunchObservability",
    "normalizeLocalAgentPlatform",
    "normalizeAiCompanyMissionControl",
    "unavailableAiCompanyMissionControl",
    "normalizeCodexAudit",
    "normalizeAtlasServiceStatus",
    "selectLocalCodexLabRecord",
  ]) {
    assert.match(source, new RegExp(`\\b${symbol}\\b`));
  }

  for (const modulePath of [
    "./commercial-summary.mjs",
    "./commercial-billing.mjs",
    "./commercial-launch-observability.mjs",
    "./local-agent-platform.mjs",
    "./ai-company-mission-control.mjs",
    "./codex-audit.mjs",
    "./snapshot-source-selection.mjs",
  ]) {
    assert.ok(source.includes(`from "${modulePath}"`), `missing import from ${modulePath}`);
  }

  assert.match(source, /const administration = buildAdministration\(\);/);
});
