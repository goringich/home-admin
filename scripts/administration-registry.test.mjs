import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const snapshotPath = path.join(process.cwd(), "public", "snapshot.json");

test("administration registry is represented without secret launch URLs", () => {
  const temporaryHome = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-admin-"));
  const registryPath = path.join(
    temporaryHome,
    "__home_organized",
    "local-codex-stack",
    "configs",
    "admin-surface-registry.json",
  );
  const previousSnapshot = fs.existsSync(snapshotPath)
    ? fs.readFileSync(snapshotPath)
    : null;

  try {
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    const registry = {
      schema_version: "2026-08-04.test.v1",
      status: "adopted",
      source_of_truth: ["fixture"],
      global_contract: { redaction: "required" },
      surfaces: [
        {
          id: "fixture-admin",
          title: "Fixture admin",
          classification: "test",
          ownership: "owner",
          availability: "available",
          launch: { mode: "runbook", label: "Open guide", target: "/docs/admin" },
          capabilities: ["read-only"],
        },
      ],
    };
    fs.writeFileSync(registryPath, `${JSON.stringify(registry)}\n`);

    execFileSync(process.execPath, ["scripts/build-snapshot.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, HOME: temporaryHome },
      stdio: "pipe",
    });

    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
    assert.equal(snapshot.administration.status, "registered");
    assert.equal(snapshot.administration.surfaces.length, 1);
    assert.equal(snapshot.administration.surfaces[0].id, "fixture-admin");
    assert.equal(snapshot.administration.surfaces[0].launch.target.includes("?"), false);
  } finally {
    if (previousSnapshot === null) fs.rmSync(snapshotPath, { force: true });
    else fs.writeFileSync(snapshotPath, previousSnapshot);
    fs.rmSync(temporaryHome, { recursive: true, force: true });
  }
});
