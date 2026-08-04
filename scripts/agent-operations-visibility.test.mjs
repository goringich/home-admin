import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Runs renders the normalized platform with explicit stale and empty states", () => {
  const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const typesSource = readFileSync(new URL("../src/types.ts", import.meta.url), "utf8");
  const componentStyles = readFileSync(new URL("../src/styles/components.css", import.meta.url), "utf8");

  assert.match(typesSource, /localAgentPlatform: LocalAgentPlatform/);
  assert.match(appSource, /function AgentOperationsPanel/);
  assert.match(appSource, /const platform = props\.snapshot\.localAgentPlatform/);
  assert.match(appSource, /<AgentOperationsPanel platform=\{platform\}/);
  assert.match(appSource, /Данные устарели/);
  assert.match(appSource, /Безопасных run summaries пока нет/);
  assert.match(componentStyles, /\.status-cluster\s*\{/);
});
