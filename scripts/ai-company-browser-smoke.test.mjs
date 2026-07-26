import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";


test("browser smoke uses real Chrome without software-rendering escape hatches", () => {
  const source = readFileSync(new URL("./ai-company-browser-smoke.mjs", import.meta.url), "utf8");
  assert.match(source, /\/opt\/google\/chrome\/chrome/);
  assert.match(source, /#company/);
  assert.match(source, /Mission DAG/);
  assert.match(source, /screenshot_sha256/);
  assert.match(source, /--allow-file-access-from-files/);
  assert.match(source, /--disable-crash-reporter/);
  assert.match(source, /--disable-crashpad-for-testing/);
  assert.doesNotMatch(source, /createServer|server\.listen/);
  const argsBlock = source.match(/const args = \[([\s\S]*?)\n\];/)?.[1] ?? "";
  assert.ok(argsBlock);
  assert.doesNotMatch(argsBlock, /--disable-gpu/);
  assert.doesNotMatch(argsBlock, /swiftshader/i);
});
