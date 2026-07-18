import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";

const STATE_ROOT = process.env.PROJECT_ATLAS_STATE_ROOT || path.join(os.homedir(), "__home_organized", "runtime", "project-atlas");
const DB_PATH = path.join(STATE_ROOT, "project-atlas.sqlite");

function now() { return new Date().toISOString(); }
function json(value) { return JSON.stringify(value ?? null); }
function parse(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
function id(value) { return /^[a-z][a-z0-9_-]{2,80}$/.test(String(value)) ? String(value) : null; }

export function openProjectStore() {
  fs.mkdirSync(STATE_ROOT, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, canonical_path TEXT NOT NULL UNIQUE, remote_identity TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, metadata_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS project_items(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, kind TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS observed_records(project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, source_id TEXT NOT NULL, collected_at TEXT NOT NULL, freshness_ms INTEGER NOT NULL, status TEXT NOT NULL, duration_ms INTEGER, error_json TEXT, provenance_json TEXT NOT NULL, data_json TEXT NOT NULL, PRIMARY KEY(project_id, source_id));
    CREATE TABLE IF NOT EXISTS audit_events(id INTEGER PRIMARY KEY AUTOINCREMENT, occurred_at TEXT NOT NULL, actor TEXT NOT NULL, project_id TEXT, event_type TEXT NOT NULL, payload_json TEXT NOT NULL);`);
  return {
    db,
    close: () => db.close(),
    audit(projectId, eventType, payload, actor = "local-operator") { db.prepare("INSERT INTO audit_events(occurred_at,actor,project_id,event_type,payload_json) VALUES(?,?,?,?,?)").run(now(), actor, projectId, eventType, json(payload)); },
    listProjects() { return db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all().map(row => ({ ...row, metadata: parse(row.metadata_json, {}) })); },
    getProject(projectId) { const row = db.prepare("SELECT * FROM projects WHERE id=?").get(projectId); return row && { ...row, metadata: parse(row.metadata_json, {}) }; },
    upsertProject(record, expectedRevision) { if (!id(record.id) || !record.canonicalPath) throw new Error("invalid project record"); const existing = this.getProject(record.id); if (existing && expectedRevision !== existing.revision) { const error = new Error("stale revision"); error.code = "STALE"; throw error; } const time = now(); const revision = (existing?.revision || 0) + 1; db.prepare("INSERT INTO projects(id,canonical_path,remote_identity,revision,created_at,updated_at,metadata_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET canonical_path=excluded.canonical_path,remote_identity=excluded.remote_identity,revision=excluded.revision,updated_at=excluded.updated_at,metadata_json=excluded.metadata_json").run(record.id, record.canonicalPath, record.remoteIdentity || "", revision, existing?.created_at || time, time, json(record.metadata || {})); this.audit(record.id, existing ? "project.updated" : "project.created", { revision }); return this.getProject(record.id); },
    items(projectId, kind) { return db.prepare("SELECT * FROM project_items WHERE project_id=? AND kind=? ORDER BY updated_at DESC").all(projectId, kind).map(row => ({ ...row, data: parse(row.data_json, {}) })); },
    saveItem(projectId, kind, record, expectedRevision) { if (!id(projectId) || !/^(goal|task|service|environment|release|relationship|view|policy)$/.test(kind) || !id(record.id)) throw new Error("invalid operator item"); const old = db.prepare("SELECT * FROM project_items WHERE id=?").get(record.id); if (old && (old.project_id !== projectId || old.kind !== kind || expectedRevision !== old.revision)) { const error = new Error("stale revision"); error.code = "STALE"; throw error; } const time = now(); const revision = (old?.revision || 0) + 1; db.prepare("INSERT INTO project_items(id,project_id,kind,revision,created_at,updated_at,data_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,updated_at=excluded.updated_at,data_json=excluded.data_json").run(record.id, projectId, kind, revision, old?.created_at || time, time, json(record.data || {})); this.audit(projectId, `operator.${kind}.saved`, { id: record.id, revision }); return db.prepare("SELECT * FROM project_items WHERE id=?").get(record.id); },
    observe(projectId, sourceId, value) { db.prepare("INSERT INTO observed_records(project_id,source_id,collected_at,freshness_ms,status,duration_ms,error_json,provenance_json,data_json) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(project_id,source_id) DO UPDATE SET collected_at=excluded.collected_at,freshness_ms=excluded.freshness_ms,status=excluded.status,duration_ms=excluded.duration_ms,error_json=excluded.error_json,provenance_json=excluded.provenance_json,data_json=excluded.data_json").run(projectId, sourceId, value.collectedAt || now(), value.freshnessMs || 0, value.status || "unknown", value.durationMs || null, json(value.error), json(value.provenance || {}), json(value.data || {})); },
    observed(projectId) { return db.prepare("SELECT * FROM observed_records WHERE project_id=?").all(projectId).map(row => ({ ...row, error: parse(row.error_json, null), provenance: parse(row.provenance_json, {}), data: parse(row.data_json, {}) })); },
    auditTrail(projectId) { return db.prepare("SELECT * FROM audit_events WHERE project_id=? ORDER BY id DESC LIMIT 100").all(projectId).map(row => ({ ...row, payload: parse(row.payload_json, {}) })); },
  };
}

const stableId = (prefix, value) => `${prefix}-${createHash("sha256").update(value).digest("hex").slice(0, 20)}`;

export function migrateLegacyOverrides(store, overrides, observedProjects = []) {
  const paths = new Map(observedProjects.map(project => [project.name || project.id, project.repoPath]));
  for (const [legacyId, project] of Object.entries(overrides.projects || {})) {
    const canonicalPath = paths.get(legacyId) || project.canonicalPath || "";
    const projectId = stableId("project", `${canonicalPath}|${legacyId}`);
    if (!canonicalPath || store.getProject(projectId)) continue;
    store.upsertProject({ id: projectId, canonicalPath, metadata: { title: project.title || legacyId, domain: project.domain || "external", summary: project.summary || "", pinned: (overrides.focus || []).includes(legacyId) } }, 0);
    for (const [index, task] of (project.tasks || []).entries()) store.saveItem(projectId, "task", { id: stableId("task", `${projectId}|${index}|${task.title || ""}`), data: task }, 0);
  }
}
