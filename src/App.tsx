import { useEffect, useMemo, useState } from "react";
import type {
  AiTelemetryExport,
  CommercialReadiness,
  DetailTab,
  HealthTone,
  HostAudit,
  LocalAiControl,
  LocalCodexGoalCapsule,
  LocalCodexLab,
  LocalCodexRunSummary,
  ProjectDomain,
  ProjectRecord,
  Snapshot,
  SourceMeta,
  TaskItem,
  TaskStatus,
} from "./types";

const NAV_ITEMS = [
  { id: "command-deck", label: "Command Deck" },
  { id: "local-codex", label: "Codex Lab" },
  { id: "reliability", label: "Reliability" },
  { id: "remote-ops", label: "Remote Ops" },
  { id: "project-map", label: "Projects" },
  { id: "registry", label: "Registry" },
];

const DETAIL_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: "overview", label: "Обзор" },
  { id: "architecture", label: "Архитектура" },
  { id: "deploy", label: "Деплой" },
  { id: "tasks", label: "Задачи" },
  { id: "docs", label: "Документы" },
];

const DOMAIN_LABELS: Record<ProjectDomain, string> = {
  product: "Продукт",
  infra: "Инфра",
  system: "Система",
  "local-ai": "Local AI",
  embedded: "Embedded",
  study: "Учёба",
  tooling: "Tooling",
  external: "Внешний",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  planned: "Сделать",
  active: "В работе",
  review: "На проверке",
  blocked: "Блокировано",
  done: "Готово",
};

const HEALTH_LABELS: Record<HealthTone, string> = {
  ok: "Здорово",
  attention: "Внимание",
  risk: "Риск",
  unknown: "Неизвестно",
};

type FallbackReadinessState =
  | "not-ready"
  | "partial"
  | "ready-for-safe-tasks"
  | "ready-with-review"
  | "blocked-by-host-health";

type MissionState = {
  activeGoal: LocalCodexGoalCapsule | null;
  nextAction: string;
  tokenLabel: string;
  tokenTone: HealthTone;
  tokenDetail: string;
  openclawLabel: string;
  openclawTone: HealthTone;
  openclawDetail: string;
  fallbackState: FallbackReadinessState;
  fallbackTone: HealthTone;
  fallbackLabel: string;
  fallbackSummary: string;
  biggestRisk: string;
  biggestRiskTone: HealthTone;
  localAiSummary: string;
  safeTaskAnswer: string;
  dominantFailure: string;
  riskItems: string[];
  planner: string;
  coder: string;
  reviewer: string;
  sandboxStatus: string;
  repoIntelStatus: string;
  benchmarkStatus: string;
  escalationPacketStatus: string;
  nextFallbackStep: string;
};

type AtlasTheme = "dark" | "light" | "contrast";

const DEFAULT_THEME: AtlasTheme = "dark";
const THEME_STORAGE_KEY = "project-atlas-theme";
const THEME_OPTIONS: Array<{ value: AtlasTheme; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "contrast", label: "High Contrast" },
];

function isAtlasTheme(value: string | null): value is AtlasTheme {
  return value === "dark" || value === "light" || value === "contrast";
}

function readInitialTheme(): AtlasTheme {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isAtlasTheme(stored) ? stored : DEFAULT_THEME;
}

function applyTheme(theme: AtlasTheme) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
}

applyTheme(readInitialTheme());

function ThemeSwitcher(props: {
  theme: AtlasTheme;
  onChange: (theme: AtlasTheme) => void;
}) {
  return (
    <div className="theme-switcher" role="group" aria-label="Theme switcher">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          className={`theme-button ${props.theme === option.value ? "theme-button-active" : ""}`}
          type="button"
          onClick={() => props.onChange(option.value)}
          aria-pressed={props.theme === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type RemoteControlState = {
  generatedAt: string;
  access: {
    atlasTunnel: string;
    sshLan: string;
    sshTailscale: string;
    vncTunnel: string;
    wol: string;
    lanIp: string;
    tailscaleIp: string;
    yadroIp: string;
    wolMac: string;
  };
  monitor: {
    name: string;
    width: number;
    height: number;
    scale: number;
    refreshRate: number;
    modeLabel: string;
    nativeMode: string;
    remoteSafeMode: string;
    remoteSafeActive: boolean;
  } | null;
  services: {
    atlas: string;
    devApi: string;
    devTunnel: string;
    wayvnc: string;
  };
  wayvnc: {
    active: boolean;
    process: string;
    listen: string;
  };
  wakeOnLan: {
    interface: string;
    wakeMode: string;
    wakeupState: string;
  };
  notes: string[];
};

const REMOTE_ALTERNATIVES = [
  {
    name: "Sunshine + Moonlight",
    href: "https://docs.lizardbyte.dev/projects/sunshine/latest/",
    note: "Лучший вариант для full desktop, когда нужен адаптивный поток под экран клиента, а не тупой стрим ultrawide 1:1.",
  },
  {
    name: "RustDesk",
    href: "https://rustdesk.com/",
    note: "Самый простой cross-platform fallback, если нужен привычный remote desktop без отдельной VNC-сборки.",
  },
  {
    name: "Apache Guacamole",
    href: "https://guacamole.apache.org/",
    note: "Чистый browser gateway для SSH/VNC. Удобен без клиента, но для насыщенного GUI уступает нативному стриму.",
  },
];

function fmtRelative(dateMs?: number | null) {
  if (!dateMs) {
    return "нет данных";
  }
  const diffHours = Math.max(0, Math.round((Date.now() - dateMs) / 36e5));
  if (diffHours < 1) return "только что";
  if (diffHours < 24) return `${diffHours} ч назад`;
  const days = Math.round(diffHours / 24);
  if (days < 30) return `${days} дн назад`;
  return `${Math.round(days / 30)} мес назад`;
}

function toneClass(tone: HealthTone | string) {
  if (tone.startsWith("tone-")) return tone;
  if (tone === "ok") return "tone-ok";
  if (tone === "attention") return "tone-attention";
  if (tone === "risk") return "tone-risk";
  return "tone-muted";
}

function serviceToneClass(state: string) {
  if (state === "active") return "tone-ok";
  if (state === "activating" || state === "reloading") return "tone-attention";
  if (state === "failed" || state === "inactive") return "tone-risk";
  return "tone-muted";
}

function goalToneClass(status: string) {
  if (status === "derived") return "tone-muted";
  if (status === "blocked") return "tone-risk";
  if (status === "active" || status === "usage_limited") return "tone-attention";
  return "tone-ok";
}

function compactPath(target: string) {
  return target.replace("/home/goringich/", "~/");
}

function compactHash(value: string, head = 12) {
  if (!value) {
    return "missing";
  }
  if (value.length <= head) {
    return value;
  }
  return `${value.slice(0, head)}...`;
}

function compactObjective(value: string, limit = 180) {
  const singleLine = value.replace(/\s+/g, " ").trim();
  if (singleLine.length <= limit) {
    return singleLine;
  }
  const shortened = singleLine.slice(0, limit);
  return `${shortened.slice(0, shortened.lastIndexOf(" "))}...`;
}

function fmtInteger(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "missing";
  }
  return new Intl.NumberFormat("en-US").format(value);
}

function fmtUsd(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "missing";
  }
  return `$${value.toFixed(4)}`;
}

function fmtRatio(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "missing";
  }
  return value.toFixed(2);
}

function accountDisplay(entry: {
  account_label?: string;
  account_email?: string;
  account_id?: string;
}) {
  const email = entry.account_email && entry.account_email !== "unknown" ? entry.account_email : "";
  const label = entry.account_label && entry.account_label !== "unknown" ? entry.account_label : "";
  const accountId = entry.account_id && entry.account_id !== "unknown" ? entry.account_id : "";
  return email || label || (accountId ? `account-${compactHash(accountId, 8)}` : "unknown");
}

function verificationTone(status?: string): HealthTone {
  if (status === "verified" || status === "success") return "ok";
  if (status === "blocked" || status === "failed") return "risk";
  return "attention";
}

function guardrailTone(status?: string): HealthTone {
  if (status === "clear" || status === "success") return "ok";
  if (status === "blocked" || status === "failed") return "risk";
  return "attention";
}

function hermesRuntimeTone(state?: string): HealthTone {
  if (state === "selected") return "ok";
  if (state === "fallback_used" || state === "staged" || state === "available") return "attention";
  if (state === "failed" || state === "missing") return "risk";
  return "unknown";
}

function sourceAge(source: SourceMeta) {
  return source.modifiedAtMs ? fmtRelative(source.modifiedAtMs) : "нет данных";
}

function taskPriorityClass(priority: TaskItem["priority"]) {
  if (priority === "high") return "priority-high";
  if (priority === "medium") return "priority-medium";
  return "priority-low";
}

function statusToneForReadiness(state: FallbackReadinessState): HealthTone {
  if (state === "blocked-by-host-health") return "risk";
  if (state === "partial" || state === "not-ready") return "attention";
  return "ok";
}

function severityTone(severity: string): HealthTone {
  return severity === "warn" ? "risk" : "attention";
}

function telemetryStatusTone(status: string): HealthTone {
  if (status === "ok") return "ok";
  if (status === "missing") return "attention";
  return "unknown";
}

function commercialTone(status: string): HealthTone {
  if (status === "ready_for_live_checks") return "ok";
  if (status === "scaffolded_waiting_for_live_checks") return "attention";
  return "risk";
}

function topReliabilityClass(classifications: Record<string, number>) {
  return Object.entries(classifications)
    .filter(([name, count]) => count > 0 && name !== "completed" && name !== "partial")
    .sort((left, right) => right[1] - left[1])[0];
}

function deriveMissionState(snapshot: Snapshot): MissionState {
  const lab = snapshot.localCodexLab;
  const activeGoal =
    lab.goalCapsules.find((capsule) => capsule.status === "active" || capsule.status === "usage_limited") ??
    lab.goalCapsules.find((capsule) => capsule.status !== "derived") ??
    lab.goalCapsules[0] ??
    null;
  const dominantFailure = topReliabilityClass(lab.openclawReliability.classifications);
  const tokenPressure =
    lab.tokenEfficiency.repeatedHealthGateCount +
    lab.tokenEfficiency.filesWithNoAssistantReply +
    lab.tokenEfficiency.bridgeNoiseFiles;
  let tokenTone: HealthTone = "ok";
  let tokenLabel = "compact-path-on";
  let tokenDetail = `${lab.retrievalPolicy.denylistedFiles} denylisted · ${lab.tokenEfficiency.longGoalRuns} long runs`;

  if (tokenPressure >= 280) {
    tokenTone = "risk";
    tokenLabel = "waste-high";
    tokenDetail = `${lab.tokenEfficiency.repeatedHealthGateCount} repeated health gates · ${lab.tokenEfficiency.filesWithNoAssistantReply} no-reply files`;
  } else if (tokenPressure >= 170) {
    tokenTone = "attention";
    tokenLabel = "improving";
    tokenDetail = `${lab.tokenEfficiency.bridgeNoiseFiles} bridge-noise files · denylist is active`;
  }

  let openclawTone: HealthTone = "ok";
  let openclawLabel = "stable";
  let openclawDetail = `${lab.openclawReliability.warningCount} warnings`;

  if (lab.openclawReliability.warningCount >= 10) {
    openclawTone = "risk";
    openclawLabel = "warning-heavy";
    openclawDetail = dominantFailure ? `${dominantFailure[0]} dominates (${dominantFailure[1]})` : openclawDetail;
  } else if (lab.openclawReliability.warningCount > 0) {
    openclawTone = "attention";
    openclawLabel = "needs-review";
    openclawDetail = dominantFailure ? `${dominantFailure[0]} ${dominantFailure[1]}` : openclawDetail;
  }

  const hostBlocked = snapshot.system.safeMode || snapshot.system.overall !== "ok" || lab.hostHealth !== "ok";
  let fallbackState: FallbackReadinessState = "not-ready";
  let fallbackLabel = "not-ready";
  let fallbackSummary = "Local fallback still lacks a trustworthy host and review path.";

  if (hostBlocked) {
    fallbackState = "blocked-by-host-health";
    fallbackLabel = "blocked-by-host-health";
    fallbackSummary = "Local fallback is intentionally limited while the host remains degraded.";
  } else if (lab.repoIntel.targetCount >= 3 && lab.openclawReliability.warningCount === 0) {
    fallbackState = "ready-for-safe-tasks";
    fallbackLabel = "ready-for-safe-tasks";
    fallbackSummary = "Compact artifacts and repo intel are ready for bounded local tasks.";
  } else if (lab.repoIntel.targetCount >= 3) {
    fallbackState = "ready-with-review";
    fallbackLabel = "ready-with-review";
    fallbackSummary = "The local stack can assist on safe work, but human or Codex review is still required.";
  } else if (lab.repoIntel.targetCount > 0) {
    fallbackState = "partial";
    fallbackLabel = "partial";
    fallbackSummary = "Some fallback surfaces are wired, but the role split is still incomplete.";
  }

  const fallbackTone = statusToneForReadiness(fallbackState);
  const biggestRisk = hostBlocked
    ? snapshot.system.topIssue
    : lab.openclawReliability.warningCount > 0
      ? `OpenClaw trust surface is still broader than the tracked target policy.`
      : `Repo-intel and run-summary surfaces still need a tighter local worker loop.`;

  const riskItems = [
    activeGoal?.knownBlockers[0] || "",
    lab.openclawReliability.recommendedActions[0] || "",
    snapshot.system.topIssue || "",
  ].filter(Boolean);

  return {
    activeGoal,
    nextAction:
      activeGoal?.nextAction ||
      lab.runSummaries[0]?.nextAction ||
      "Refresh local artifacts and verify the next bounded task.",
    tokenLabel,
    tokenTone,
    tokenDetail,
    openclawLabel,
    openclawTone,
    openclawDetail,
    fallbackState,
    fallbackTone,
    fallbackLabel,
    fallbackSummary,
    biggestRisk,
    biggestRiskTone: hostBlocked || lab.openclawReliability.warningCount >= 10 ? "risk" : "attention",
    localAiSummary: hostBlocked
      ? "Host degraded, GPU path is live, but autonomy claims stay conservative."
      : "Local AI runtime is available for bounded support work.",
    safeTaskAnswer:
      fallbackState === "ready-for-safe-tasks" || fallbackState === "ready-with-review"
        ? "Да, для bounded задач с review."
        : "Пока нет, только частичный или blocked fallback.",
    dominantFailure: dominantFailure ? `${dominantFailure[0]} (${dominantFailure[1]})` : "none",
    riskItems,
    planner: lab.modelRouting.planning || "missing",
    coder: lab.modelRouting.balanced || "missing",
    reviewer: "manual review / Codex escalation",
    sandboxStatus: hostBlocked ? "degraded host; no broader autonomy" : "bounded-only",
    repoIntelStatus: `${lab.repoIntel.targetCount} safe targets indexed`,
    benchmarkStatus:
      lab.repoIntel.targetCount > 0 ? "baseline routing only; no live benchmark panel yet" : "missing",
    escalationPacketStatus:
      lab.goalCapsules.length > 0 && lab.runSummaries.length > 0
        ? "goal capsules + run summaries available"
        : "missing",
    nextFallbackStep: hostBlocked
      ? "Clear host degradation, then verify planner -> coder -> review on a safe Atlas task."
      : activeGoal?.nextAction || "Verify a bounded local worker flow with repo intel attached.",
  };
}

function miniSparkline(values: number[]) {
  const width = 96;
  const height = 26;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / Math.max(max - min, 1)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={points} />
    </svg>
  );
}

function MetricCard(props: { label: string; value: string | number; detail: string }) {
  return (
    <article className="metric-card">
      <div className="metric-label">{props.label}</div>
      <div className="metric-value">{props.value}</div>
      <div className="metric-detail">{props.detail}</div>
    </article>
  );
}

function StatusBadge(props: { label: string; tone: HealthTone | string }) {
  return <span className={`health-pill ${toneClass(props.tone)}`}>{props.label}</span>;
}

function ProjectNode(props: {
  project: ProjectRecord;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const { project, active, onSelect } = props;
  const position = project.position ?? { x: 0, y: 0 };

  return (
    <button
      className={`project-node ${active ? "project-node-active" : ""}`}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      onClick={() => onSelect(project.id)}
      type="button"
    >
      <div className="project-node-head">
        <div>
          <div className="project-node-name">{project.name}</div>
          <div className="project-node-tags">
            {project.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="chip chip-subtle">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <span className={`health-pill ${toneClass(project.healthTone)}`}>
          {HEALTH_LABELS[project.healthTone]}
        </span>
      </div>
      <div className="project-node-meta">
        <span>{project.branch}</span>
        <span>dirty {project.dirtyCount}</span>
        <span>{project.deploy?.environment ?? "local"}</span>
      </div>
      <div className="project-node-footer">
        <span>{fmtRelative(project.lastCommit.timestamp)}</span>
        {miniSparkline(project.sparkline)}
      </div>
    </button>
  );
}

function GraphLinks(props: { projects: ProjectRecord[] }) {
  const lookup = new Map(props.projects.map((project) => [project.id, project]));
  const edges = props.projects.flatMap((project) =>
    project.related
      .filter((target) => lookup.has(target) && project.id < target)
      .map((target) => ({ from: project, to: lookup.get(target)! })),
  );

  return (
    <svg className="graph-links" viewBox="0 0 100 100" preserveAspectRatio="none">
      {edges.map((edge) => {
        const from = edge.from.position ?? { x: 0, y: 0 };
        const to = edge.to.position ?? { x: 0, y: 0 };
        const startX = from.x + 9;
        const startY = from.y + 7;
        const endX = to.x + 9;
        const endY = to.y + 7;
        const bend = (startX + endX) / 2;

        return (
          <path
            key={`${edge.from.id}-${edge.to.id}`}
            d={`M ${startX} ${startY} C ${bend} ${startY}, ${bend} ${endY}, ${endX} ${endY}`}
          />
        );
      })}
    </svg>
  );
}

function copyText(value: string) {
  return navigator.clipboard.writeText(value);
}

function normalizeOpenTarget(target: string) {
  if (target.startsWith("/")) {
    return `file://${target}`;
  }
  return target;
}

async function openHostTarget(target: string) {
  const response = await fetch("./api/open", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ target: normalizeOpenTarget(target) }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

function QuickActionRow(props: {
  label: string;
  value: string;
  href?: string;
  onOpen?: () => void;
  openLabel?: string;
  onCopy?: () => void;
}) {
  return (
    <div className="quick-row">
      <div>
        <div className="quick-row-label">{props.label}</div>
        <div className="quick-row-value">{props.value}</div>
      </div>
      <div className="quick-row-actions">
        {props.href || props.onOpen ? (
          <button
            className="ghost-action"
            type="button"
            onClick={
              props.onOpen ??
              (() => {
                if (props.href) {
                  window.open(props.href, "_blank", "noopener,noreferrer");
                }
              })
            }
          >
            {props.openLabel ?? "открыть"}
          </button>
        ) : null}
        {props.onCopy ? (
          <button className="ghost-action" type="button" onClick={props.onCopy}>
            copy
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RemoteOpsPanel(props: {
  state: RemoteControlState | null;
  busy: boolean;
  onAction: (action: string) => void;
  onCopy: (label: string, value: string) => void;
  onRefresh: () => void;
}) {
  if (!props.state) {
    return (
      <section className="remote-ops panel">
        <div className="panel-head">
          <div>
            <div className="section-kicker">Remote ops</div>
            <h3>Удалённое управление этой машиной</h3>
          </div>
        </div>
        <div className="boot-state remote-loading">Собираю live remote state…</div>
      </section>
    );
  }

  const { access, monitor, services, wayvnc, wakeOnLan, notes } = props.state;

  return (
    <section className="remote-ops panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Remote ops</div>
          <h3>Удалённое управление этой машиной</h3>
        </div>
        <div className="panel-hint">обновлено {fmtRelative(new Date(props.state.generatedAt).getTime())}</div>
      </div>

      <div className="remote-ops-grid">
        <div className="remote-ops-main">
          <div className="remote-service-grid">
            <article className="remote-service-card">
              <span>Atlas host</span>
              <strong>{services.atlas}</strong>
              <p>локальный control plane на `127.0.0.1:4174`</p>
              <span className={`health-pill ${serviceToneClass(services.atlas)}`}>{services.atlas}</span>
            </article>
            <article className="remote-service-card">
              <span>Dev API</span>
              <strong>{services.devApi}</strong>
              <p>launcher/runtime bridge для Codex и OpenClaw</p>
              <span className={`health-pill ${serviceToneClass(services.devApi)}`}>{services.devApi}</span>
            </article>
            <article className="remote-service-card">
              <span>Dev tunnel</span>
              <strong>{services.devTunnel}</strong>
              <p>старый reverse SSH bridge, сейчас отдельная зона риска</p>
              <span className={`health-pill ${serviceToneClass(services.devTunnel)}`}>{services.devTunnel}</span>
            </article>
            <article className="remote-service-card">
              <span>wayvnc</span>
              <strong>{services.wayvnc}</strong>
              <p>{wayvnc.active ? `слушает ${wayvnc.listen}` : "fallback desktop stream выключен"}</p>
              <span className={`health-pill ${serviceToneClass(services.wayvnc)}`}>{services.wayvnc}</span>
            </article>
          </div>

          <div className="remote-actions">
            <button className="primary-button" type="button" disabled={props.busy} onClick={() => props.onAction("remote_safe_on")}>
              Remote-safe {monitor?.remoteSafeMode || "1080p"}
            </button>
            <button className="ghost-button" type="button" disabled={props.busy} onClick={() => props.onAction("remote_safe_off")}>
              Вернуть {monitor?.nativeMode || "native"}
            </button>
            <button className="ghost-button" type="button" disabled={props.busy} onClick={() => props.onAction("wayvnc_start")}>
              Поднять wayvnc
            </button>
            <button className="ghost-button" type="button" disabled={props.busy} onClick={() => props.onAction("wayvnc_stop")}>
              Остановить wayvnc
            </button>
            <button className="ghost-button" type="button" disabled={props.busy} onClick={() => props.onAction("dev_bridge_restart")}>
              Перезапустить dev tunnel
            </button>
            <button className="ghost-button" type="button" disabled={props.busy} onClick={props.onRefresh}>
              Обновить remote state
            </button>
          </div>

          <div className="remote-command-stack">
            <QuickActionRow label="Atlas tunnel" value={access.atlasTunnel} onCopy={() => props.onCopy("Atlas tunnel", access.atlasTunnel)} />
            {access.sshTailscale ? (
              <QuickActionRow label="SSH over Tailscale" value={access.sshTailscale} onCopy={() => props.onCopy("SSH Tailscale", access.sshTailscale)} />
            ) : null}
            {access.sshLan ? (
              <QuickActionRow label="SSH over LAN" value={access.sshLan} onCopy={() => props.onCopy("SSH LAN", access.sshLan)} />
            ) : null}
            <QuickActionRow label="VNC tunnel" value={access.vncTunnel} onCopy={() => props.onCopy("VNC tunnel", access.vncTunnel)} />
            {access.wol ? <QuickActionRow label="Wake-on-LAN" value={access.wol} onCopy={() => props.onCopy("Wake-on-LAN", access.wol)} /> : null}
          </div>
        </div>

        <aside className="remote-sidecar">
          <section className="rail-card">
            <div className="rail-title">Монитор</div>
            <div className="system-grid">
              <div>
                <span>screen</span>
                <strong>{monitor?.name || "n/a"}</strong>
              </div>
              <div>
                <span>mode</span>
                <strong>{monitor?.modeLabel || "n/a"}</strong>
              </div>
              <div>
                <span>scale</span>
                <strong>{monitor ? `${monitor.scale.toFixed(2)}x` : "n/a"}</strong>
              </div>
              <div>
                <span>remote-safe</span>
                <strong>{monitor?.remoteSafeActive ? "ON" : "OFF"}</strong>
              </div>
            </div>
            <p className="system-note">
              {monitor?.remoteSafeActive
                ? "Сейчас экран уже в laptop-friendly режиме."
                : "Для мелких ноутбуков сначала переключайся в remote-safe mode, потом уже цепляй full desktop."}
            </p>
          </section>

          <section className="rail-card">
            <div className="rail-title">Сеть и WOL</div>
            <div className="system-grid">
              <div>
                <span>tailscale</span>
                <strong>{access.tailscaleIp || "n/a"}</strong>
              </div>
              <div>
                <span>lan</span>
                <strong>{access.lanIp || "n/a"}</strong>
              </div>
              <div>
                <span>wake</span>
                <strong>{wakeOnLan.wakeMode || "n/a"}</strong>
              </div>
              <div>
                <span>iface</span>
                <strong>{wakeOnLan.interface}</strong>
              </div>
            </div>
            <p className="system-note">MAC {access.wolMac || "unknown"} · wakeup {wakeOnLan.wakeupState || "unknown"}.</p>
          </section>

          <section className="rail-card">
            <div className="rail-title">Если нужен аналог</div>
            <div className="alt-tool-list">
              {REMOTE_ALTERNATIVES.map((item) => (
                <article key={item.name} className="alt-tool-card">
                  <strong>{item.name}</strong>
                  <p>{item.note}</p>
                  <a href={item.href} target="_blank" rel="noreferrer">
                    docs
                  </a>
                </article>
              ))}
            </div>
          </section>

          <section className="rail-card">
            <div className="rail-title">Операционный контур</div>
            <div className="remote-note-list">
              {notes.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function SourceFootnote(props: {
  source: SourceMeta;
  label: string;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  if (!props.source.path) {
    return <div className="source-footnote">Источник не найден</div>;
  }

  return (
    <div className="source-footnote">
      <span>{props.label}</span>
      <button type="button" className="ghost-action" onClick={() => props.onOpen(props.label, props.source.path)}>
        source
      </button>
      <button type="button" className="ghost-action" onClick={() => props.onCopy(props.label, props.source.path)}>
        copy
      </button>
      <code>{compactPath(props.source.path)}</code>
      <span>{sourceAge(props.source)}</span>
    </div>
  );
}

function CommandDeckPanel(props: {
  snapshot: Snapshot;
  mission: MissionState;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  const { mission, snapshot } = props;

  return (
    <section id="command-deck" className="command-deck panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Mission Control</div>
          <h3>Command Deck</h3>
          <p>Первый экран должен отвечать, что делать дальше, насколько надёжен локальный стек и где самый большой риск.</p>
        </div>
        <StatusBadge label={mission.fallbackLabel} tone={mission.fallbackTone} />
      </div>

      <div className="command-deck-grid">
        <div className="command-deck-main">
          <article className="answer-card answer-card-lead">
            <div className="answer-card-head">
              <div>
                <div className="answer-label">Current active goal</div>
                <h2>{mission.activeGoal ? compactObjective(mission.activeGoal.objective) : "Goal capsule missing"}</h2>
              </div>
              {mission.activeGoal ? <StatusBadge label={mission.activeGoal.status} tone={goalToneClass(mission.activeGoal.status)} /> : null}
            </div>
            <p>{mission.localAiSummary}</p>
            <div className="answer-action-row">
              <MetricCard label="Next exact action" value="Now" detail={mission.nextAction} />
              <MetricCard label="Can local handle safe tasks?" value={mission.safeTaskAnswer} detail={mission.fallbackSummary} />
            </div>
            {mission.activeGoal ? (
              <SourceFootnote
                source={mission.activeGoal.source}
                label={`goal ${mission.activeGoal.goalId}`}
                onOpen={props.onOpen}
                onCopy={props.onCopy}
              />
            ) : (
              <SourceFootnote
                source={snapshot.localCodexLab.source}
                label="local codex lab"
                onOpen={props.onOpen}
                onCopy={props.onCopy}
              />
            )}
          </article>

          <div className="answer-grid">
            <article className="answer-card">
              <div className="answer-label">Is local AI healthy?</div>
              <div className="answer-value">
                <StatusBadge label={snapshot.localCodexLab.hostHealth} tone={snapshot.system.overall === "ok" ? "ok" : "risk"} />
              </div>
              <p>{mission.localAiSummary}</p>
            </article>

            <article className="answer-card">
              <div className="answer-label">Is Codex wasting tokens?</div>
              <div className="answer-value">
                <StatusBadge label={mission.tokenLabel} tone={mission.tokenTone} />
              </div>
              <p>{mission.tokenDetail}</p>
            </article>

            <article className="answer-card">
              <div className="answer-label">Is OpenClaw reliable right now?</div>
              <div className="answer-value">
                <StatusBadge label={mission.openclawLabel} tone={mission.openclawTone} />
              </div>
              <p>{mission.openclawDetail}</p>
            </article>

            <article className="answer-card">
              <div className="answer-label">Biggest risk</div>
              <div className="answer-value">
                <StatusBadge label={snapshot.system.systemStatus} tone={mission.biggestRiskTone} />
              </div>
              <p>{mission.biggestRisk}</p>
            </article>
          </div>
        </div>

        <aside className="command-deck-rail">
          <article className="rail-card">
            <div className="rail-title">Fallback readiness</div>
            <div className="rail-hero-number rail-hero-status">{mission.fallbackLabel}</div>
            <p>{mission.fallbackSummary}</p>
            <SourceFootnote source={snapshot.localCodexLab.source} label="fallback source" onOpen={props.onOpen} onCopy={props.onCopy} />
          </article>

          <article className="rail-card">
            <div className="rail-title">Commercial Readiness</div>
            <StatusBadge label={snapshot.commercialReadiness.overallStatus} tone={commercialTone(snapshot.commercialReadiness.overallStatus)} />
            <div className="rail-hero-number rail-hero-status">{snapshot.commercialReadiness.score}</div>
            <p>
              {snapshot.commercialReadiness.targetProduct.title} · {snapshot.commercialReadiness.summary.implemented} implemented ·{" "}
              {snapshot.commercialReadiness.summary.scaffolded} scaffolded · {snapshot.commercialReadiness.summary.missing} missing
            </p>
            <SourceFootnote
              source={snapshot.commercialReadiness.source}
              label="commercial readiness"
              onOpen={props.onOpen}
              onCopy={props.onCopy}
            />
          </article>

          <article className="rail-card">
            <div className="rail-title">Risk rail</div>
            <div className="risk-list">
              {mission.riskItems.map((item) => (
                <article key={item} className="risk-item">
                  <StatusBadge label="risk" tone="risk" />
                  <p>{item}</p>
                </article>
              ))}
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}

function TokenWastePanel(props: {
  lab: LocalCodexLab;
  telemetry: AiTelemetryExport;
  mission: MissionState;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  const waste = props.telemetry.tokenContextWaste;
  return (
    <section className="panel token-panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Token / Context Waste</div>
          <h3>Context hygiene and wrapper pressure</h3>
        </div>
        <StatusBadge label={props.mission.tokenLabel} tone={props.mission.tokenTone} />
      </div>

      <div className="local-status-grid">
        <MetricCard label="Files scanned" value={props.lab.tokenEfficiency.filesScanned} detail="conversation-mining scope" />
        <MetricCard label="Repeated health gates" value={props.lab.tokenEfficiency.repeatedHealthGateCount} detail="prompt boilerplate pressure" />
        <MetricCard label="Wrapper chars" value={waste.wrapper_total_context_chars ?? "missing"} detail="retrieval + code search output" />
        <MetricCard label="Avg wrapper chars" value={waste.wrapper_avg_context_chars ?? "missing"} detail={props.lab.retrievalPolicy.denylistedClasses.join(" · ") || "no denylist classes"} />
      </div>

      <div className="detail-grid compact-grid">
        <article className="detail-card">
          <div className="detail-card-title">Retrieval order</div>
          <ul className="note-list compact-note-list">
            {props.lab.retrievalPolicy.priorityOrder.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <SourceFootnote source={props.lab.retrievalPolicy.source} label="retrieval policy" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>

        <article className="detail-card">
          <div className="detail-card-title">Why this matters</div>
          <ul className="note-list compact-note-list">
            <li>Goal capsules and run summaries stay ahead of raw transcript history.</li>
            <li>Health-gate repeats and no-reply files are visible as waste, not hidden noise.</li>
            <li>Forensic transcript reads stay opt-in, not the default continuation path.</li>
          </ul>
          <SourceFootnote source={props.lab.tokenEfficiency.source} label="token metrics" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>
      </div>
    </section>
  );
}

function OpenClawReliabilityPanel(props: {
  lab: LocalCodexLab;
  mission: MissionState;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  const orderedClassifications = Object.entries(props.lab.openclawReliability.classifications)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1]);

  return (
    <section id="reliability" className="panel reliability-panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">OpenClaw Reliability</div>
          <h3>Failure classes and next repair moves</h3>
        </div>
        <StatusBadge label={props.mission.openclawLabel} tone={props.mission.openclawTone} />
      </div>

      <div className="local-status-grid">
        <MetricCard label="Warning count" value={props.lab.openclawReliability.warningCount} detail={props.lab.openclawReliability.status} />
        <MetricCard label="Dominant class" value={props.mission.dominantFailure} detail="current leading failure signal" />
        <MetricCard label="Goal capsules" value={props.lab.goalCapsules.length} detail="available escalation packets" />
        <MetricCard label="Recent runs" value={props.lab.runSummaries.length} detail="latest bounded execution summaries" />
      </div>

      <div className="detail-grid compact-grid">
        <article className="detail-card">
          <div className="detail-card-title">Failure classes</div>
          <div className="class-grid">
            {orderedClassifications.slice(0, 6).map(([name, count]) => (
              <div key={name} className="class-row">
                <span>{name}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="detail-card">
          <div className="detail-card-title">Recommended actions</div>
          <ul className="note-list compact-note-list">
            {props.lab.openclawReliability.recommendedActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
          <SourceFootnote source={props.lab.openclawReliability.source} label="openclaw reliability" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>
      </div>
    </section>
  );
}

function LocalFallbackPanel(props: {
  mission: MissionState;
  source: SourceMeta;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <section className="panel fallback-panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Local Fallback Readiness</div>
          <h3>Codex-limited mode readiness</h3>
        </div>
        <StatusBadge label={props.mission.fallbackLabel} tone={props.mission.fallbackTone} />
      </div>

      <div className="detail-grid compact-grid">
        <article className="detail-card">
          <div className="detail-card-title">Worker roles</div>
          <div className="readiness-list">
            <div className="readiness-row"><span>planner</span><strong>{props.mission.planner}</strong></div>
            <div className="readiness-row"><span>coder</span><strong>{props.mission.coder}</strong></div>
            <div className="readiness-row"><span>reviewer</span><strong>{props.mission.reviewer}</strong></div>
            <div className="readiness-row"><span>sandbox</span><strong>{props.mission.sandboxStatus}</strong></div>
          </div>
        </article>

        <article className="detail-card">
          <div className="detail-card-title">Readiness checks</div>
          <div className="readiness-list">
            <div className="readiness-row"><span>repo-intel</span><strong>{props.mission.repoIntelStatus}</strong></div>
            <div className="readiness-row"><span>benchmarks</span><strong>{props.mission.benchmarkStatus}</strong></div>
            <div className="readiness-row"><span>escalation packet</span><strong>{props.mission.escalationPacketStatus}</strong></div>
            <div className="readiness-row"><span>next step</span><strong>{props.mission.nextFallbackStep}</strong></div>
          </div>
          <SourceFootnote source={props.source} label="fallback source" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>
      </div>
    </section>
  );
}

function TimelinePanel(props: {
  runSummaries: LocalCodexRunSummary[];
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <section className="panel timeline-panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Recent Runs Timeline</div>
          <h3>Последние bounded проходы</h3>
        </div>
      </div>

      <div className="timeline-list">
        {props.runSummaries.map((summary) => (
          <article key={summary.runId} className="timeline-item">
            <div className="timeline-marker" />
            <div className="timeline-copy">
              <div className="timeline-head">
                <strong>{summary.task}</strong>
                <span>{summary.goalId || "ungrouped"}</span>
              </div>
              <p>{summary.nextAction}</p>
              <div className="goal-capsule-meta">
                <span>repos {summary.reposTouched.length}</span>
                <span>verification {summary.verification.length}</span>
                <span>commits {summary.commits.length}</span>
              </div>
              <SourceFootnote source={summary.source} label={`run ${summary.runId}`} onOpen={props.onOpen} onCopy={props.onCopy} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function GoalCapsuleCard(props: {
  capsule: LocalCodexGoalCapsule;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <article className="goal-capsule-card">
      <div className="goal-capsule-head">
        <div>
          <div className="detail-card-title">{props.capsule.goalId}</div>
          <strong>{props.capsule.status}</strong>
        </div>
        <span className={`health-pill ${goalToneClass(props.capsule.status)}`}>{props.capsule.status}</span>
      </div>
      <p className="goal-capsule-objective">{props.capsule.objective}</p>
      <div className="goal-capsule-meta">
        <span>next: {props.capsule.nextAction}</span>
        <span>summary: {props.capsule.latestRunSummary || "n/a"}</span>
        <span>budget: {props.capsule.recommendedContextBudget || "n/a"}</span>
      </div>
      {props.capsule.remainingGaps.length > 0 ? (
        <ul className="note-list compact-note-list">
          {props.capsule.remainingGaps.slice(0, 2).map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      ) : null}
      <SourceFootnote source={props.capsule.source} label={`goal ${props.capsule.goalId}`} onOpen={props.onOpen} onCopy={props.onCopy} />
    </article>
  );
}

function RunSummaryCard(props: {
  summary: LocalCodexRunSummary;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <article className="run-summary-card">
      <div className="goal-capsule-head">
        <div>
          <div className="detail-card-title">{props.summary.runId}</div>
          <strong>{props.summary.task}</strong>
        </div>
        <span className="chip chip-subtle">{props.summary.goalId || "ungrouped"}</span>
      </div>
      <div className="goal-capsule-meta">
        <span>repos {props.summary.reposTouched.length}</span>
        <span>verification {props.summary.verification.length}</span>
        <span>commits {props.summary.commits.length}</span>
      </div>
      <p className="goal-capsule-objective">{props.summary.nextAction}</p>
      {props.summary.whatRemains.length > 0 ? (
        <ul className="note-list compact-note-list">
          {props.summary.whatRemains.slice(0, 2).map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      ) : null}
      <SourceFootnote source={props.summary.source} label={`run ${props.summary.runId}`} onOpen={props.onOpen} onCopy={props.onCopy} />
    </article>
  );
}

function LocalCodexLabPanel(props: {
  lab: LocalCodexLab;
  commercial: CommercialReadiness;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  const orderedClassifications = Object.entries(props.lab.openclawReliability.classifications).sort((left, right) => right[1] - left[1]);
  const hermes = props.lab.latestHermes;

  return (
    <section className="local-codex-lab panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Local Codex Lab</div>
          <h3>AI Mission Control</h3>
        </div>
        <div className="panel-hint">
          host {props.lab.hostHealth} · updated {fmtRelative(new Date(props.lab.generatedAt).getTime())}
        </div>
      </div>

      <div className="local-codex-metrics">
        <MetricCard label="Goal capsules" value={props.lab.goalCapsules.length} detail={`run summaries ${props.lab.runSummaries.length}`} />
        <MetricCard label="Token waste" value={props.lab.tokenEfficiency.filesScanned} detail={`health repeats ${props.lab.tokenEfficiency.repeatedHealthGateCount}`} />
        <MetricCard label="Denylist" value={props.lab.retrievalPolicy.denylistedFiles} detail={props.lab.retrievalPolicy.denylistedClasses.join(" · ")} />
        <MetricCard label="OpenClaw warns" value={props.lab.openclawReliability.warningCount} detail={props.lab.openclawReliability.status} />
        <MetricCard label="Repo-intel" value={props.lab.repoIntel.targetCount} detail={props.lab.repoIntel.safeTargets.join(" · ")} />
        <MetricCard label="Commercial QA" value={props.commercial.score} detail={`${props.commercial.summary.implemented} impl · ${props.commercial.summary.scaffolded} scaffolded`} />
      </div>

      <div className="codex-lab-grid">
        <article className="detail-card">
          <div className="detail-card-title">Model routing baseline</div>
          <div className="class-grid">
            <div className="class-row"><span>fast</span><strong>{props.lab.modelRouting.fast}</strong></div>
            <div className="class-row"><span>balanced</span><strong>{props.lab.modelRouting.balanced}</strong></div>
            <div className="class-row"><span>planning</span><strong>{props.lab.modelRouting.planning}</strong></div>
            <div className="class-row"><span>embedding</span><strong>{props.lab.modelRouting.embedding}</strong></div>
          </div>
          <SourceFootnote source={props.lab.modelRouting.source} label="model routing" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>

        <article className="detail-card">
          <div className="detail-card-title">Retrieval policy</div>
          <ul className="note-list compact-note-list">
            {props.lab.retrievalPolicy.priorityOrder.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="goal-capsule-meta">
            <span>denylisted {props.lab.retrievalPolicy.denylistedFiles}</span>
            <span>{props.lab.retrievalPolicy.denylistedClasses.join(" · ")}</span>
          </div>
          <SourceFootnote source={props.lab.retrievalPolicy.source} label="retrieval policy" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>

        <article className="detail-card">
          <div className="detail-card-title">Token-efficiency audit</div>
          <div className="class-grid">
            <div className="class-row"><span>files scanned</span><strong>{props.lab.tokenEfficiency.filesScanned}</strong></div>
            <div className="class-row"><span>long goal runs</span><strong>{props.lab.tokenEfficiency.longGoalRuns}</strong></div>
            <div className="class-row"><span>bridge noise</span><strong>{props.lab.tokenEfficiency.bridgeNoiseFiles}</strong></div>
            <div className="class-row"><span>no reply</span><strong>{props.lab.tokenEfficiency.filesWithNoAssistantReply}</strong></div>
          </div>
          <SourceFootnote source={props.lab.tokenEfficiency.source} label="token waste metrics" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>

        <article className="detail-card">
          <div className="detail-card-title">Token economy artifacts</div>
          <div className="doc-list">
            <QuickActionRow
              label="High-waste capsules"
              value={compactPath(props.lab.tokenEconomy.highWasteCapsulesPath || "missing")}
              onOpen={props.lab.tokenEconomy.highWasteCapsulesPath ? () => props.onOpen("high-waste capsules", props.lab.tokenEconomy.highWasteCapsulesPath!) : undefined}
              onCopy={props.lab.tokenEconomy.highWasteCapsulesPath ? () => props.onCopy("high-waste capsules", props.lab.tokenEconomy.highWasteCapsulesPath!) : undefined}
            />
            <QuickActionRow
              label="Token economy report"
              value={compactPath(props.lab.tokenEconomy.tokenEconomyReportPath || "missing")}
              onOpen={props.lab.tokenEconomy.tokenEconomyReportPath ? () => props.onOpen("token economy report", props.lab.tokenEconomy.tokenEconomyReportPath!) : undefined}
              onCopy={props.lab.tokenEconomy.tokenEconomyReportPath ? () => props.onCopy("token economy report", props.lab.tokenEconomy.tokenEconomyReportPath!) : undefined}
            />
            <QuickActionRow
              label="Context budgets"
              value={compactPath(props.lab.tokenEconomy.contextBudgetsPath)}
              onOpen={() => props.onOpen("context budgets", props.lab.tokenEconomy.contextBudgetsPath)}
              onCopy={() => props.onCopy("context budgets", props.lab.tokenEconomy.contextBudgetsPath)}
            />
          </div>
          <SourceFootnote source={props.lab.tokenEconomy.source} label="token economy artifacts" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>

        <article className="detail-card">
          <div className="detail-card-title">OpenClaw reliability classes</div>
          <div className="class-grid">
            {orderedClassifications.slice(0, 5).map(([name, count]) => (
              <div key={name} className="class-row">
                <span>{name}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <ul className="note-list compact-note-list">
            {props.lab.openclawReliability.recommendedActions.slice(0, 2).map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
          <SourceFootnote source={props.lab.openclawReliability.source} label="openclaw reliability" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>

        <article className="detail-card">
          <div className="goal-capsule-head">
            <div className="detail-card-title">Hermes runtime route</div>
            <StatusBadge label={hermes.runtime_state || "missing"} tone={hermesRuntimeTone(hermes.runtime_state)} />
          </div>
          <div className="class-grid">
            <div className="class-row"><span>selected runtime</span><strong>{hermes.selected_runtime || "missing"}</strong></div>
            <div className="class-row"><span>delegation</span><strong>{hermes.delegation_status || "missing"}</strong></div>
            <div className="class-row"><span>fallback</span><strong>{hermes.fallback_used ? (hermes.fallback_target || "used") : "not used"}</strong></div>
            <div className="class-row"><span>installed</span><strong>{hermes.hermes_installed ? "yes" : "no"}</strong></div>
          </div>
          <ul className="note-list compact-note-list">
            {hermes.state_reason ? <li>{hermes.state_reason}</li> : null}
            {hermes.skip_reason ? <li>{hermes.skip_reason}</li> : null}
          </ul>
          <div className="doc-list">
            <QuickActionRow
              label="policy"
              value={compactPath(hermes.runtime_policy_path || "missing")}
              onOpen={hermes.runtime_policy_path ? () => props.onOpen("Hermes runtime policy", hermes.runtime_policy_path) : undefined}
              onCopy={hermes.runtime_policy_path ? () => props.onCopy("Hermes runtime policy", hermes.runtime_policy_path) : undefined}
            />
            <QuickActionRow
              label="manifest"
              value={compactPath(hermes.worker_manifest_path || "missing")}
              onOpen={hermes.worker_manifest_path ? () => props.onOpen("Hermes worker manifest", hermes.worker_manifest_path) : undefined}
              onCopy={hermes.worker_manifest_path ? () => props.onCopy("Hermes worker manifest", hermes.worker_manifest_path) : undefined}
            />
          </div>
        </article>

        <article className="detail-card">
          <div className="detail-card-title">Commercial Readiness</div>
          <div className="class-grid">
            <div className="class-row"><span>status</span><strong>{props.commercial.overallStatus}</strong></div>
            <div className="class-row"><span>host</span><strong>{props.commercial.hostHealth}</strong></div>
            <div className="class-row"><span>dirty repos</span><strong>{props.commercial.summary.dirtyFocusRepos}</strong></div>
            <div className="class-row"><span>blockers</span><strong>{props.commercial.summary.highRiskBlockers}</strong></div>
          </div>
          <ul className="note-list compact-note-list">
            {props.commercial.highRiskBlockers.slice(0, 2).map((item) => (
              <li key={item}>{item}</li>
            ))}
            {props.commercial.nextAction ? <li>{props.commercial.nextAction}</li> : null}
          </ul>
          <SourceFootnote source={props.commercial.source} label="commercial readiness" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>

        <article className="detail-card">
          <div className="detail-card-title">Repo-intel freshness</div>
          <div className="repo-intel-list">
            {props.lab.repoIntel.targets.map((target) => (
              <div key={target.repoId} className="repo-intel-row">
                <div>
                  <strong>{target.title}</strong>
                  <p>{compactPath(target.path)}</p>
                </div>
                <div className="repo-intel-meta">
                  <span>dirty {target.dirtyCount}</span>
                  <span>ahead {target.ahead}</span>
                  <span>symbols {target.symbolCount}</span>
                </div>
              </div>
            ))}
          </div>
          <SourceFootnote source={props.lab.repoIntel.source} label="repo intel" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>
      </div>

      <div className="detail-grid lab-detail-grid">
        <div className="detail-card detail-card-wide">
          <div className="detail-card-title">Active goal capsules</div>
          <div className="goal-capsule-list">
            {props.lab.goalCapsules.map((capsule) => (
              <GoalCapsuleCard key={capsule.goalId} capsule={capsule} onOpen={props.onOpen} onCopy={props.onCopy} />
            ))}
          </div>
        </div>
        <div className="detail-card detail-card-wide">
          <div className="detail-card-title">Run summaries</div>
          <div className="goal-capsule-list">
            {props.lab.runSummaries.map((summary) => (
              <RunSummaryCard key={summary.runId} summary={summary} onOpen={props.onOpen} onCopy={props.onCopy} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HostHealthPanel(props: {
  audit: HostAudit;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Host Health</div>
          <h3>Recovery host audit</h3>
        </div>
        <StatusBadge label={props.audit.overall} tone={props.audit.overall === "ok" ? "ok" : "risk"} />
      </div>

      <div className="local-status-grid">
        <MetricCard label="Host" value={props.audit.hostname} detail={props.audit.os || "unknown OS"} />
        <MetricCard label="Kernel" value={props.audit.kernel.split(" ").slice(0, 3).join(" ")} detail={props.audit.safeMode ? "safe mode on" : "safe mode off"} />
        <MetricCard label="GPU" value={`${props.audit.gpu.temperature}°C`} detail={`${props.audit.gpu.memoryUsed}/${props.audit.gpu.memoryTotal} MiB`} />
        <MetricCard label="Disk /" value={`${props.audit.disk.rootPercent}%`} detail="live root usage" />
      </div>

      <div className="detail-grid compact-grid">
        <article className="detail-card">
          <div className="detail-card-title">Top issue</div>
          <p>{props.audit.topIssue}</p>
          <div className="goal-capsule-meta">
            <span>Hyprland {props.audit.hyprlandOnline ? "online" : "missing"}</span>
            <span>watchdog {props.audit.watchdogReason || "n/a"}</span>
          </div>
          {props.audit.issueBundlePath ? (
            <SourceFootnote source={{ path: props.audit.issueBundlePath }} label="incident bundle" onOpen={props.onOpen} onCopy={props.onCopy} />
          ) : null}
        </article>

        <article className="detail-card">
          <div className="detail-card-title">Critical roots</div>
          <div className="repo-intel-list">
            {props.audit.repos.map((repo) => (
              <div key={repo.id} className="repo-intel-row">
                <div>
                  <strong>{repo.id}</strong>
                  <p>{compactPath(repo.path)}</p>
                </div>
                <div className="repo-intel-meta">
                  <span>{repo.present ? "present" : "missing"}</span>
                  <span>{repo.branch || repo.note || "—"}</span>
                  <span>{repo.dirtyCount === null ? "n/a" : `dirty ${repo.dirtyCount}`}</span>
                </div>
              </div>
            ))}
          </div>
          <SourceFootnote source={props.audit.source} label="host audit" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>
      </div>
    </section>
  );
}

function RuntimeRegistryPanel(props: {
  control: LocalAiControl;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Runtime Registry</div>
          <h3>Local services and control planes</h3>
        </div>
        <div className="panel-hint">updated {fmtRelative(new Date(props.control.generatedAt).getTime())}</div>
      </div>

      <div className="detail-grid compact-grid">
        <article className="detail-card detail-card-wide">
          <div className="detail-card-title">Live runtimes</div>
          <div className="repo-intel-list">
            {props.control.runtimes.map((runtime) => (
              <div key={runtime.id} className="repo-intel-row">
                <div>
                  <strong>{runtime.label}</strong>
                  <p>{runtime.detail}</p>
                </div>
                <div className="repo-intel-meta">
                  <span className={`health-pill ${toneClass(runtime.status)}`}>{runtime.status}</span>
                  <span>{runtime.endpoint || "local-only"}</span>
                </div>
              </div>
            ))}
          </div>
          <SourceFootnote source={props.control.source} label="local ai control" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>
      </div>
    </section>
  );
}

function ModelRoleMapPanel(props: {
  control: LocalAiControl;
  telemetry: AiTelemetryExport;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  const cleanupOrder: Array<keyof LocalAiControl["cleanup"]> = [
    "keep",
    "keep-but-manual",
    "candidate-for-removal",
    "unknown-needs-test",
  ];

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Model Routing</div>
          <h3>Canonical local routing and semantic usage</h3>
        </div>
        <StatusBadge label={props.telemetry.modelRouting.latest_embedding_model || props.control.gemma4.recommended_tag || "missing"} tone={telemetryStatusTone(props.telemetry.modelRouting.status)} />
      </div>

      <div className="local-status-grid">
        <MetricCard label="Fast draft" value={props.telemetry.modelRouting.fast || props.control.recommendations.fast_draft || "missing"} detail="default quick route" />
        <MetricCard label="Balanced" value={props.telemetry.modelRouting.balanced || props.control.recommendations.balanced_coding || "missing"} detail="daily coding route" />
        <MetricCard label="Heavy" value={props.telemetry.modelRouting.heavy || props.control.recommendations.heavy_coding || "missing"} detail="manual heavy route" />
        <MetricCard label="Embedding" value={props.telemetry.modelRouting.embedding || props.control.recommendations.embedding || "missing"} detail={`${props.telemetry.modelRouting.embedding_event_count ?? 0} semantic events`} />
      </div>

      <div className="detail-grid compact-grid">
        <article className="detail-card">
          <div className="detail-card-title">Active models</div>
          <div className="class-grid">
            {props.control.activeModels.length > 0 ? (
              props.control.activeModels.map((item) => (
                <div key={item.name} className="class-row">
                  <span>{item.name}</span>
                  <strong>{item.processor}</strong>
                </div>
              ))
            ) : (
              <div className="empty-inline">none loaded</div>
            )}
          </div>
        </article>

        <article className="detail-card">
          <div className="detail-card-title">Cleanup buckets</div>
          <div className="class-grid">
            {cleanupOrder.map((bucket) => (
              <div key={bucket} className="class-row">
                <span>{bucket}</span>
                <strong>{props.control.cleanup[bucket].length}</strong>
              </div>
            ))}
          </div>
          <p>{props.control.gemma4.reason}</p>
          <SourceFootnote source={props.control.source} label="model role map" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>
      </div>
    </section>
  );
}

function AgentBoardPanel(props: {
  control: LocalAiControl;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Agent Board</div>
          <h3>OpenClaw agents as the current native roster</h3>
        </div>
        <div className="panel-hint">{props.control.openclaw.agents.length} agents</div>
      </div>

      <div className="detail-grid compact-grid">
        <article className="detail-card detail-card-wide">
          <div className="detail-card-title">Roster</div>
          <div className="repo-intel-list">
            {props.control.openclaw.agents.map((agent) => (
              <div key={agent.id} className="repo-intel-row">
                <div>
                  <strong>{agent.label}</strong>
                  <p>{agent.store}</p>
                </div>
                <div className="repo-intel-meta">
                  <span>{agent.bootstrap}</span>
                  <span>{agent.sessions} sessions</span>
                  <span>{agent.active}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="detail-card">
          <div className="detail-card-title">Blockers</div>
          <ul className="note-list compact-note-list">
            {props.control.blockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <SourceFootnote source={props.control.source} label="agent board" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>
      </div>
    </section>
  );
}

function OpenClawSecurityPanelV2(props: {
  control: LocalAiControl;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">OpenClaw Security</div>
          <h3>Current warnings and next hardening moves</h3>
        </div>
        <StatusBadge label={`${props.control.security.summary.warn} warn`} tone={props.control.security.summary.warn > 0 ? "risk" : "ok"} />
      </div>

      <div className="local-status-grid">
        <MetricCard label="Critical" value={props.control.security.summary.critical} detail="audit count" />
        <MetricCard label="Warn" value={props.control.security.summary.warn} detail="review required" />
        <MetricCard label="Info" value={props.control.security.summary.info} detail="lower-severity signals" />
        <MetricCard label="Channels" value={props.control.openclaw.channels.length} detail="current gateway channels" />
      </div>

      <div className="detail-grid compact-grid">
        <article className="detail-card detail-card-wide">
          <div className="detail-card-title">Findings</div>
          <div className="task-list-vertical">
            {props.control.security.findings.slice(0, 6).map((finding) => (
              <article key={finding.id} className="task-vertical">
                <div className="task-vertical-head">
                  <strong>{finding.id}</strong>
                  <span className={`health-pill ${toneClass(severityTone(finding.severity))}`}>{finding.severity}</span>
                </div>
                <p>{finding.title}</p>
                <p>{finding.detail}</p>
                <div className="task-vertical-meta">
                  <span>fix</span>
                  <span>{finding.fix || "review detail"}</span>
                </div>
              </article>
            ))}
          </div>
          <SourceFootnote source={props.control.source} label="openclaw security" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>
      </div>
    </section>
  );
}

function SkillsRegistryPanel(props: {
  telemetry: AiTelemetryExport;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  const entries = props.telemetry.skillRegistry.entries ?? [];

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Skills Registry</div>
          <h3>Curated local skill source and installed surface</h3>
        </div>
        <StatusBadge
          label={`${props.telemetry.skillRegistry.installed_count ?? 0}/${props.telemetry.skillRegistry.source_count ?? 0}`}
          tone={telemetryStatusTone(props.telemetry.skillRegistry.status)}
        />
      </div>

      <div className="doc-list">
        {entries.length > 0 ? entries.map((entry) => (
          <QuickActionRow
            key={entry.id}
            label={entry.title}
            value={`${entry.id} · ${entry.installed ? "installed" : "source-only"} · ${entry.source_path}`}
            onOpen={() => props.onOpen(entry.title, entry.installed_path || entry.source_path)}
            onCopy={() => props.onCopy(entry.title, entry.installed_path || entry.source_path)}
          />
        )) : <div className="empty-inline">missing</div>}
      </div>
      <SourceFootnote source={props.telemetry.source} label="skill registry export" onOpen={props.onOpen} onCopy={props.onCopy} />
    </section>
  );
}

function RetrievalQualityPanel(props: {
  telemetry: AiTelemetryExport;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  const data = props.telemetry.retrievalQuality;
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Retrieval Quality</div>
          <h3>Hybrid Obsidian retrieval wrapper signals</h3>
        </div>
        <StatusBadge label={data.status} tone={telemetryStatusTone(data.status)} />
      </div>
      <div className="local-status-grid">
        <MetricCard label="Searches" value={data.count ?? "missing"} detail="logged wrapper runs" />
        <MetricCard label="Avg results" value={data.avg_results ?? "missing"} detail="per query" />
        <MetricCard label="Avg snippets" value={data.avg_snippets ?? "missing"} detail="per query" />
        <MetricCard label="Semantic rate" value={data.semantic_rate ?? "missing"} detail={data.last_scope || "scope missing"} />
      </div>
      <div className="detail-grid compact-grid">
        <article className="detail-card">
          <div className="detail-card-title">Latest query</div>
          <p>{data.last_query || "missing"}</p>
          <p>{data.last_at ? fmtRelative(new Date(data.last_at).getTime()) : "no timestamp"}</p>
        </article>
      </div>
      <SourceFootnote source={props.telemetry.source} label="retrieval quality export" onOpen={props.onOpen} onCopy={props.onCopy} />
    </section>
  );
}

function CodeContextSearchPanel(props: {
  telemetry: AiTelemetryExport;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  const data = props.telemetry.codeContextSearch;
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Code Context Search</div>
          <h3>Local semantic repo search wrapper</h3>
        </div>
        <StatusBadge label={data.status} tone={telemetryStatusTone(data.status)} />
      </div>
      <div className="local-status-grid">
        <MetricCard label="Searches" value={data.count ?? "missing"} detail="logged repo queries" />
        <MetricCard label="Avg results" value={data.avg_results ?? "missing"} detail="per query" />
        <MetricCard label="Avg context chars" value={data.avg_context_chars ?? "missing"} detail="returned snippet size" />
        <MetricCard label="Last repo" value={data.last_repo || "missing"} detail={data.last_status || "status missing"} />
      </div>
      <div className="detail-grid compact-grid">
        <article className="detail-card">
          <div className="detail-card-title">Latest query</div>
          <p>{data.last_query || "missing"}</p>
        </article>
      </div>
      <SourceFootnote source={props.telemetry.source} label="code search export" onOpen={props.onOpen} onCopy={props.onCopy} />
    </section>
  );
}

function SkillUsagePanel(props: {
  telemetry: AiTelemetryExport;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  const data = props.telemetry.skillUsage;
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Skill Usage</div>
          <h3>Wrapper-logged local skill activity</h3>
        </div>
        <StatusBadge label={data.status} tone={telemetryStatusTone(data.status)} />
      </div>
      <div className="local-status-grid">
        <MetricCard label="Total events" value={data.total ?? "missing"} detail="skill usage rows" />
      </div>
      <div className="doc-list">
        {(data.by_skill ?? []).length > 0 ? (
          data.by_skill!.slice(0, 6).map((entry) => (
            <QuickActionRow
              key={entry.id}
              label={entry.id}
              value={`${entry.count} runs · ${entry.last_used_at ? fmtRelative(new Date(entry.last_used_at).getTime()) : "no timestamp"}`}
              onOpen={() => props.onOpen(entry.id, props.telemetry.source.path)}
              onCopy={() => props.onCopy(entry.id, entry.id)}
            />
          ))
        ) : (
          <div className="empty-inline">missing</div>
        )}
      </div>
      <SourceFootnote source={props.telemetry.source} label="skill usage export" onOpen={props.onOpen} onCopy={props.onCopy} />
    </section>
  );
}

function CodexProductivityPanel(props: {
  telemetry: AiTelemetryExport;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  const data = props.telemetry.codexProductivity;
  const ledger = data.recent_ledger ?? [];
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Codex Productivity</div>
          <h3>Read-only view from run summaries and wrapper usage</h3>
        </div>
        <StatusBadge label={data.status} tone={telemetryStatusTone(data.status)} />
      </div>
      <div className="local-status-grid">
        <MetricCard label="Runs" value={data.total_runs ?? "missing"} detail="run summaries" />
        <MetricCard label="Verified" value={data.verified_runs ?? "missing"} detail="runs with verification" />
        <MetricCard label="Repos touched" value={data.unique_repos_touched ?? "missing"} detail="unique repo surfaces" />
        <MetricCard label="Tool events" value={data.tool_usage_events ?? "missing"} detail="wrapper tool usage" />
      </div>
      <div className="detail-grid compact-grid">
        <article className="detail-card">
          <div className="detail-card-title">Latest run</div>
          <p>{data.latest_run?.task || "missing"}</p>
          <p>{data.latest_run?.next_action || "missing"}</p>
        </article>
        <article className="detail-card">
          <div className="detail-card-title">Recent ledger</div>
          <div className="doc-list">
            {ledger.length > 0 ? (
              ledger.slice(0, 4).map((entry) => (
                <QuickActionRow
                  key={entry.run_id || `${entry.task}-${entry.finished_at}`}
                  label={entry.task || "unnamed run"}
                  value={`${entry.status} · ${entry.repo_count} repos · ${entry.commit_count} commits · ${
                    entry.finished_at ? fmtRelative(new Date(entry.finished_at).getTime()) : "no timestamp"
                  }`}
                  onOpen={() => props.onOpen(entry.run_id || entry.task || "productivity-run", props.telemetry.source.path)}
                  onCopy={() => props.onCopy(entry.run_id || entry.task || "productivity-run", entry.next_action || entry.task || "")}
                />
              ))
            ) : (
              <div className="empty-inline">missing</div>
            )}
          </div>
        </article>
      </div>
      <SourceFootnote source={props.telemetry.source} label="productivity export" onOpen={props.onOpen} onCopy={props.onCopy} />
    </section>
  );
}

function TokenEconomyPanel(props: {
  telemetry: AiTelemetryExport;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  const economy = props.telemetry.tokenEconomy;
  const accounts = props.telemetry.accountAnalytics;
  const report = props.telemetry.tokenEconomyReport;
  const governor = props.telemetry.tokenGovernor;
  const usage = props.telemetry.aiResponseUsage;
  const cache = props.telemetry.promptCacheEfficiency;
  const latest = governor.latest;
  const accountRows = report.tokens_by_account?.length ? report.tokens_by_account : (accounts.tokens_by_account ?? []);
  const expensiveRuns = report.top_expensive_runs ?? [];
  const blockedRuns = report.over_budget_runs ?? [];
  const verifiedRollup = report.tokens_per_verified_run ?? { entries: [] };
  const failedOrPartial = report.failed_or_partial_token_waste ?? { status: "missing", run_count: 0, total_tokens: 0, entries: [] };
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Token Economy</div>
          <h3>Governor, usage, and cache pressure</h3>
        </div>
        <StatusBadge label={economy.status} tone={telemetryStatusTone(economy.status)} />
      </div>
      <div className="local-status-grid">
        <MetricCard label="Total tokens" value={fmtInteger(economy.total_tokens)} detail={`${usage.count ?? 0} ai responses`} />
        <MetricCard label="Total cost" value={fmtUsd(economy.total_cost_usd)} detail={`avg latency ${economy.avg_latency_ms ?? "missing"} ms`} />
        <MetricCard label="Cache ratio" value={fmtRatio(cache.cache_ratio ?? economy.cache_ratio)} detail={`${cache.cached_input_tokens ?? 0} cached input`} />
        <MetricCard
          label="Accounts"
          value={economy.tracked_account_count ?? accountRows.length ?? "missing"}
          detail={`${(accounts.unknown_account_sessions ?? []).length} unknown sessions listed`}
        />
        <MetricCard label="Governor runs" value={governor.run_count ?? "missing"} detail={`${report.over_budget_run_count ?? governor.over_budget_count ?? 0} over-budget or blocked`} />
      </div>
      <div className="detail-grid compact-grid">
        <article className="detail-card">
          <div className="detail-card-title">Latest governed pack</div>
          <div className="class-grid">
            <div className="class-row"><span>budget</span><strong>{latest?.context_budget || "missing"}</strong></div>
            <div className="class-row"><span>chars</span><strong>{latest ? `${latest.estimated_context_chars} / ${latest.max_context_chars}` : "missing"}</strong></div>
            <div className="class-row"><span>warnings</span><strong>{latest?.warning_count ?? "missing"}</strong></div>
            <div className="class-row"><span>hash</span><strong>{compactHash(latest?.retrieval_pack_hash || "")}</strong></div>
          </div>
          <p>{latest?.over_budget ? "Estimated context is over the governor cap." : "Latest governed run stayed within the configured cap."}</p>
        </article>
        <article className="detail-card">
          <div className="detail-card-title">Account breakdown</div>
          <div className="doc-list">
            {accountRows.length > 0 ? (
              accountRows.slice(0, 4).map((entry) => (
                <QuickActionRow
                  key={`${entry.account_key}-${entry.account_email}`}
                  label={accountDisplay(entry)}
                  value={`${fmtInteger(entry.total_tokens)} tok · ${entry.runs} runs · ${entry.verified_runs} verified`}
                  onCopy={() => props.onCopy(accountDisplay(entry), entry.account_email || entry.account_id || entry.account_key)}
                />
              ))
            ) : (
              <div className="empty-inline">missing</div>
            )}
          </div>
        </article>
        <article className="detail-card">
          <div className="detail-card-title">Top expensive runs</div>
          <div className="doc-list">
            {expensiveRuns.length > 0 ? (
              expensiveRuns.slice(0, 4).map((entry) => (
                <QuickActionRow
                  key={entry.run_id}
                  label={compactHash(entry.run_id, 24)}
                  value={`${fmtInteger(entry.total_tokens)} tok · ${fmtUsd(entry.total_cost_usd)} · ${entry.verification_status} · ${accountDisplay(entry)}`}
                  onCopy={() => props.onCopy(entry.run_id, entry.run_id)}
                />
              ))
            ) : (
              <div className="empty-inline">missing</div>
            )}
          </div>
        </article>
        <article className="detail-card">
          <div className="detail-card-title">Blocked and over-budget runs</div>
          <div className="doc-list">
            {blockedRuns.length > 0 ? (
              blockedRuns.slice(0, 4).map((entry) => (
                <QuickActionRow
                  key={entry.run_id}
                  label={`${entry.context_budget} · ${compactHash(entry.run_id, 22)}`}
                  value={`${entry.gate_blocked ? "blocked" : entry.over_budget ? "over" : "within"} · ${entry.estimated_context_chars}/${entry.max_context_chars} chars · ${entry.blocked_reasons[0] || entry.verification_status}`}
                  onCopy={() => props.onCopy(entry.run_id, `${entry.run_id} ${entry.blocked_reasons.join(" | ")}`.trim())}
                />
              ))
            ) : (
              <div className="empty-inline">missing</div>
            )}
          </div>
        </article>
        <article className="detail-card">
          <div className="detail-card-title">Verified efficiency</div>
          <div className="class-grid">
            <div className="class-row"><span>verified runs</span><strong>{verifiedRollup.run_count ?? "missing"}</strong></div>
            <div className="class-row"><span>avg tokens</span><strong>{fmtInteger(verifiedRollup.avg_tokens)}</strong></div>
            <div className="class-row"><span>failed/partial runs</span><strong>{failedOrPartial.run_count ?? "missing"}</strong></div>
            <div className="class-row"><span>failed/partial tokens</span><strong>{fmtInteger(failedOrPartial.total_tokens)}</strong></div>
          </div>
          {(verifiedRollup.entries ?? []).length > 0 ? (
            <ul className="note-list compact-note-list">
              {verifiedRollup.entries!.slice(0, 2).map((entry) => (
                <li key={entry.run_id}>
                  <span className={toneClass(verificationTone(entry.verification_status))}>{entry.verification_status}</span>
                  {` · ${fmtInteger(entry.total_tokens)} tok · ${entry.verified_checks} checks · ${compactObjective(entry.task, 90)}`}
                </li>
              ))}
            </ul>
          ) : null}
          <SourceFootnote source={props.telemetry.source} label="token economy export" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>
      </div>
    </section>
  );
}

function AiActivityExplorerPanel(props: {
  telemetry: AiTelemetryExport;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  const explorer = props.telemetry.aiActivityExplorer;
  const overview = explorer.overview ?? { status: "missing" };
  const trends = explorer.trends ?? { status: "missing" };
  const explore = explorer.explore ?? { status: "missing" };
  const guardrails = explorer.guardrails ?? props.telemetry.guardrailEvents;
  const recentResponses = explore.recent_responses ?? [];
  const recentGuardrails = guardrails.recent_events ?? [];
  const providerRows = trends.by_provider ?? [];
  const dayRows = trends.by_day ?? [];
  const workspaceRows = explore.workspaces ?? [];
  const agentRows = explore.agents ?? [];
  const sessionRows = explore.sessions ?? [];
  const guardrailTypeRows = guardrails.by_type ?? [];
  const latestGuardrail = guardrails.latest_event as { status?: string; event_type?: string; summary?: string } | undefined;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">AI Activity Explorer</div>
          <h3>Local response usage, optional providers, and guardrail pulse</h3>
        </div>
        <StatusBadge label={explorer.status} tone={telemetryStatusTone(explorer.status)} />
      </div>
      <div className="local-status-grid">
        <MetricCard label="Responses" value={overview.ai_response_count ?? "missing"} detail={`${overview.provider_count ?? 0} providers`} />
        <MetricCard label="Workspaces" value={overview.workspace_count ?? "missing"} detail={`${overview.agent_count ?? 0} agents · ${overview.session_count ?? 0} sessions`} />
        <MetricCard label="Spend" value={fmtUsd(overview.total_cost_usd)} detail={`${fmtInteger(overview.total_tokens)} tok`} />
        <MetricCard label="Guardrails" value={guardrails.count ?? 0} detail={`${guardrails.blocked_count ?? 0} blocked · ${guardrails.review_count ?? 0} review`} />
        <MetricCard
          label="OpenRouter"
          value={overview.openrouter_response_count ?? 0}
          detail={overview.optional_provider_present ? "optional provider rows present" : "optional provider rows missing"}
        />
      </div>
      <div className="detail-grid compact-grid">
        <article className="detail-card">
          <div className="detail-card-title">Overview</div>
          <div className="class-grid">
            <div className="class-row"><span>last model</span><strong>{overview.last_model || "missing"}</strong></div>
            <div className="class-row"><span>last provider</span><strong>{overview.last_provider || "missing"}</strong></div>
            <div className="class-row"><span>cache discount</span><strong>{fmtUsd(overview.total_cache_discount_usd)}</strong></div>
            <div className="class-row"><span>latest guardrail</span><strong>{overview.last_guardrail_status || "missing"}</strong></div>
          </div>
          <p>Codex, Atlas, and local-codex-stack stay primary. Optional provider rows appear here only when local telemetry imports them.</p>
        </article>
        <article className="detail-card">
          <div className="detail-card-title">Trends</div>
          <div className="doc-list">
            {providerRows.length > 0 ? (
              providerRows.slice(0, 4).map((entry) => (
                <QuickActionRow
                  key={entry.provider}
                  label={entry.provider}
                  value={`${entry.count} resp · ${fmtInteger(entry.total_tokens)} tok · ${fmtUsd(entry.total_cost_usd)}${entry.openrouter ? " · optional" : ""}`}
                  onCopy={() => props.onCopy(entry.provider, `${entry.provider} ${entry.total_tokens}`)}
                />
              ))
            ) : (
              <div className="empty-inline">missing</div>
            )}
          </div>
          {dayRows.length > 0 ? (
            <ul className="note-list compact-note-list">
              {dayRows.slice(0, 3).map((entry) => (
                <li key={entry.day}>
                  {`${entry.day} · ${entry.count} resp · ${fmtInteger(entry.total_tokens)} tok · ${entry.guardrail_event_count} guardrails`}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
        <article className="detail-card">
          <div className="detail-card-title">Explore</div>
          <div className="doc-list">
            {recentResponses.length > 0 ? (
              recentResponses.slice(0, 4).map((entry) => (
                <QuickActionRow
                  key={`${entry.ts}-${entry.run_id}-${entry.model}`}
                  label={`${entry.provider}/${entry.model}`}
                  value={`${entry.billing_source || "billing?"} · ${entry.context_budget || "no-budget"} · ${fmtInteger(entry.total_tokens)} tok · ${entry.guardrail_status || "clear"}`}
                  onCopy={() => props.onCopy(entry.run_id || entry.model, `${entry.session_id || "no-session"} ${entry.workspace_id || ""}`.trim())}
                />
              ))
            ) : (
              <div className="empty-inline">missing</div>
            )}
          </div>
          {(workspaceRows.length > 0 || agentRows.length > 0 || sessionRows.length > 0) ? (
            <ul className="note-list compact-note-list">
              {workspaceRows[0] ? <li>{`workspace ${workspaceRows[0].workspace_id} · ${workspaceRows[0].count} resp`}</li> : null}
              {agentRows[0] ? <li>{`agent ${agentRows[0].agent_id} · ${agentRows[0].count} resp`}</li> : null}
              {sessionRows[0] ? <li>{`session ${compactHash(sessionRows[0].session_id, 16)} · ${sessionRows[0].count} resp`}</li> : null}
            </ul>
          ) : null}
        </article>
        <article className="detail-card">
          <div className="detail-card-title">Guardrails</div>
          <div className="class-grid">
            <div className="class-row"><span>latest</span><strong>{latestGuardrail?.event_type || "missing"}</strong></div>
            <div className="class-row"><span>status</span><strong className={toneClass(guardrailTone(latestGuardrail?.status))}>{latestGuardrail?.status || "missing"}</strong></div>
            <div className="class-row"><span>top type</span><strong>{guardrailTypeRows[0]?.event_type || "missing"}</strong></div>
            <div className="class-row"><span>count</span><strong>{guardrailTypeRows[0]?.count ?? 0}</strong></div>
          </div>
          <div className="doc-list">
            {recentGuardrails.length > 0 ? (
              recentGuardrails.slice(0, 4).map((entry) => (
                <QuickActionRow
                  key={`${entry.ts}-${entry.event_type}-${entry.run_id}`}
                  label={entry.event_type}
                  value={`${entry.status} · ${entry.repo_id || "repo?"} · ${entry.reason || entry.summary}`}
                  onCopy={() => props.onCopy(entry.event_type, `${entry.run_id} ${entry.command || entry.matched_pattern || entry.reason}`.trim())}
                />
              ))
            ) : (
              <div className="empty-inline">no guardrail events yet</div>
            )}
          </div>
        </article>
      </div>
      <SourceFootnote source={props.telemetry.source} label="ai activity export" onOpen={props.onOpen} onCopy={props.onCopy} />
    </section>
  );
}

function AgentTracePanel(props: {
  telemetry: AiTelemetryExport;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  const data = props.telemetry.agentTrace;
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Agent Trace</div>
          <h3>Deterministic run-level event ledger</h3>
        </div>
        <StatusBadge label={data.status} tone={telemetryStatusTone(data.status)} />
      </div>
      <div className="local-status-grid">
        <MetricCard label="Events" value={data.total_events ?? "missing"} detail={`${data.run_count ?? 0} runs`} />
        <MetricCard label="Commands" value={data.command_run_count ?? "missing"} detail={`${data.test_run_count ?? 0} test/build runs`} />
        <MetricCard label="File reads" value={data.file_read_count ?? "missing"} detail={`${data.patch_applied_count ?? 0} patch events`} />
        <MetricCard label="AI trace" value={data.ai_response_count ?? "missing"} detail={`${data.cache_hit_count ?? 0} cache hits`} />
      </div>
      <div className="detail-grid compact-grid">
        <article className="detail-card">
          <div className="detail-card-title">Recent events</div>
          <div className="doc-list">
            {(data.recent_events ?? []).length > 0 ? (
              data.recent_events!.slice(0, 6).map((entry) => (
                <QuickActionRow
                  key={`${entry.ts}-${entry.event_type}-${entry.run_id}`}
                  label={entry.event_type}
                  value={`${entry.repo_id || "repo?"} · ${entry.status} · ${entry.run_id || "no-run"} · ${
                    entry.ts ? fmtRelative(new Date(entry.ts).getTime()) : "no timestamp"
                  }`}
                  onCopy={() => props.onCopy(entry.event_type, `${entry.run_id} ${entry.subject}`.trim())}
                />
              ))
            ) : (
              <div className="empty-inline">missing</div>
            )}
          </div>
        </article>
        <article className="detail-card">
          <div className="detail-card-title">Latest finished run</div>
          <div className="class-grid">
            <div className="class-row"><span>run</span><strong>{data.latest_run?.run_id || "missing"}</strong></div>
            <div className="class-row"><span>repo</span><strong>{data.latest_run?.repo_id || "missing"}</strong></div>
            <div className="class-row"><span>status</span><strong>{data.latest_run?.status || "missing"}</strong></div>
            <div className="class-row"><span>phase</span><strong>{data.latest_run?.phase || "missing"}</strong></div>
          </div>
          <SourceFootnote source={props.telemetry.source} label="agent trace export" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>
      </div>
    </section>
  );
}

function CacheLedgerPanel(props: {
  telemetry: AiTelemetryExport;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  const data = props.telemetry.cacheLedger;
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Cache Ledger</div>
          <h3>Retrieval pack reuse vs fresh work</h3>
        </div>
        <StatusBadge label={data.status} tone={telemetryStatusTone(data.status)} />
      </div>
      <div className="local-status-grid">
        <MetricCard label="Hits" value={data.hit_count ?? "missing"} detail={`rate ${data.hit_rate ?? "missing"}`} />
        <MetricCard label="Misses" value={data.miss_count ?? "missing"} detail="new retrieval packs" />
        <MetricCard label="Cache keys" value={data.unique_cache_keys ?? "missing"} detail="unique retrieval hashes" />
        <MetricCard label="Repos" value={data.by_repo?.length ?? "missing"} detail="repo surfaces in ledger" />
      </div>
      <div className="detail-grid compact-grid">
        <article className="detail-card">
          <div className="detail-card-title">Recent cache entries</div>
          <div className="doc-list">
            {(data.entries ?? []).length > 0 ? (
              data.entries!.slice(0, 6).map((entry) => (
                <QuickActionRow
                  key={`${entry.ts}-${entry.cache_key}`}
                  label={entry.event_type}
                  value={`${entry.repo_id || "repo?"} · ${compactHash(entry.cache_key)} · prev ${entry.previous_run_id || "none"}`}
                  onCopy={() => props.onCopy(entry.event_type, entry.cache_key || entry.previous_run_id || "")}
                />
              ))
            ) : (
              <div className="empty-inline">missing</div>
            )}
          </div>
        </article>
        <article className="detail-card">
          <div className="detail-card-title">By repo</div>
          <div className="class-grid">
            {(data.by_repo ?? []).length > 0 ? (
              data.by_repo!.map((entry) => (
                <div key={entry.repo_id} className="class-row">
                  <span>{entry.repo_id}</span>
                  <strong>{entry.count}</strong>
                </div>
              ))
            ) : (
              <div className="empty-inline">missing</div>
            )}
          </div>
          <SourceFootnote source={props.telemetry.source} label="cache ledger export" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>
      </div>
    </section>
  );
}

function RedundantWorkPanel(props: {
  telemetry: AiTelemetryExport;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  const data = props.telemetry.redundantWork;
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Redundant Work</div>
          <h3>Repeated retrieval, command, and file-read patterns</h3>
        </div>
        <StatusBadge label={data.status} tone={telemetryStatusTone(data.status)} />
      </div>
      <div className="local-status-grid">
        <MetricCard label="Repeated packs" value={data.repeated_retrieval_packs ?? "missing"} detail="extra retrieval pack rebuilds" />
        <MetricCard label="Repeated queries" value={data.repeated_queries ?? "missing"} detail="same retrieval query repeated" />
        <MetricCard label="Repeated commands" value={data.repeated_commands ?? "missing"} detail="same command reruns" />
        <MetricCard label="Repeated file reads" value={data.repeated_file_reads ?? "missing"} detail="same source reread" />
      </div>
      <div className="detail-grid compact-grid">
        <article className="detail-card">
          <div className="detail-card-title">Top repeated commands</div>
          <ul className="note-list compact-note-list">
            {(data.top_commands ?? []).length > 0 ? (
              data.top_commands!.slice(0, 4).map((entry) => <li key={entry.command}>{entry.command} · {entry.count}</li>)
            ) : (
              <li>missing</li>
            )}
          </ul>
        </article>
        <article className="detail-card">
          <div className="detail-card-title">Top repeated files</div>
          <ul className="note-list compact-note-list">
            {(data.top_files ?? []).length > 0 ? (
              data.top_files!.slice(0, 4).map((entry) => <li key={entry.path}>{compactPath(entry.path)} · {entry.count}</li>)
            ) : (
              <li>missing</li>
            )}
          </ul>
          <SourceFootnote source={props.telemetry.source} label="redundant work export" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>
      </div>
    </section>
  );
}

function BudgetDriftPanel(props: {
  telemetry: AiTelemetryExport;
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  const data = props.telemetry.budgetDrift;
  const overBudget = (data.by_budget ?? []).reduce((sum, entry) => sum + (entry.over_budget ?? 0), 0);
  const underBudget = (data.by_budget ?? []).reduce((sum, entry) => sum + (entry.under_budget ?? 0), 0);
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Budget Drift</div>
          <h3>Actual token usage vs declared context budget</h3>
        </div>
        <StatusBadge label={data.status} tone={telemetryStatusTone(data.status)} />
      </div>
      <div className="local-status-grid">
        <MetricCard label="Evaluated" value={data.evaluated_count ?? "missing"} detail="ai responses with budget tags" />
        <MetricCard label="Unknown budget" value={data.unknown_budget_count ?? "missing"} detail="missing context budget label" />
        <MetricCard label="Over budget" value={overBudget} detail="token usage exceeded budget band" />
        <MetricCard label="Under budget" value={underBudget} detail="budget bands were conservative" />
      </div>
      <div className="detail-grid compact-grid">
        <article className="detail-card detail-card-wide">
          <div className="detail-card-title">By budget</div>
          <div className="repo-intel-list">
            {(data.by_budget ?? []).length > 0 ? (
              data.by_budget!.map((entry) => (
                <div key={entry.context_budget} className="repo-intel-row">
                  <div>
                    <strong>{entry.context_budget}</strong>
                    <p>drift {entry.avg_drift_ratio}</p>
                  </div>
                  <div className="repo-intel-meta">
                    <span>count {entry.count}</span>
                    <span>over {entry.over_budget}</span>
                    <span>under {entry.under_budget}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-inline">missing</div>
            )}
          </div>
          <SourceFootnote source={props.telemetry.source} label="budget drift export" onOpen={props.onOpen} onCopy={props.onCopy} />
        </article>
      </div>
    </section>
  );
}

function SelectedProjectPanel(props: {
  project: ProjectRecord;
  allProjects: ProjectRecord[];
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onCopy: (label: string, value: string) => void;
  onOpen: (label: string, target: string) => void;
}) {
  const { project, allProjects, activeTab, onTabChange, onCopy, onOpen } = props;
  const related = project.related
    .map((id) => allProjects.find((item) => item.id === id))
    .filter(Boolean) as ProjectRecord[];

  return (
    <section className="selected-panel">
      <header className="selected-header">
        <div>
          <div className="section-kicker">Выбранный проект</div>
          <h2>{project.title}</h2>
          <p>{project.summary}</p>
        </div>
        <div className="selected-header-meta">
          <span className={`health-pill ${toneClass(project.healthTone)}`}>
            {HEALTH_LABELS[project.healthTone]}
          </span>
          <span className="chip">{project.branch}</span>
          {project.release ? (
            <span className="chip chip-strong">
              {project.release.label} · {project.release.days} дн
            </span>
          ) : null}
        </div>
      </header>

      <div className="detail-tabs">
        {DETAIL_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`detail-tab ${activeTab === tab.id ? "detail-tab-active" : ""}`}
            type="button"
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="detail-grid">
          <div className="detail-card">
            <div className="detail-card-title">Сервисы</div>
            <div className="service-list">
              {project.services.map((service) => (
                <div key={service.name} className="service-row">
                  <span className={`service-dot ${toneClass(service.status)}`} />
                  <div>
                    <strong>{service.name}</strong>
                    <span>{service.stack}</span>
                  </div>
                  <span>{service.version}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="detail-card">
            <div className="detail-card-title">Быстрые действия</div>
            <QuickActionRow
              label="Репозиторий"
              value={project.paths.root}
              href={project.quickOpen.vscode || project.quickOpen.root}
              onOpen={() => onOpen("repo", project.quickOpen.vscode || project.quickOpen.root)}
              openLabel="code"
              onCopy={() => onCopy("path", project.paths.root)}
            />
            {project.paths.readme ? (
              <QuickActionRow
                label="README"
                value={project.paths.readme}
                href={project.quickOpen.readme}
                onOpen={() => onOpen("readme", project.quickOpen.readme)}
                onCopy={() => onCopy("readme", project.paths.readme)}
              />
            ) : null}
            {project.paths.docs ? (
              <QuickActionRow
                label="Docs root"
                value={project.paths.docs}
                href={project.quickOpen.docs}
                onOpen={() => onOpen("docs", project.quickOpen.docs)}
                onCopy={() => onCopy("docs", project.paths.docs)}
              />
            ) : null}
            {project.commands.dev ? (
              <QuickActionRow
                label="Dev command"
                value={project.commands.dev}
                onCopy={() => onCopy("dev", project.commands.dev)}
              />
            ) : null}
            {project.commands.deploy ? (
              <QuickActionRow
                label="Deploy command"
                value={project.commands.deploy}
                onCopy={() => onCopy("deploy", project.commands.deploy)}
              />
            ) : null}
            {project.remote ? (
              <QuickActionRow
                label="Remote"
                value={project.remote}
                href={project.remote.replace(/^git@github.com:/, "https://github.com/").replace(/\.git$/, "")}
                onOpen={() =>
                  onOpen(
                    "remote",
                    project.remote.replace(/^git@github.com:/, "https://github.com/").replace(/\.git$/, ""),
                  )
                }
                openLabel="web"
                onCopy={() => onCopy("remote", project.remote)}
              />
            ) : null}
          </div>
          <div className="detail-card detail-card-wide">
            <div className="detail-card-title">Что держать в голове</div>
            <ul className="note-list">
              {project.riskNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {activeTab === "architecture" ? (
        <div className="detail-grid">
          <div className="detail-card">
            <div className="detail-card-title">Связанные репы</div>
            <div className="related-grid">
              {related.map((item) => (
                <article key={item.id} className="related-card">
                  <div className="related-name">{item.name}</div>
                  <div className="related-summary">{item.summary}</div>
                </article>
              ))}
            </div>
          </div>
          <div className="detail-card">
            <div className="detail-card-title">Stack и сигналы</div>
            <div className="chip-wrap">
              {project.tags.map((tag) => (
                <span key={tag} className="chip chip-subtle">
                  {tag}
                </span>
              ))}
            </div>
            <div className="signals">
              <div>Коммитов / 7д: {project.metrics.commits7d}</div>
              <div>Сервисов: {project.metrics.services}</div>
              <div>Ahead / behind: {project.ahead} / {project.behind}</div>
            </div>
          </div>
          <div className="detail-card detail-card-wide">
            <div className="detail-card-title">Dirty files</div>
            <div className="dirty-files">
              {project.dirtyFiles.length > 0 ? (
                project.dirtyFiles.map((file) => <code key={file}>{file}</code>)
              ) : (
                <div className="empty-inline">worktree clean</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "deploy" ? (
        <div className="detail-grid">
          <div className="detail-card">
            <div className="detail-card-title">Deploy surface</div>
            {project.deploy ? (
              <div className="deploy-surface">
                <div>{project.deploy.surface}</div>
                <div>{project.deploy.environment}</div>
                <p>{project.deploy.note}</p>
              </div>
            ) : (
              <div className="empty-inline">Нет deploy-контура</div>
            )}
          </div>
          <div className="detail-card">
            <div className="detail-card-title">Окно релиза</div>
            {project.release ? (
              <div className="release-card">
                <div className="release-badge">{project.release.label}</div>
                <div className="release-days">{project.release.days} дн</div>
                <div>confidence {project.release.confidence}%</div>
              </div>
            ) : (
              <div className="empty-inline">Не задано</div>
            )}
          </div>
          <div className="detail-card detail-card-wide">
            <div className="detail-card-title">Команды</div>
            <div className="command-list">
              {Object.entries(project.commands)
                .filter(([, value]) => value)
                .map(([key, value]) => (
                  <button
                    key={key}
                    className="command-row"
                    type="button"
                    onClick={() => onCopy(key, value)}
                  >
                    <span>{key}</span>
                    <code>{value}</code>
                  </button>
                ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "tasks" ? (
        <div className="detail-grid">
          <div className="detail-card detail-card-wide">
            <div className="detail-card-title">Project tasks</div>
            <div className="task-list-vertical">
              {project.tasks.map((task) => (
                <article key={task.id} className={`task-vertical ${taskPriorityClass(task.priority)}`}>
                  <div className="task-vertical-head">
                    <strong>{task.title}</strong>
                    <span
                      className={`health-pill ${toneClass(
                        task.status === "done" ? "ok" : task.status === "blocked" ? "risk" : "attention",
                      )}`}
                    >
                      {STATUS_LABELS[task.status]}
                    </span>
                  </div>
                  <div className="task-vertical-meta">
                    <span>{task.area}</span>
                    <span>{task.priority}</span>
                  </div>
                  <p>{task.note}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "docs" ? (
        <div className="detail-grid">
          <div className="detail-card detail-card-wide">
            <div className="detail-card-title">Документы и входы</div>
            <div className="doc-list">
              {project.docs.map((doc) => (
                <QuickActionRow
                  key={doc.path}
                  label={doc.label}
                  value={doc.path}
                  href={`file://${doc.path}`}
                  onOpen={() => onOpen(doc.label, doc.path)}
                  onCopy={() => onCopy(doc.label, doc.path)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function IntelligenceRail(props: {
  snapshot: Snapshot;
  projects: ProjectRecord[];
}) {
  const blockers = props.snapshot.tasks
    .filter((task) => task.status === "blocked" || (task.status === "active" && task.priority === "high"))
    .slice(0, 5);

  return (
    <aside className="intel-rail">
      <section className="rail-card">
        <div className="rail-title">Пульс деплоев</div>
        <div className="bar-strip">
          {props.snapshot.summary.deployPulse.map((value, index) => (
            <span key={index} style={{ height: `${value * 8}px` }} />
          ))}
        </div>
        <div className="rail-footnote">
          Контуры с deploy script: {props.snapshot.summary.deployConfigured}
        </div>
      </section>

      <section className="rail-card">
        <div className="rail-title">Активные блокеры</div>
        <div className="blocker-list">
          {blockers.map((task) => (
            <article key={task.id} className="blocker-item">
              <div>
                <strong>{task.project}</strong>
                <p>{task.title}</p>
              </div>
              <span className={`health-pill ${task.status === "blocked" ? "tone-risk" : "tone-attention"}`}>
                {STATUS_LABELS[task.status]}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="rail-card rail-card-slim">
        <div className="rail-title">Недельная скорость</div>
        <div className={`velocity ${props.snapshot.summary.weeklyVelocity >= 0 ? "velocity-up" : "velocity-down"}`}>
          {props.snapshot.summary.weeklyVelocity >= 0 ? "+" : ""}
          {props.snapshot.summary.weeklyVelocity}%
        </div>
        <p>
          done {props.snapshot.summary.completedTasks} · active {props.snapshot.summary.activeTasks}
        </p>
      </section>

      <section className="rail-card rail-card-slim">
        <div className="rail-title">Грязные репозитории</div>
        <div className="rail-hero-number">{props.snapshot.summary.dirtyRepos}</div>
        <p>из {props.snapshot.summary.totalRepos} реп в inventory</p>
      </section>

      <section className="rail-card">
        <div className="rail-title">Система / GPU</div>
        <div className="system-grid">
          <div>
            <span>system</span>
            <strong>{props.snapshot.system.systemStatus}</strong>
          </div>
          <div>
            <span>mode</span>
            <strong>{props.snapshot.system.safeMode ? "safe mode" : "normal"}</strong>
          </div>
          <div>
            <span>GPU</span>
            <strong>{props.snapshot.system.gpu.memoryTotal ? `${props.snapshot.system.gpu.temperature}°C` : "n/a"}</strong>
          </div>
          <div>
            <span>VRAM</span>
            <strong>
              {props.snapshot.system.gpu.memoryTotal
                ? `${props.snapshot.system.gpu.memoryUsed} / ${props.snapshot.system.gpu.memoryTotal} MiB`
                : "n/a"}
            </strong>
          </div>
        </div>
        <p className="system-note">{props.snapshot.system.topIssue}</p>
      </section>

      <section className="rail-card">
        <div className="rail-title">Последние коммиты</div>
        <div className="commit-list">
          {props.snapshot.recentCommits.map((commit) => (
            <article key={`${commit.project}-${commit.sha}`} className="commit-item">
              <div>
                <strong>{commit.project}</strong>
                <p>{commit.subject}</p>
              </div>
              <span>{fmtRelative(commit.timestamp)}</span>
            </article>
          ))}
        </div>
      </section>
    </aside>
  );
}

function TaskMatrix(props: { tasks: TaskItem[] }) {
  const columns: TaskStatus[] = ["planned", "active", "review", "blocked", "done"];

  return (
    <section className="task-matrix panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Task lattice</div>
          <h3>Матрица задач</h3>
        </div>
      </div>
      <div className="task-columns">
        {columns.map((status) => {
          const columnTasks = props.tasks.filter((task) => task.status === status);
          return (
            <div key={status} className="task-column">
              <div className="task-column-head">
                <span>{STATUS_LABELS[status]}</span>
                <strong>{columnTasks.length}</strong>
              </div>
              <div className="task-column-body">
                {columnTasks.map((task) => (
                  <article key={task.id} className={`task-card ${taskPriorityClass(task.priority)}`}>
                    <div className="task-card-project">{task.project}</div>
                    <strong>{task.title}</strong>
                    <p>{task.note}</p>
                    <div className="task-card-foot">
                      <span>{task.area}</span>
                      <span>{task.priority}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReleaseRadar(props: { projects: ProjectRecord[] }) {
  const releases = props.projects.filter((project) => project.release).slice(0, 6);

  return (
    <section className="release-radar panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Release radar</div>
          <h3>Окна релизов</h3>
        </div>
      </div>
      <div className="radar-body">
        <div className="radar-visual">
          <div className="radar-ring radar-ring-1" />
          <div className="radar-ring radar-ring-2" />
          <div className="radar-ring radar-ring-3" />
          <div className="radar-ring radar-ring-4" />
          {releases.map((project, index) => (
            <span
              key={project.id}
              className="radar-dot"
              style={{
                left: `${22 + (index % 3) * 24}%`,
                top: `${18 + index * 10}%`,
              }}
            />
          ))}
        </div>
        <div className="release-list">
          {releases.map((project) => (
            <article key={project.id} className="release-row">
              <div>
                <strong>{project.name}</strong>
                <p>{project.release?.label}</p>
              </div>
              <div className="release-row-meta">
                <span>{project.release?.days} дн</span>
                <span>{project.release?.confidence}%</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RegistryTable(props: {
  projects: ProjectRecord[];
  onCopy: (label: string, value: string) => void;
  onOpen: (label: string, target: string) => void;
  onSelect: (projectId: string) => void;
}) {
  return (
    <section className="registry panel">
      <div className="panel-head">
        <div>
          <div className="section-kicker">Registry</div>
          <h3>Все репозитории</h3>
        </div>
      </div>
      <div className="registry-table">
        {props.projects.map((project) => (
          <article key={`${project.id}:${project.repoPath}`} className="registry-row">
            <div>
              <strong>{project.name}</strong>
              <p>{project.summary}</p>
            </div>
            <div>{DOMAIN_LABELS[project.domain]}</div>
            <div>
              <span className={`health-pill ${toneClass(project.healthTone)}`}>{HEALTH_LABELS[project.healthTone]}</span>
            </div>
            <div>{project.dirtyCount}</div>
            <div>{fmtRelative(project.lastCommit.timestamp)}</div>
            <div className="registry-actions">
              <button type="button" onClick={() => props.onSelect(project.id)}>
                focus
              </button>
              <button
                type="button"
                onClick={() => props.onOpen(project.name, project.quickOpen.vscode || project.quickOpen.root)}
              >
                code
              </button>
              <button type="button" onClick={() => props.onCopy(project.name, project.paths.root)}>
                path
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [remoteState, setRemoteState] = useState<RemoteControlState | null>(null);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [theme, setTheme] = useState<AtlasTheme>(() => readInitialTheme());
  const [activeNav, setActiveNav] = useState(NAV_ITEMS[0].id);
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<ProjectDomain | "all">("all");
  const [selectedId, setSelectedId] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refreshSnapshot = (announce = false) => {
    fetch("./snapshot.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`snapshot: ${response.status}`);
        }
        return response.json();
      })
      .then((data: Snapshot) => {
        setSnapshot(data);
        setError("");
        if (!selectedId && data.focusProjectIds.length > 0) {
          setSelectedId(data.focusProjectIds[0]);
        }
        if (announce) {
          setNotice("Snapshot обновлён");
        }
      })
      .catch((reason) => {
        const message = String(reason);
        if (snapshot) {
          setNotice(`Не удалось обновить snapshot: ${message}`);
          return;
        }
        setError(message);
      });
  };

  const refreshRemoteState = (announce = false) => {
    setRemoteBusy(true);
    fetch("./api/remote/state", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`remote: ${response.status}`);
        }
        return response.json();
      })
      .then((data: { state?: RemoteControlState }) => {
        if (data.state) {
          setRemoteState(data.state);
          if (announce) {
            setNotice("Remote state обновлён");
          }
        }
      })
      .catch((reason) => setNotice(`Не удалось обновить remote state: ${String(reason)}`))
      .finally(() => setRemoteBusy(false));
  };

  const runRemoteAction = (action: string) => {
    setRemoteBusy(true);
    fetch("./api/remote/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`remote action: ${response.status}`);
        }
        return response.json();
      })
      .then((data: { message?: string; state?: RemoteControlState }) => {
        if (data.state) {
          setRemoteState(data.state);
        }
        setNotice(data.message || `Action done: ${action}`);
      })
      .catch((reason) => setNotice(`Не удалось выполнить remote action: ${String(reason)}`))
      .finally(() => setRemoteBusy(false));
  };

  useEffect(() => {
    refreshSnapshot();
    refreshRemoteState();
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [theme]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 1800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filteredProjects = useMemo(() => {
    if (!snapshot) return [];
    const lowerQuery = query.trim().toLowerCase();
    return snapshot.projects.filter((project) => {
      const matchesQuery =
        !lowerQuery ||
        [
          project.name,
          project.title,
          project.summary,
          project.tags.join(" "),
          project.domain,
          project.branch,
        ]
          .join(" ")
          .toLowerCase()
          .includes(lowerQuery);
      const matchesDomain = domainFilter === "all" || project.domain === domainFilter;
      return matchesQuery && matchesDomain;
    });
  }, [domainFilter, query, snapshot]);

  const focusProjects = useMemo(
    () => filteredProjects.filter((project) => project.focus && project.position),
    [filteredProjects],
  );

  const selectedProject =
    filteredProjects.find((project) => project.id === selectedId) ??
    snapshot?.projects.find((project) => project.id === selectedId) ??
    focusProjects[0] ??
    filteredProjects[0] ??
    null;
  const mission = snapshot ? deriveMissionState(snapshot) : null;

  useEffect(() => {
    if (!selectedProject && focusProjects[0]) {
      setSelectedId(focusProjects[0].id);
    }
  }, [focusProjects, selectedProject]);

  const jumpToSection = (sectionId: string) => {
    setActiveNav(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const copy = (label: string, value: string) => {
    copyText(value)
      .then(() => setNotice(`Скопировано: ${label}`))
      .catch(() => setNotice(`Не удалось скопировать: ${label}`));
  };

  if (error) {
    return <main className="boot-state">Ошибка загрузки snapshot: {error}</main>;
  }

  if (!snapshot || !selectedProject) {
    return <main className="boot-state">Собираю Project Atlas…</main>;
  }

  const gpuSummary = snapshot.system.gpu.memoryTotal
    ? `${snapshot.system.gpu.temperature}°C · ${snapshot.system.gpu.memoryUsed}/${snapshot.system.gpu.memoryTotal} MiB`
    : snapshot.system.gpuNote || "host telemetry unavailable in current shell";
  const selectedOpenTasks = selectedProject.tasks.filter((task) => task.status !== "done").length;
  const selectedHotTasks = selectedProject.tasks.filter(
    (task) => task.status === "active" || task.status === "review",
  ).length;
  const selectedReleaseLabel = selectedProject.release
    ? `${selectedProject.release.label} · ${selectedProject.release.confidence}% confidence`
    : "релизное окно ещё не зафиксировано";

  const open = (label: string, target: string) => {
    const normalizedTarget = normalizeOpenTarget(target);
    openHostTarget(normalizedTarget)
      .then(() => setNotice(`Открыто: ${label}`))
      .catch(() => {
        const fallback = window.open(normalizedTarget, "_blank", "noopener,noreferrer");
        if (fallback || normalizedTarget.startsWith("file://") || normalizedTarget.startsWith("vscode://")) {
          setNotice(`Открыто: ${label}`);
          return;
        }
        setNotice(`Не удалось открыть: ${label}`);
      });
  };

  return (
    <div className="atlas-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">△</div>
          <div>
            <div className="brand-name">PROJECT ATLAS</div>
            <div className="brand-subtitle">local-first command center</div>
          </div>
          </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${item.id === activeNav ? "nav-item-active" : ""}`}
              type="button"
              onClick={() => jumpToSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <section className="sidebar-card">
          <div className="section-kicker">Быстрые действия</div>
          <button className="sidebar-cta" type="button" onClick={() => refreshSnapshot(true)}>
            Обновить снимок
          </button>
          <button
            className="sidebar-ghost"
            type="button"
            onClick={() => open("project", selectedProject.quickOpen.vscode || selectedProject.quickOpen.root)}
          >
            Открыть проект в code
          </button>
          <button className="sidebar-ghost" type="button" onClick={() => copy("selected repo", selectedProject.paths.root)}>
            Копировать путь текущего проекта
          </button>
        </section>

        <footer className="sidebar-footer">
          <div className="avatar">GA</div>
          <div>
            <strong>dev-on-adrenaline</strong>
            <span>локальный режим</span>
          </div>
        </footer>
      </aside>

      <div className="main-frame">
        <header className="topbar">
          <div className="topbar-search-row">
            <label className="searchbar">
              <input
                type="text"
                value={query}
                placeholder="Поиск по проектам, тегам, задачам"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <div className="topbar-filters">
              <select value={domainFilter} onChange={(event) => setDomainFilter(event.target.value as ProjectDomain | "all")}>
                <option value="all">Все домены</option>
                {Object.entries(DOMAIN_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="topbar-meta">
            <div className="sync-meta">
              <div>Синхронизировано {fmtRelative(new Date(snapshot.generatedAt).getTime())}</div>
              <div className={`sync-dot ${snapshot.system.safeMode ? "sync-dot-warn" : ""}`} />
            </div>

            <div className="topbar-ribbon">
              <span className="ribbon-pill">goal {mission?.activeGoal?.goalId || "unknown"}</span>
              <span className={`ribbon-pill ${snapshot.system.safeMode ? "ribbon-pill-warn" : "ribbon-pill-ok"}`}>
                {snapshot.system.safeMode ? "safe mode" : "runtime normal"}
              </span>
              <span className={`ribbon-pill ${mission?.openclawTone === "risk" ? "ribbon-pill-warn" : ""}`}>
                OpenClaw {mission?.openclawLabel || "unknown"}
              </span>
              <span className="ribbon-pill">tokens {mission?.tokenLabel || "unknown"}</span>
            </div>
          </div>

          <div className="topbar-actions">
            <ThemeSwitcher theme={theme} onChange={setTheme} />
            <button className="primary-button" type="button" onClick={() => refreshSnapshot(true)}>
              Обновить снимок
            </button>
          </div>
        </header>

        {notice ? <div className="notice">{notice}</div> : null}

        <main className="dashboard">
          {mission ? <CommandDeckPanel snapshot={snapshot} mission={mission} onOpen={open} onCopy={copy} /> : null}

          <section className="hero-spotlight panel">
            <div className="hero-spotlight-copy">
              <div>
                <div className="section-kicker">Focus deck</div>
                <h1>{selectedProject.title}</h1>
                <p>{selectedProject.summary}</p>
              </div>
              <div className="spotlight-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => open("project", selectedProject.quickOpen.vscode || selectedProject.quickOpen.root)}
                >
                  Открыть проект
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() =>
                    open(
                      "docs",
                      selectedProject.quickOpen.docs || selectedProject.quickOpen.readme || selectedProject.paths.root,
                    )
                  }
                >
                  Открыть docs
                </button>
              </div>
            </div>
            <div className="spotlight-grid">
              <article className="spotlight-stat">
                <span>Текущий pressure</span>
                <strong>{selectedProject.dirtyCount} dirty</strong>
                <p>{selectedProject.healthTone === "ok" ? "repo looks stable" : selectedProject.riskNotes[0] ?? snapshot.system.topIssue}</p>
              </article>
              <article className="spotlight-stat">
                <span>Таски в движении</span>
                <strong>{selectedHotTasks}</strong>
                <p>{selectedOpenTasks} открытых задач по текущему проекту</p>
              </article>
              <article className="spotlight-stat">
                <span>Release pulse</span>
                <strong>{selectedProject.deploy?.environment ?? "local-only"}</strong>
                <p>{selectedReleaseLabel}</p>
              </article>
              <article className="spotlight-stat">
                <span>Последний импульс</span>
                <strong>{fmtRelative(selectedProject.lastCommit.timestamp)}</strong>
                <p>{selectedProject.lastCommit.subject}</p>
              </article>
            </div>
          </section>

          <section className="hero-grid">
            <MetricCard
              label="Всего реп"
              value={snapshot.summary.totalRepos}
              detail={`${snapshot.summary.focusRepos} фокусных поверхностей`}
            />
            <MetricCard
              label="Грязные репы"
              value={snapshot.summary.dirtyRepos}
              detail="живой worktree pressure"
            />
            <MetricCard
              label="Deploy контуры"
              value={snapshot.summary.deployConfigured}
              detail="команды уже детектированы"
            />
            <MetricCard
              label="Safe mode"
              value={snapshot.system.safeMode ? "ON" : "OFF"}
              detail={snapshot.system.topIssue}
            />
          </section>

          {mission ? (
            <div id="local-codex" className="panel-stack">
              <HostHealthPanel audit={snapshot.hostAudit} onOpen={open} onCopy={copy} />
              <RuntimeRegistryPanel control={snapshot.localAiControl} onOpen={open} onCopy={copy} />
              <TokenEconomyPanel telemetry={snapshot.aiTelemetry} onOpen={open} onCopy={copy} />
              <AiActivityExplorerPanel telemetry={snapshot.aiTelemetry} onOpen={open} onCopy={copy} />
              <AgentTracePanel telemetry={snapshot.aiTelemetry} onOpen={open} onCopy={copy} />
              <CacheLedgerPanel telemetry={snapshot.aiTelemetry} onOpen={open} onCopy={copy} />
              <RedundantWorkPanel telemetry={snapshot.aiTelemetry} onOpen={open} onCopy={copy} />
              <BudgetDriftPanel telemetry={snapshot.aiTelemetry} onOpen={open} onCopy={copy} />
              <RetrievalQualityPanel telemetry={snapshot.aiTelemetry} onOpen={open} onCopy={copy} />
              <CodeContextSearchPanel telemetry={snapshot.aiTelemetry} onOpen={open} onCopy={copy} />
              <ModelRoleMapPanel telemetry={snapshot.aiTelemetry} control={snapshot.localAiControl} onOpen={open} onCopy={copy} />
              <AgentBoardPanel control={snapshot.localAiControl} onOpen={open} onCopy={copy} />
              <OpenClawSecurityPanelV2 control={snapshot.localAiControl} onOpen={open} onCopy={copy} />
              <SkillsRegistryPanel telemetry={snapshot.aiTelemetry} onOpen={open} onCopy={copy} />
              <SkillUsagePanel telemetry={snapshot.aiTelemetry} onOpen={open} onCopy={copy} />
              <CodexProductivityPanel telemetry={snapshot.aiTelemetry} onOpen={open} onCopy={copy} />
              <LocalFallbackPanel mission={mission} source={snapshot.localCodexLab.source} onOpen={open} onCopy={copy} />
              <TokenWastePanel telemetry={snapshot.aiTelemetry} lab={snapshot.localCodexLab} mission={mission} onOpen={open} onCopy={copy} />
              <OpenClawReliabilityPanel lab={snapshot.localCodexLab} mission={mission} onOpen={open} onCopy={copy} />
              <LocalCodexLabPanel lab={snapshot.localCodexLab} commercial={snapshot.commercialReadiness} onOpen={open} onCopy={copy} />
              <TimelinePanel runSummaries={snapshot.localCodexLab.runSummaries} onOpen={open} onCopy={copy} />
            </div>
          ) : null}

          <div id="remote-ops">
            <RemoteOpsPanel
              state={remoteState}
              busy={remoteBusy}
              onAction={runRemoteAction}
              onCopy={copy}
              onRefresh={() => refreshRemoteState(true)}
            />
          </div>

          <div id="project-map" className="map-layout">
            <div className="map-column">
              <section className="project-map panel">
                <div className="panel-head">
                  <div>
                    <div className="section-kicker">Карта проектов</div>
                    <h3>Mission control по активным репам</h3>
                  </div>
                  <div className="panel-hint">focus {focusProjects.length} · query {filteredProjects.length}</div>
                </div>
                <div className="map-canvas">
                  <GraphLinks projects={focusProjects} />
                  {focusProjects.map((project) => (
                    <ProjectNode
                      key={project.id}
                      project={project}
                      active={project.id === selectedProject.id}
                      onSelect={(id) => {
                        setSelectedId(id);
                        setDetailTab("overview");
                      }}
                    />
                  ))}
                </div>
                <div className="map-legend">
                  <span><i className="legend-line" /> зависимость / общий контур</span>
                  <span><i className="legend-dot legend-dot-ok" /> healthy</span>
                  <span><i className="legend-dot legend-dot-attention" /> needs attention</span>
                  <span><i className="legend-dot legend-dot-risk" /> blocked / risky</span>
                </div>
              </section>

              <SelectedProjectPanel
                project={selectedProject}
                allProjects={snapshot.projects}
                activeTab={detailTab}
                onTabChange={setDetailTab}
                onCopy={copy}
                onOpen={open}
              />
            </div>

            <IntelligenceRail snapshot={snapshot} projects={filteredProjects} />
          </div>

          <div className="lower-grid">
            <TaskMatrix tasks={snapshot.tasks} />
            <ReleaseRadar projects={snapshot.projects.filter((project) => project.focus)} />
          </div>

          <div id="registry">
            <RegistryTable
              projects={filteredProjects}
              onCopy={copy}
              onOpen={open}
              onSelect={(projectId) => {
                setSelectedId(projectId);
                setDetailTab("overview");
              }}
            />
          </div>
          <section className="footer-note">
            <span className="section-kicker">Context</span>
            <p>
              Host pulse: {snapshot.system.systemStatus} · GPU {gpuSummary} · Hyprland {" "}
              {snapshot.system.hyprlandOnline ? "online" : "unconfirmed"}.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
