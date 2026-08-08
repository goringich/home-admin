import { useEffect, useMemo, useState } from "react";

type ViewMode = "universe" | "layers";
type FilterMode = "all" | "core" | "products" | "projects" | "technology" | "repositories" | "satellites" | "live-gaps" | "archive";

type ArchitectureNode = {
  id: string;
  label: string;
  kind: string;
  group: string;
  layer: number;
  lifecycle_status: string;
  live_status: string;
  purpose: string;
  repository?: string;
  category?: string;
  authority_role?: string;
  degree?: number;
  origin?: string;
  metadata?: Record<string, unknown>;
};

type ArchitectureEdge = {
  from: string;
  to: string;
  kind: string;
  origin?: string;
};

type ArchitectureUniverse = {
  schema_version: string;
  generated_at: string;
  source_root: string;
  source_status: string;
  coverage: Record<string, number>;
  groups: Record<string, number>;
  kinds: Record<string, number>;
  layers: Array<{ id: number; name?: string; label?: string }>;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  contracts: Record<string, unknown>;
};

const NAV = [
  ["01", "Обзор", "overview"],
  ["02", "Company", "company"],
  ["03", "Revenue", "revenue"],
  ["04", "AI Control", "ai-control"],
  ["05", "Проекты", "work"],
  ["06", "Запуски", "runs"],
  ["07", "Админки", "admin"],
  ["08", "Remote", "remote"],
  ["09", "Architecture", "architecture"],
] as const;

const FILTERS: Array<{ id: FilterMode; label: string }> = [
  { id: "all", label: "Everything" },
  { id: "core", label: "Core" },
  { id: "products", label: "Products" },
  { id: "projects", label: "Projects" },
  { id: "technology", label: "Technology" },
  { id: "repositories", label: "Repositories" },
  { id: "satellites", label: "Satellites" },
  { id: "live-gaps", label: "Live gaps" },
  { id: "archive", label: "Archive" },
];

const GROUP_ORDER = ["core", "product", "active_product", "product_or_system", "active_project", "active_or_recent_project", "local_project", "technology", "detected_stack", "system_core", "system_operational", "system_tooling", "system_satellite", "host_platform", "satellite", "repository", "archive_or_unclassified", "unclassified"];

function navigate(target: string) {
  window.location.hash = `#/${target}`;
}

function isGoodLive(status: string) {
  return status === "verified_live" || status === "verified_current" || status === "not_applicable";
}

function matchesFilter(node: ArchitectureNode, filter: FilterMode) {
  if (filter === "all") return true;
  if (filter === "core") return node.group === "core" || node.authority_role || node.group === "system_core";
  if (filter === "products") return node.kind === "product" || node.group.includes("product");
  if (filter === "projects") return node.kind === "project" || node.group.includes("project");
  if (filter === "technology") return node.kind === "technology";
  if (filter === "repositories") return node.kind === "repository";
  if (filter === "satellites") return node.kind === "satellite" || node.group === "system_satellite";
  if (filter === "live-gaps") return !isGoodLive(node.live_status);
  if (filter === "archive") return node.lifecycle_status === "archived" || node.group.includes("archive") || node.group === "unclassified";
  return true;
}

function searchable(node: ArchitectureNode) {
  return [node.label, node.id, node.kind, node.group, node.category, node.repository, node.lifecycle_status, node.live_status, node.purpose, JSON.stringify(node.metadata || {})].join(" ").toLowerCase();
}

function nodeTier(node: ArchitectureNode) {
  if (node.authority_role) return 0;
  if (node.group === "core" || node.group === "system_core") return 1;
  if (node.kind === "product" || node.group.includes("product") || node.group.includes("project")) return 2;
  if (node.kind === "technology" || node.kind === "satellite") return 3;
  return 4;
}

function hashNumber(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

function universePositions(nodes: ArchitectureNode[]) {
  const center = { x: 800, y: 520 };
  const rings = [90, 210, 365, 535, 700];
  const grouped = new Map<number, ArchitectureNode[]>();
  for (const node of nodes) {
    const tier = nodeTier(node);
    grouped.set(tier, [...(grouped.get(tier) || []), node]);
  }
  const result = new Map<string, { x: number; y: number }>();
  for (const [tier, items] of grouped) {
    const ring = rings[tier] || rings[4];
    const ordered = [...items].sort((a, b) => {
      const ga = GROUP_ORDER.indexOf(a.group);
      const gb = GROUP_ORDER.indexOf(b.group);
      if (ga !== gb) return ga - gb;
      return a.label.localeCompare(b.label);
    });
    ordered.forEach((node, index) => {
      const jitter = ((hashNumber(node.id) % 100) / 100 - 0.5) * (tier >= 3 ? 54 : 24);
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(ordered.length, 1) + jitter / 900;
      const radius = ring + jitter;
      result.set(node.id, { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
    });
  }
  return result;
}

function layerPositions(nodes: ArchitectureNode[]) {
  const result = new Map<string, { x: number; y: number }>();
  const byLayer = new Map<number, ArchitectureNode[]>();
  for (const node of nodes) byLayer.set(node.layer, [...(byLayer.get(node.layer) || []), node]);
  for (let layer = 0; layer <= 10; layer += 1) {
    const items = [...(byLayer.get(layer) || [])].sort((a, b) => a.label.localeCompare(b.label));
    const columns = Math.max(1, Math.ceil(items.length / 2));
    items.forEach((node, index) => {
      const row = index % 2;
      const column = Math.floor(index / 2);
      result.set(node.id, { x: 210 + column * 175, y: 92 + layer * 145 + row * 54 });
    });
    void columns;
  }
  return result;
}

function nodeClass(node: ArchitectureNode, selected: boolean, connected: boolean) {
  const classes = ["architecture-node"];
  if (node.authority_role) classes.push("architecture-node-authority");
  if (node.kind === "product") classes.push("architecture-node-product");
  if (node.kind === "technology") classes.push("architecture-node-tech");
  if (node.kind === "repository") classes.push("architecture-node-repo");
  if (node.kind === "satellite") classes.push("architecture-node-satellite");
  if (!isGoodLive(node.live_status)) classes.push("architecture-node-gap");
  if (node.lifecycle_status === "archived" || node.group.includes("archive")) classes.push("architecture-node-archive");
  if (selected) classes.push("architecture-node-selected");
  if (connected) classes.push("architecture-node-connected");
  return classes.join(" ");
}

function UniverseGraph(props: { nodes: ArchitectureNode[]; edges: ArchitectureEdge[]; selectedId: string; onSelect: (id: string) => void; zoom: number }) {
  const positions = useMemo(() => universePositions(props.nodes), [props.nodes]);
  const connected = useMemo(() => {
    const set = new Set<string>();
    if (!props.selectedId) return set;
    for (const edge of props.edges) {
      if (edge.from === props.selectedId) set.add(edge.to);
      if (edge.to === props.selectedId) set.add(edge.from);
    }
    return set;
  }, [props.edges, props.selectedId]);
  const width = 1600 / props.zoom;
  const height = 1040 / props.zoom;
  const x = (1600 - width) / 2;
  const y = (1040 - height) / 2;

  return (
    <svg className="architecture-canvas" viewBox={`${x} ${y} ${width} ${height}`} role="img" aria-label="System Universe architecture graph">
      <defs>
        <radialGradient id="universeGlow"><stop offset="0%" stopColor="var(--arch-glow)" stopOpacity="0.22"/><stop offset="100%" stopColor="var(--arch-glow)" stopOpacity="0"/></radialGradient>
        <filter id="nodeGlow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx="800" cy="520" r="760" fill="url(#universeGlow)" />
      {[90, 210, 365, 535, 700].map((r, index) => <circle key={r} className={`architecture-orbit orbit-${index}`} cx="800" cy="520" r={r} />)}
      {props.edges.map((edge) => {
        const from = positions.get(edge.from);
        const to = positions.get(edge.to);
        if (!from || !to) return null;
        const active = Boolean(props.selectedId && (edge.from === props.selectedId || edge.to === props.selectedId));
        return <line key={`${edge.from}-${edge.to}-${edge.kind}`} className={`architecture-edge ${active ? "architecture-edge-active" : ""}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
      })}
      {props.nodes.map((node) => {
        const position = positions.get(node.id);
        if (!position) return null;
        const selected = node.id === props.selectedId;
        const radius = Math.min(22, (node.authority_role ? 13 : 8) + Math.sqrt(node.degree || 0) * 1.6);
        const showLabel = selected || Boolean(node.authority_role) || (node.degree || 0) >= 4 || node.kind === "product";
        return (
          <g key={node.id} className={nodeClass(node, selected, connected.has(node.id))} transform={`translate(${position.x} ${position.y})`} onClick={() => props.onSelect(node.id)} role="button" tabIndex={0}>
            <circle className="architecture-node-halo" r={radius + 9} />
            <circle className="architecture-node-dot" r={radius} filter={selected ? "url(#nodeGlow)" : undefined} />
            {showLabel ? <text className="architecture-node-label" x={radius + 8} y="4">{node.label}</text> : null}
          </g>
        );
      })}
    </svg>
  );
}

function LayerGraph(props: { nodes: ArchitectureNode[]; edges: ArchitectureEdge[]; selectedId: string; onSelect: (id: string) => void; zoom: number }) {
  const positions = useMemo(() => layerPositions(props.nodes), [props.nodes]);
  const maxX = Math.max(1800, ...[...positions.values()].map((item) => item.x + 220));
  const width = maxX / props.zoom;
  const height = 1700 / props.zoom;
  return (
    <svg className="architecture-canvas architecture-layer-canvas" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Layer architecture graph">
      {Array.from({ length: 11 }, (_, layer) => (
        <g key={layer}>
          <rect className="architecture-layer-band" x="20" y={34 + layer * 145} width={maxX - 40} height="130" rx="18" />
          <text className="architecture-layer-label" x="42" y={66 + layer * 145}>L{layer}</text>
        </g>
      ))}
      {props.edges.map((edge) => {
        const from = positions.get(edge.from); const to = positions.get(edge.to);
        if (!from || !to) return null;
        const active = props.selectedId === edge.from || props.selectedId === edge.to;
        return <line key={`${edge.from}-${edge.to}-${edge.kind}`} className={`architecture-edge ${active ? "architecture-edge-active" : ""}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
      })}
      {props.nodes.map((node) => {
        const position = positions.get(node.id); if (!position) return null;
        const selected = node.id === props.selectedId;
        return (
          <g key={node.id} className={nodeClass(node, selected, false)} transform={`translate(${position.x} ${position.y})`} onClick={() => props.onSelect(node.id)} role="button" tabIndex={0}>
            <rect className="architecture-layer-node" x="-66" y="-19" width="132" height="38" rx="12" />
            <text className="architecture-layer-node-label" textAnchor="middle" y="4">{node.label.length > 20 ? `${node.label.slice(0, 19)}…` : node.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function ArchitectureWorkspace() {
  const [data, setData] = useState<ArchitectureUniverse | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<ViewMode>("universe");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    fetch("/architecture-universe.json", { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error(`architecture: ${response.status}`); return response.json(); })
      .then((payload: ArchitectureUniverse) => setData(payload))
      .catch((reason) => setError(String(reason)));
  }, []);

  const visibleNodes = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.nodes.filter((node) => matchesFilter(node, filter) && (!needle || searchable(node).includes(needle)));
  }, [data, filter, query]);
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => (data?.edges || []).filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to)), [data, visibleIds]);
  const selected = data?.nodes.find((node) => node.id === selectedId) || null;
  const selectedEdges = selected ? (data?.edges || []).filter((edge) => edge.from === selected.id || edge.to === selected.id) : [];

  if (error) return <main className="boot-state">Architecture Universe: {error}</main>;
  if (!data) return <main className="boot-state">Собираю Architecture Universe…</main>;

  return (
    <div className="atlas-shell architecture-atlas-shell">
      <aside className="sidebar architecture-sidebar">
        <button className="brand brand-button" type="button" onClick={() => navigate("overview")}>
          <div className="brand-mark">A</div><div><div className="brand-name">PROJECT ATLAS</div><div className="brand-subtitle">architecture universe</div></div>
        </button>
        <div className="sidebar-caption"><span>WORKSPACES</span><small>Architecture is native Atlas</small></div>
        <nav className="sidebar-nav" aria-label="Atlas workspaces">
          {NAV.map(([glyph, label, target]) => <button key={target} className={`nav-item ${target === "architecture" ? "nav-item-active" : ""}`} type="button" onClick={() => navigate(target)}><span className="nav-glyph">{glyph}</span><span className="nav-copy"><strong>{label}</strong><small>{target === "architecture" ? "Full system map" : target}</small></span></button>)}
        </nav>
        <section className="sidebar-status">
          <div><span className="sync-dot"/><span>Nodes</span><strong>{data.coverage.total_nodes}</strong></div>
          <div><span className={`sync-dot ${data.coverage.live_gap_nodes ? "sync-dot-warn" : ""}`}/><span>Live gaps</span><strong>{data.coverage.live_gap_nodes}</strong></div>
        </section>
      </aside>

      <div className="main-frame architecture-main-frame">
        <header className="topbar architecture-topbar">
          <div className="workspace-breadcrumb"><span>System</span><div><strong>Architecture</strong><small>Whole AI Company / LOCAL AI OS universe</small></div></div>
          <div className="architecture-mode-switch">
            <button type="button" className={mode === "universe" ? "architecture-mode-active" : ""} onClick={() => setMode("universe")}>System Universe</button>
            <button type="button" className={mode === "layers" ? "architecture-mode-active" : ""} onClick={() => setMode("layers")}>Layer Map</button>
          </div>
          <div className="architecture-zoom"><button type="button" onClick={() => setZoom((value) => Math.max(.55, value - .15))}>−</button><strong>{Math.round(zoom * 100)}%</strong><button type="button" onClick={() => setZoom((value) => Math.min(1.9, value + .15))}>+</button></div>
        </header>

        <main className="workspace-main architecture-workspace">
          <section className="architecture-hero">
            <div><div className="section-kicker">Atlas / Architecture</div><h1>The whole system, not a partial diagram.</h1><p>Core authorities, active products, projects, repositories, technologies, agents, satellites and historical surfaces are composed into one evidence-aware universe.</p></div>
            <div className="architecture-coverage-grid">
              <div><strong>{data.coverage.total_nodes}</strong><span>nodes</span></div>
              <div><strong>{data.coverage.total_edges}</strong><span>relations</span></div>
              <div><strong>{data.coverage.technology_census}</strong><span>technologies</span></div>
              <div><strong>{data.coverage.github_repository_census}</strong><span>GitHub repos</span></div>
              <div><strong>{data.coverage.satellite_census}</strong><span>satellites</span></div>
              <div className={data.coverage.live_gap_nodes ? "architecture-metric-warn" : ""}><strong>{data.coverage.live_gap_nodes}</strong><span>live gaps</span></div>
            </div>
          </section>

          <section className="architecture-controls">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project, technology, service, repository, status…" aria-label="Search architecture" />
            <div className="architecture-filter-row">{FILTERS.map((item) => <button key={item.id} type="button" className={filter === item.id ? "architecture-filter-active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
            <div className="architecture-result-count">{visibleNodes.length} nodes · {visibleEdges.length} visible relations</div>
          </section>

          <section className="architecture-stage">
            <div className="architecture-graph-panel">
              {mode === "universe" ? <UniverseGraph nodes={visibleNodes} edges={visibleEdges} selectedId={selectedId} onSelect={setSelectedId} zoom={zoom} /> : <LayerGraph nodes={visibleNodes} edges={visibleEdges} selectedId={selectedId} onSelect={setSelectedId} zoom={zoom} />}
              <div className="architecture-legend"><span><i className="legend-authority"/>authority</span><span><i className="legend-product"/>product</span><span><i className="legend-tech"/>technology</span><span><i className="legend-repo"/>repository</span><span><i className="legend-gap"/>live gap</span></div>
            </div>
            <aside className="architecture-inspector">
              {selected ? <>
                <div className="section-kicker">Node inspector</div><h2>{selected.label}</h2><p>{selected.purpose}</p>
                <div className="architecture-facts">
                  <div><span>kind</span><strong>{selected.kind}</strong></div><div><span>group</span><strong>{selected.group}</strong></div><div><span>layer</span><strong>L{selected.layer}</strong></div><div><span>lifecycle</span><strong>{selected.lifecycle_status}</strong></div><div><span>live</span><strong className={!isGoodLive(selected.live_status) ? "architecture-text-warn" : ""}>{selected.live_status}</strong></div><div><span>degree</span><strong>{selected.degree || 0}</strong></div>{selected.authority_role ? <div><span>authority</span><strong>{selected.authority_role}</strong></div> : null}{selected.repository ? <div><span>repository</span><strong>{selected.repository}</strong></div> : null}{selected.origin ? <div><span>source</span><strong>{selected.origin}</strong></div> : null}
                </div>
                <div className="architecture-connection-list"><div className="detail-card-title">Connections</div>{selectedEdges.slice(0, 20).map((edge) => { const otherId = edge.from === selected.id ? edge.to : edge.from; const other = data.nodes.find((node) => node.id === otherId); return <button key={`${edge.from}-${edge.to}-${edge.kind}`} type="button" onClick={() => setSelectedId(otherId)}><span>{edge.kind}</span><strong>{other?.label || otherId}</strong></button>; })}{selectedEdges.length === 0 ? <p>No visible connections.</p> : null}</div>
              </> : <><div className="section-kicker">Node inspector</div><h2>Select any object</h2><p>Click a node to isolate its role, state, ownership and immediate dependency neighborhood.</p><div className="architecture-inspector-tip">Tip: start with Mission Ledger, Project Atlas, Codex Orchestrator, Obsidian, a product, or switch to Live gaps.</div></>}
            </aside>
          </section>
          <footer className="architecture-source-line">Generated {new Date(data.generated_at).toLocaleString()} · source {data.source_status} · runtime UI authority: none · Mission Control authority remains Project Atlas.</footer>
        </main>
      </div>
    </div>
  );
}
