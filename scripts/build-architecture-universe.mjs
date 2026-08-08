import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const home = os.homedir();
const atlasRoot = fileURLToPath(new URL("..", import.meta.url));
const outputPath = path.join(atlasRoot, "public", "architecture-universe.json");
const snapshotPath = path.join(atlasRoot, "public", "snapshot.json");

const candidateRoots = [
  process.env.ATLAS_ARCHITECTURE_ROOT || "",
  path.join(home, "__home_organized"),
  path.join(home, "__home_organized-observatory-pr70"),
].filter(Boolean);

function readJson(targetPath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8"));
  } catch {
    return fallback;
  }
}

function hasArchitecture(root) {
  return fs.existsSync(path.join(root, "local-codex-stack", "configs", "architecture-observatory-v1.json"));
}

const systemRoot = candidateRoots.find(hasArchitecture) || candidateRoots[0];
const configsRoot = path.join(systemRoot, "local-codex-stack", "configs");

const base = readJson(path.join(configsRoot, "architecture-observatory-v1.json"), { layers: [], nodes: [], edges: [] });
const technologies = readJson(path.join(configsRoot, "technology-census.json"), { technologies: [] });
const satellites = readJson(path.join(configsRoot, "satellite-systems-census.json"), { systems: [] });
const repositories = readJson(path.join(configsRoot, "owner-repository-census-v1.json"), { repositories: [] });
const products = readJson(path.join(configsRoot, "product-registry.json"), { products: {} });
const snapshot = readJson(snapshotPath, { projects: [], generatedAt: "" });

const nodes = new Map();
const edges = new Map();

function idSafe(value) {
  return String(value || "unknown").toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "");
}

function edgeKey(edge) {
  return `${edge.from}|${edge.to}|${edge.kind}`;
}

function addEdge(from, to, kind, meta = {}) {
  if (!from || !to || from === to) return;
  const edge = { from, to, kind, ...meta };
  edges.set(edgeKey(edge), edge);
}

function addNode(node) {
  if (!node?.id) return;
  const previous = nodes.get(node.id) || {};
  nodes.set(node.id, {
    lifecycle_status: "discovered",
    live_status: "unknown",
    layer: 10,
    group: "unclassified",
    purpose: "Discovered architecture entity.",
    ...previous,
    ...node,
    metadata: { ...(previous.metadata || {}), ...(node.metadata || {}) },
  });
}

function normalizeLive(value) {
  const raw = String(value || "unknown").toLowerCase();
  if (raw.includes("verified_live") || raw.includes("adopted_live_verified")) return "verified_live";
  if (raw.includes("verified_current") || raw === "partially_verified") return "verified_current";
  if (raw.includes("stale") || raw.includes("historical")) return "stale";
  if (raw.includes("blocked")) return "blocked_external";
  if (raw.includes("not_a_runtime") || raw.includes("not_applicable")) return "not_applicable";
  if (raw.includes("drift") || raw.includes("conflict")) return "conflicting";
  return "unknown";
}

function layerForTechnology(category) {
  const value = String(category || "").toLowerCase();
  if (/(memory|retrieval|context|rag|knowledge)/.test(value)) return 4;
  if (/(mission|portfolio|control_plane)/.test(value)) return 5;
  if (/(agent|model|runtime|automation|queue|harness|analysis)/.test(value)) return 7;
  if (/(telemetry|observability|econom|verification|security)/.test(value)) return 8;
  if (/(sync|portability|network)/.test(value)) return 9;
  if (/(host|desktop|browser|gpu|filesystem)/.test(value)) return 10;
  return 7;
}

function layerForRepository(classification) {
  const value = String(classification || "");
  if (value === "system_core") return 3;
  if (value === "system_operational" || value === "system_tooling" || value === "system_satellite") return 7;
  if (value === "active_product" || value === "product_or_system" || value === "active_project" || value === "active_or_recent_project") return 5;
  if (value === "host_platform") return 10;
  if (value.startsWith("external")) return 5;
  return 10;
}

for (const node of base.nodes || []) {
  addNode({ ...node, group: node.kind === "product" ? "product" : node.kind === "repository" ? "repository" : "core", origin: "architecture_core" });
}
for (const edge of base.edges || []) addEdge(edge.from, edge.to, edge.kind, { origin: "architecture_core" });

for (const repo of repositories.repositories || []) {
  const repoId = `repo:${idSafe(repo.name)}`;
  const classification = repo.class || repositories.default_classification || "archive_or_unclassified";
  addNode({
    id: repoId,
    label: repo.name,
    kind: "repository",
    group: classification,
    layer: layerForRepository(classification),
    lifecycle_status: repo.archived ? "archived" : classification === "external_excluded" ? "external_excluded" : "discovered",
    live_status: classification === "external_excluded" ? "not_applicable" : "unknown",
    purpose: classification === "archive_or_unclassified" ? "Repository discovered in the owner GitHub universe; role is not yet classified." : `Repository classified as ${classification}.`,
    repository: `goringich/${repo.name}`,
    metadata: {
      visibility: repo.visibility || "unknown",
      default_branch: repo.default_branch || "unknown",
      archived: Boolean(repo.archived),
      classification,
    },
    origin: "github_repository_census",
  });
}

const baseRepoAlias = new Map([
  ["__home_organized", "repo:__home_organized"],
  ["codex-orchestrator", "repo:codex-orchestrator"],
  ["Obsidian", "repo:obsidian"],
  ["home-admin", "repo:home-admin"],
  ["telegram-proxy-stack", "repo:telegram-proxy-stack"],
  ["system-bootstrap", "repo:system-bootstrap"],
]);
for (const [name, repoId] of baseRepoAlias) {
  const baseMatch = [...nodes.values()].find((node) => node.kind === "repository" && String(node.repository || "").endsWith(`/${name}`) && node.id !== repoId);
  if (baseMatch) addEdge(baseMatch.id, repoId, "repository_identity", { origin: "composition" });
}

for (const technology of technologies.technologies || []) {
  const techId = `tech:${idSafe(technology.id || technology.name)}`;
  addNode({
    id: techId,
    label: technology.name || technology.id,
    kind: "technology",
    group: "technology",
    layer: layerForTechnology(technology.category),
    lifecycle_status: technology.source_status || "discovered",
    live_status: normalizeLive(technology.live_status),
    purpose: technology.next_action || technology.decision || "Tracked technology in the LOCAL AI OS census.",
    category: technology.category || "technology",
    metadata: {
      origin: technology.origin || "unknown",
      decision: technology.decision || "unknown",
      last_verified: technology.last_verified || "unknown",
      evidence: Array.isArray(technology.evidence) ? technology.evidence.slice(0, 6) : [],
      raw_live_status: technology.live_status || "unknown",
    },
    origin: "technology_census",
  });
  for (const evidence of technology.evidence || []) {
    const match = String(evidence).match(/repository:goringich\/([^\s]+)/);
    if (match) addEdge(techId, `repo:${idSafe(match[1])}`, "implemented_in", { origin: "technology_census" });
  }
}

for (const satellite of satellites.systems || []) {
  const satId = `sat:${idSafe(satellite.id || satellite.name)}`;
  addNode({
    id: satId,
    label: satellite.name || satellite.id,
    kind: "satellite",
    group: "satellite",
    layer: layerForTechnology(satellite.category),
    lifecycle_status: satellite.source_status || "discovered",
    live_status: normalizeLive(satellite.live_status),
    purpose: satellite.finding || satellite.next_action || "Satellite system.",
    repository: satellite.repository || "",
    category: satellite.category || "satellite",
    metadata: {
      next_action: satellite.next_action || "",
      evidence: Array.isArray(satellite.evidence) ? satellite.evidence.slice(0, 6) : [],
      raw_live_status: satellite.live_status || "unknown",
    },
    origin: "satellite_census",
  });
  const match = String(satellite.repository || "").match(/goringich\/([^\s]+)/);
  if (match) addEdge(satId, `repo:${idSafe(match[1])}`, "implemented_in", { origin: "satellite_census" });
}

for (const [productId, product] of Object.entries(products.products || {})) {
  const nodeId = `product:${idSafe(productId)}`;
  addNode({
    id: nodeId,
    label: productId,
    kind: "product",
    group: "product",
    layer: 5,
    lifecycle_status: product.status || "registered",
    live_status: "unknown",
    purpose: "Owner-approved product from Product Registry.",
    repository: product.repository || "",
    metadata: { aliases: product.aliases || [], manifest: product.manifest || "" },
    origin: "product_registry",
  });
  const repoName = path.basename(product.repository || "");
  if (repoName && nodes.has(`repo:${idSafe(repoName)}`)) addEdge(nodeId, `repo:${idSafe(repoName)}`, "implemented_in", { origin: "product_registry" });
}

for (const project of snapshot.projects || []) {
  const repoName = String(project.name || path.basename(project.repoPath || ""));
  const existingRepoId = `repo:${idSafe(repoName)}`;
  const projectId = nodes.has(existingRepoId) ? existingRepoId : `local:${idSafe(project.id || repoName)}`;
  addNode({
    id: projectId,
    label: project.title || repoName,
    kind: nodes.get(projectId)?.kind || "project",
    group: project.focus ? "active_project" : nodes.get(projectId)?.group || "local_project",
    layer: project.domain === "local-ai" || project.domain === "system" ? 7 : project.domain === "infra" ? 10 : 5,
    lifecycle_status: project.focus ? "active" : nodes.get(projectId)?.lifecycle_status || "discovered",
    live_status: project.healthTone === "ok" ? "verified_current" : project.healthTone === "risk" ? "conflicting" : "unknown",
    purpose: project.summary || nodes.get(projectId)?.purpose || "Local Atlas project.",
    repository: project.remote || nodes.get(projectId)?.repository || "",
    metadata: {
      ...(nodes.get(projectId)?.metadata || {}),
      local_path: project.repoPath || "",
      branch: project.branch || "",
      dirty_count: project.dirtyCount || 0,
      focus: Boolean(project.focus),
      domain: project.domain || "unknown",
      tags: project.tags || [],
      last_commit: project.lastCommit?.sha || "",
    },
    origin: nodes.has(existingRepoId) ? nodes.get(existingRepoId)?.origin : "atlas_local_inventory",
  });

  for (const rawTag of project.tags || []) {
    const tag = String(rawTag).trim();
    if (!tag || tag.length > 42) continue;
    const tagId = `stack:${idSafe(tag)}`;
    addNode({
      id: tagId,
      label: tag,
      kind: "technology",
      group: "detected_stack",
      layer: 7,
      lifecycle_status: "detected",
      live_status: "verified_source_only",
      purpose: "Technology/tag detected in the local Atlas project inventory.",
      category: "detected_stack",
      origin: "atlas_local_inventory",
    });
    addEdge(projectId, tagId, "uses", { origin: "atlas_local_inventory" });
  }
}

const nodeList = [...nodes.values()];
const known = new Set(nodeList.map((node) => node.id));
const edgeList = [...edges.values()].filter((edge) => known.has(edge.from) && known.has(edge.to));
const degree = new Map();
for (const edge of edgeList) {
  degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
  degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
}
for (const node of nodeList) node.degree = degree.get(node.id) || 0;

const groups = nodeList.reduce((acc, node) => {
  acc[node.group] = (acc[node.group] || 0) + 1;
  return acc;
}, {});
const kinds = nodeList.reduce((acc, node) => {
  acc[node.kind] = (acc[node.kind] || 0) + 1;
  return acc;
}, {});
const liveGaps = nodeList.filter((node) => !["verified_live", "verified_current", "not_applicable"].includes(node.live_status)).length;

const result = {
  schema_version: "2026-08-07.atlas-architecture-universe.v1",
  generated_at: new Date().toISOString(),
  source_root: systemRoot,
  source_status: hasArchitecture(systemRoot) ? "composed" : "missing_core_source",
  snapshot_generated_at: snapshot.generatedAt || "",
  coverage: {
    base_architecture_nodes: (base.nodes || []).length,
    technology_census: (technologies.technologies || []).length,
    satellite_census: (satellites.systems || []).length,
    github_repository_census: (repositories.repositories || []).length,
    registered_products: Object.keys(products.products || {}).length,
    local_atlas_projects: (snapshot.projects || []).length,
    total_nodes: nodeList.length,
    total_edges: edgeList.length,
    live_gap_nodes: liveGaps,
  },
  groups,
  kinds,
  layers: base.layers || [],
  nodes: nodeList,
  edges: edgeList,
  contracts: {
    mission_authority: "mission_ledger",
    human_mission_control: "project_atlas",
    visualization_authority: false,
    external_project_policy: "metadata_only_exclusion_before_inspection",
    source_live_separation: true,
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(`WROTE ${outputPath}`);
console.log(`Architecture universe: nodes=${nodeList.length} edges=${edgeList.length} technologies=${result.coverage.technology_census} repos=${result.coverage.github_repository_census}`);
