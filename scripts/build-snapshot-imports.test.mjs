import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("./build-snapshot.mjs", import.meta.url),
  "utf8",
);

test("build snapshot imports both source-selection helpers it executes", () => {
  assert.match(source, /normalizeAtlasServiceStatus/);
  assert.match(source, /selectLocalCodexLabRecord/);
  assert.match(source, /from "\.\/snapshot-source-selection\.mjs"/);
});
