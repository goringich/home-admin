import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const home = os.homedir();
const atlasRoot = fileURLToPath(new URL("..", import.meta.url));
const universePath = path.join(atlasRoot, "public", "architecture-universe.json");
const candidateRoots = [
  process.env.ATLAS_ARCHITECTURE_ROOT || "",
  path.join(home, "__home_organized"),
  path.join(home, "__home_organized-observatory-pr70"),
].filter(Boolean);
const LIVE_TTL_SECONDS = 900;

function readJson(targetPath, fallback = null) {
  try { return JSON.parse(fs.readFileSync(targetPath, "utf8")); } catch { return fallback; }
}

function parseDate(value) {
  const ms = Date.parse(String(value || ""));
  return Number.isFinite(ms) ? ms : null;
}

const universe = readJson(universePath, null);
if (!universe) {
  console.log("Architecture live overlay skipped: universe missing");
  process.exit(0);
}

const systemRoot = candidateRoots.find((root) => fs.existsSync(path.join(root, "runtime", "local-codex-stack", "architecture-observatory", "live-census.json"))) || candidateRoots[0];
const livePath = path.join(systemRoot || "", "runtime", "local-codex-stack", "architecture-observatory", "live-census.json");
const live = readJson(livePath, null);

if (!live || live.schema_version !== "2026-08-07.architecture-live-census.result.v1") {
  universe.live_overlay = { status: "unavailable", source: livePath };
  fs.writeFileSync(universePath, `${JSON.stringify(universe, null, 2)}\n`, "utf8");
  console.log("Architecture live overlay: unavailable");
  process.exit(0);
}

const observedMs = parseDate(live.observed_at);
const ageSeconds = observedMs === null ? null : Math.max(0, Math.floor((Date.now() - observedMs) / 1000));
if (ageSeconds === null || ageSeconds > LIVE_TTL_SECONDS) {
  universe.live_overlay = {
    status: ageSeconds === null ? "invalid_observed_at" : "stale",
    observed_at: live.observed_at || "",
    age_seconds: ageSeconds,
    ttl_seconds: LIVE_TTL_SECONDS,
    source: livePath,
  };
  fs.writeFileSync(universePath, `${JSON.stringify(universe, null, 2)}\n`, "utf8");
  console.log(`Architecture live overlay: ${universe.live_overlay.status}`);
  process.exit(0);
}

const allowed = new Set(["verified_current", "verified_live", "verified_source_only", "stale", "unknown", "blocked_external", "conflicting", "not_applicable"]);
const byId = new Map((universe.nodes || []).map((node) => [node.id, node]));
let applied = 0;
for (const [id, status] of Object.entries(live.node_live_status || {})) {
  const node = byId.get(id);
  if (!node || !allowed.has(status)) continue;
  if (node.lifecycle_status === "external_excluded" || node.live_status === "not_applicable") continue;
  node.tracked_live_status = node.live_status;
  node.live_status = status;
  node.live_observed_at = live.observed_at;
  applied += 1;
}

// Repository identity edges allow fresh status collected for the canonical core
// repository node to propagate to its richer census node without inventing health.
for (const edge of universe.edges || []) {
  if (edge.kind !== "repository_identity") continue;
  const left = byId.get(edge.from);
  const right = byId.get(edge.to);
  if (!left || !right) continue;
  const source = left.live_observed_at ? left : right.live_observed_at ? right : null;
  const target = source === left ? right : source === right ? left : null;
  if (!source || !target || target.lifecycle_status === "external_excluded") continue;
  target.tracked_live_status = target.live_status;
  target.live_status = source.live_status;
  target.live_observed_at = source.live_observed_at;
}

universe.live_overlay = {
  status: "fresh",
  observed_at: live.observed_at,
  age_seconds: ageSeconds,
  ttl_seconds: LIVE_TTL_SECONDS,
  applied_node_count: applied,
  data_class: live.data_class || "sanitized_live_metadata",
  source: livePath,
};
universe.coverage = { ...(universe.coverage || {}), live_overlay_applied_nodes: applied };
universe.coverage.live_gap_nodes = (universe.nodes || []).filter((node) => !["verified_live", "verified_current", "not_applicable"].includes(node.live_status)).length;
fs.writeFileSync(universePath, `${JSON.stringify(universe, null, 2)}\n`, "utf8");
console.log(`Architecture live overlay: fresh applied=${applied}`);
