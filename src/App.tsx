import { useEffect, useMemo, useState } from "react";
import "./index.css";
import type {
  DetailTab,
  HealthTone,
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

type ThemeMode = "light" | "dark";

const NAV_ITEMS = [
  "Обзор",
  "Проекты",
  "Граф",
  "Задачи",
  "Деплой",
  "Аналитика",
  "Риски",
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

const DEFAULT_THEME: ThemeMode = "dark";
const THEME_STORAGE_KEY = "project-atlas-theme";

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

function sourceAge(source: SourceMeta) {
  return source.modifiedAtMs ? fmtRelative(source.modifiedAtMs) : "нет данных";
}

function taskPriorityClass(priority: TaskItem["priority"]) {
  if (priority === "high") return "priority-high";
  if (priority === "medium") return "priority-medium";
  return "priority-low";
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
  onOpen: (label: string, target: string) => void;
  onCopy: (label: string, value: string) => void;
}) {
  const orderedClassifications = Object.entries(props.lab.openclawReliability.classifications).sort((left, right) => right[1] - left[1]);

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
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<ProjectDomain | "all">("all");
  const [selectedId, setSelectedId] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_THEME;
    }

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : DEFAULT_THEME;
  });

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
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 1800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

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

  useEffect(() => {
    if (!selectedProject && focusProjects[0]) {
      setSelectedId(focusProjects[0].id);
    }
  }, [focusProjects, selectedProject]);

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
            <button key={item} className={`nav-item ${item === "Обзор" ? "nav-item-active" : ""}`} type="button">
              {item}
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

          <div className="sync-meta">
            <div>Синхронизировано {fmtRelative(new Date(snapshot.generatedAt).getTime())}</div>
            <div className={`sync-dot ${snapshot.system.safeMode ? "sync-dot-warn" : ""}`} />
          </div>

          <div className="topbar-ribbon">
            <span className="ribbon-pill">focus {selectedProject.title}</span>
            <span className={`ribbon-pill ${snapshot.system.safeMode ? "ribbon-pill-warn" : "ribbon-pill-ok"}`}>
              {snapshot.system.safeMode ? "safe mode" : "runtime normal"}
            </span>
            <span className="ribbon-pill">velocity {snapshot.summary.weeklyVelocity}</span>
          </div>

          <div className="topbar-actions">
            <button className="ghost-button theme-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <button className="primary-button" type="button" onClick={() => refreshSnapshot(true)}>
              Обновить снимок
            </button>
          </div>
        </header>

        {notice ? <div className="notice">{notice}</div> : null}

        <main className="dashboard">
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

          <LocalCodexLabPanel lab={snapshot.localCodexLab} onOpen={open} onCopy={copy} />

          <RemoteOpsPanel
            state={remoteState}
            busy={remoteBusy}
            onAction={runRemoteAction}
            onCopy={copy}
            onRefresh={() => refreshRemoteState(true)}
          />

          <div className="map-layout">
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

          <RegistryTable
            projects={filteredProjects}
            onCopy={copy}
            onOpen={open}
            onSelect={(projectId) => {
              setSelectedId(projectId);
              setDetailTab("overview");
            }}
          />
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
