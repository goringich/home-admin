import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const host = fs.readFileSync(new URL("./atlas-host.mjs", import.meta.url), "utf8");
const dispatch = fs.readFileSync(
  new URL("./atlas-agent-dispatch.mjs", import.meta.url),
  "utf8",
);

test("Atlas prepares requests but never becomes a queue producer", () => {
  assert.match(host, /\/api\/local-agent\/prepare/);
  assert.match(host, /atlas_prepare_only_use_governed_producer/);
  assert.doesNotMatch(dispatch, /local-agent-exec/);
  assert.doesNotMatch(dispatch, /--dispatch/);
  assert.doesNotMatch(dispatch, /queueTaskPath|queueTaskId/);
  assert.match(dispatch, /queueCreated:\s*false/);
});
