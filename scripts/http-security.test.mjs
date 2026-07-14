import assert from "node:assert/strict";
import test from "node:test";
import { isMutationAllowed, MAX_JSON_BODY_BYTES } from "./http-security.mjs";

const origins = new Set(["http://127.0.0.1:4174", "http://localhost:4174"]);

test("same-origin browser mutations are allowed", () => {
  assert.equal(isMutationAllowed({ origin: "http://127.0.0.1:4174" }, origins, "token"), true);
});

test("cross-origin and originless mutations fail closed", () => {
  assert.equal(isMutationAllowed({ origin: "https://attacker.example" }, origins, "token"), false);
  assert.equal(isMutationAllowed({}, origins, "token"), false);
});

test("operator token enables originless local automation", () => {
  assert.equal(isMutationAllowed({ "x-atlas-action-token": "token" }, origins, "token"), true);
  assert.equal(isMutationAllowed({ "x-atlas-action-token": "wrong" }, origins, "token"), false);
});

test("JSON body limit is bounded", () => {
  assert.equal(MAX_JSON_BODY_BYTES, 1024 * 1024);
});
