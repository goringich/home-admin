import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const home = os.homedir();
const atlasRoot = fileURLToPath(new URL("..", import.meta.url));
const outputPath = path.join(atlasRoot, "public", "architecture-universe.json");
const candidateRoots = [
  process.env.ATLAS_ARCHITECTURE_ROOT || "",
  path.join(home, "__home_organized"),
  path.join(home, "__home_organized-observatory-pr70"),
].filter(Boolean);

function readJson(targetPath, fallback = null) {
  try { return JSON.parse(fs.readFileSync(targetPath, "utf8")); } catch { return fallback; }
}

function idSafe(value) {
  return String(value || "unknown").toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "");
}

function sourceRoot() {
  return candidateRoots.find((root) => fs.existsSync(path.join(root, "local-codex-stack", "configs", "architecture-manifest.json"))) || candidateRoots[0];
}

function layerFromManifest(value) {
  const raw = String(value || "").toLowerCase();
  if (/(memory|organizational)/.test(raw)) return 1;
  if (/(human-control|atlas|projection)/.test(raw)) return 3;
  if (/(context|retrieval|rag|cag)/.test(raw)) return 4;
  if (/(mission|planning|portfolio|commercial|product)/.test(raw)) return 5;
  if (/(governed|local-agent)/.test(raw)) return 6;
  if (/(execution|queue|model|runtime|agent)/.test(raw)) return 7;
  if (/(verification|telemetry|econom)/.test(raw)) return 8;
  if (/(sync|portability|remote)/.test(raw)) return 9;
  return 10;
}

function normalizeLive(value) {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("verified_live")) return "verified_live";
  if (raw.includes("verified")) return "verified_source_only";
  if (raw.includes("stale") || raw.includes("historical")) return "stale";
  if (raw.includes("blocked")) return "blocked_external";
  if (raw.includes("drift")) return "conflicting";
  if (raw.includes("not_applicable") || raw.includes("not_a_runtime")) return "not_applicable";
  return "unknown";
}

function repoNodeId(repository) {
  const raw = String(repository || "");
  if (!raw) return "";
  const github = raw.match(/goringich\/([^\s]+)/);
  if (github) return `repo:${idSafe(github[1])}`;
  const base = path.basename(raw.replace(/\/$/, ""));
  return base ? `repo:${idSafe(base)}` : "";
}

const root = sourceRoot();
const configs = path.join(root, "local-codex-stack", "configs");
const universe = readJson(outputPath, { nodes: [], edges: [], coverage: {}, groups: {}, kinds: {} });
const manifest = readJson(path.join(configs, "architecture-manifest.json"), { components: [], coverage: {} });
const admins = readJson(path.join(configs, "admin-surface-registry.json"), { surfaces: [] });
const tails = readJson(path.join(configs, "project-tails-registry.json"), { tracks: [] });

const nodes = new Map((universe.nodes || []).map((node) => [node.id, node]));
const edges = new Map((universe.edges || []).map((edge) => [`${edge.from}|${edge.to}|${edge.kind}`, edge]));

function addNode(node) {
  if (!node?.id) return;
  const previous = nodes.get(node.id) || {};
  nodes.set(node.id, { lifecycle_status: "discovered", live_status: "unknown", layer: 10, group: "unclassified", purpose: "Architecture entity.", ...previous, ...node, metadata: { ...(previous.metadata || {}), ...(node.metadata || {}) } });
}

function addEdge(from, to, kind, meta = {}) {
  if (!from || !to || from === to) return;
  const edge = { from, to, kind, ...meta };
  edges.set(`${from}|${to}|${kind}`, edge);
}

for (const component of manifest.components || []) {
  const id = `component:${idSafe(component.component_id)}`;
  const repositoryId = repoNodeId(component.repository);
  addNode({
    id,
    label: component.name || component.component_id,
    kind: "component",
    group: "manifest_component",
    layer: layerFromManifest(component.layer),
    lifecycle_status: component.status || "registered",
    live_status: normalizeLive(component.status),
    purpose: component.purpose || "Critical component from architecture manifest.",
    repository: component.repository || "",
    category: component.layer || "component",
    origin: "architecture_manifest",
    metadata: {
      component_id: component.component_id,
      owner: component.owner || "unknown",
      entrypoints: Array.isArray(component.entrypoints) ? component.entrypoints.slice(0, 5) : [],
      ports: Array.isArray(component.ports) ? component.ports.slice(0, 8) : [],
      systemd_units: Array.isArray(component.systemd_units) ? component.systemd_units.slice(0, 8) : [],
      timers: Array.isArray(component.timers) ? component.timers.slice(0, 8) : [],
      health_checks: Array.isArray(component.health_checks) ? component.health_checks.slice(0, 8) : [],
      failure_modes: Array.isArray(component.failure_modes) ? component.failure_modes.slice(0, 8) : [],
    },
  });
  if (repositoryId && nodes.has(repositoryId)) addEdge(id, repositoryId, "implemented_in", { origin: "architecture_manifest" });
  for (const dependency of component.dependencies || []) {
    const target = `component:${idSafe(dependency)}`;
    addEdge(id, target, "depends_on", { origin: "architecture_manifest" });
  }
}

for (const surface of admins.surfaces || []) {
  const id = `admin:${idSafe(surface.id)}`;
  const repositoryId = repoNodeId(surface.owner_repository || surface.mutation_owner);
  const availability = String(surface.availability || surface.migration_state || "unknown");
  addNode({
    id,
    label: surface.title || surface.id,
    kind: "admin_surface",
    group: "admin_surface",
    layer: surface.id === "project-atlas" ? 3 : 9,
    lifecycle_status: surface.migration_state || admins.status || "registered",
    live_status: availability.includes("attention") ? "stale" : "unknown",
    purpose: surface.operator_role || "Registered administration surface.",
    repository: surface.owner_repository || "",
    category: surface.classification || "admin_surface",
    origin: "admin_surface_registry",
    metadata: {
      ownership: surface.ownership || "unknown",
      atlas_integration: surface.atlas_integration || "unknown",
      capabilities: Array.isArray(surface.capabilities) ? surface.capabilities.slice(0, 10) : [],
      embedding_default: surface.embedding_capability?.default || "unknown",
      fallback_mode: surface.fallback_mode || "unknown",
      mutation_owner: surface.mutation_owner || "",
    },
  });
  if (repositoryId && nodes.has(repositoryId)) addEdge(id, repositoryId, "owned_by", { origin: "admin_surface_registry" });
  addEdge("project_atlas", id, surface.id === "project-atlas" ? "self_surface" : "federates", { origin: "admin_surface_registry" });
}

for (const track of tails.tracks || []) {
  const id = `tail:${idSafe(track.id)}`;
  addNode({
    id,
    label: track.title || track.id,
    kind: "work_track",
    group: "unfinished_work",
    layer: 5,
    lifecycle_status: track.status || "open",
    live_status: "unknown",
    purpose: `Closure track: ${(track.done_when || []).join("; ")}`,
    origin: "project_tails_registry",
    metadata: { done_when: track.done_when || [] },
  });
  addEdge("planner", id, "tracks_completion", { origin: "project_tails_registry" });
}

for (const rawGap of manifest.coverage?.unregistered_high_priority || []) {
  const id = `gap:${idSafe(rawGap)}`;
  addNode({
    id,
    label: rawGap,
    kind: "inventory_gap",
    group: "inventory_gap",
    layer: 10,
    lifecycle_status: "inventory_required",
    live_status: "unknown",
    purpose: "High-priority architecture census gap explicitly recorded in the critical architecture manifest.",
    origin: "architecture_manifest",
  });
  addEdge("architecture_observatory", id, "must_inventory", { origin: "architecture_manifest" });
}

const known = new Set(nodes.keys());
const edgeList = [...edges.values()].filter((edge) => known.has(edge.from) && known.has(edge.to));
const degree = new Map();
for (const edge of edgeList) {
  degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
  degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
}
const nodeList = [...nodes.values()].map((node) => ({ ...node, degree: degree.get(node.id) || 0 }));
const groups = nodeList.reduce((acc, node) => { acc[node.group] = (acc[node.group] || 0) + 1; return acc; }, {});
const kinds = nodeList.reduce((acc, node) => { acc[node.kind] = (acc[node.kind] || 0) + 1; return acc; }, {});
const liveGapNodes = nodeList.filter((node) => !["verified_live", "verified_current", "not_applicable"].includes(node.live_status)).length;

universe.nodes = nodeList;
universe.edges = edgeList;
universe.groups = groups;
universe.kinds = kinds;
universe.coverage = {
  ...(universe.coverage || {}),
  architecture_manifest_components: (manifest.components || []).length,
  administration_surfaces: (admins.surfaces || []).length,
  project_tail_tracks: (tails.tracks || []).length,
  explicit_inventory_gaps: (manifest.coverage?.unregistered_high_priority || []).length,
  total_nodes: nodeList.length,
  total_edges: edgeList.length,
  live_gap_nodes: liveGapNodes,
};
universe.enriched_at = new Date().toISOString();
universe.enrichment_status = root ? "composed" : "source_missing";

fs.writeFileSync(outputPath, `${JSON.stringify(universe, null, 2)}\n`, "utf8");
console.log(`ENRICHED ${outputPath}`);
console.log(`Architecture universe enriched: nodes=${nodeList.length} edges=${edgeList.length} components=${universe.coverage.architecture_manifest_components} admins=${universe.coverage.administration_surfaces} gaps=${universe.coverage.explicit_inventory_gaps}`);
