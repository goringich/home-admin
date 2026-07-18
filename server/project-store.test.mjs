import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-store-"));
process.env.PROJECT_ATLAS_STATE_ROOT = root;
const { openProjectStore, migrateLegacyOverrides } = await import("./project-store.mjs");

test("operator records persist, audit, and reject stale writes", () => {
  const store = openProjectStore();
  const project = store.upsertProject({ id: "atlas-test", canonicalPath: "/workspace/atlas-test", remoteIdentity: "git@example/atlas", metadata: { title: "Atlas" } }, 0);
  assert.equal(project.revision, 1);
  const task = store.saveItem(project.id, "task", { id: "task-test", data: { title: "Persisted" } }, 0);
  assert.equal(task.revision, 1);
  assert.throws(() => store.saveItem(project.id, "task", { id: "task-test", data: {} }, 0), { code: "STALE" });
  assert.equal(store.auditTrail(project.id).length, 2);
  store.close();
});

test("legacy migration is deterministic and idempotent", () => {
  const store = openProjectStore();
  const legacy = { focus: ["atlas"], projects: { atlas: { title: "Atlas", domain: "tooling", tasks: [{ title: "Move state" }] } } };
  const observed = [{ id: "atlas", name: "atlas", repoPath: "/workspace/atlas" }];
  migrateLegacyOverrides(store, legacy, observed);
  migrateLegacyOverrides(store, legacy, observed);
  const migrated = store.listProjects().filter(project => project.canonical_path === "/workspace/atlas");
  assert.equal(migrated.length, 1);
  assert.equal(store.items(migrated[0].id, "task").length, 1);
  store.close();
});
