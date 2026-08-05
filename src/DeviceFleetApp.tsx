import { useEffect, useMemo, useState } from "react";
import "./styles/device-fleet.css";

type Health = "ok" | "attention" | "risk" | "unknown";
type DeviceStatus = "online" | "stale" | "offline" | "enrolling" | "unknown";

type FleetArtifact = {
  kind: string;
  contentType: string;
  filename: string;
  url: string;
  size: number;
  createdAt: string;
};

type FleetCommand = {
  id: string;
  deviceId: string;
  type: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  result?: {
    message?: string;
    artifact?: FleetArtifact;
  } | null;
};

type FleetEvent = {
  id: string;
  type: string;
  deviceId: string;
  createdAt: string;
};

type FleetDevice = {
  id: string;
  name: string;
  hostname: string;
  osVersion: string;
  agentVersion: string;
  groups: string[];
  tags: string[];
  capabilities: string[];
  lastSeenAt: string | null;
  status: DeviceStatus;
  health: Health;
  queuedCommands: number;
  lastArtifact: FleetArtifact | null;
  telemetry: {
    system: {
      cpuPercent: number;
      memoryPercent: number;
      memoryUsedGb: number;
      memoryTotalGb: number;
      uptimeSeconds: number;
      rebootPending: boolean;
    };
    os: {
      caption: string;
      version: string;
      build: string;
      architecture: string;
    };
    disks: Array<{
      name: string;
      label: string;
      sizeGb: number;
      freeGb: number;
      freePercent: number;
    }>;
    gpus: Array<{
      name: string;
      utilizationPercent: number;
      memoryUsedMb: number;
      memoryTotalMb: number;
      temperatureC: number;
    }>;
    network: {
      ipv4: string[];
      tailscaleIp: string;
    };
    cameras: Array<{
      id: string;
      name: string;
      status: string;
      ffmpegName: string;
    }>;
    processes: Array<{
      name: string;
      pid: number;
      cpuSeconds: number;
      workingSetMb: number;
    }>;
    remote: {
      rustdeskInstalled: boolean;
      rustdeskRunning: boolean;
      rustdeskId: string;
      sunshineInstalled: boolean;
      sunshineRunning: boolean;
      rdpEnabled: boolean;
      tailscaleConnected: boolean;
    };
    agent: {
      version: string;
      serviceState: string;
      lastError: string;
    };
  } | null;
};

type FleetState = {
  enrollmentEnabled: boolean;
  security: {
    transport: string;
    deviceAuthentication: string;
    arbitraryShell: boolean;
  };
  counts: {
    total: number;
    online: number;
    attention: number;
    risk: number;
    offline: number;
    queuedCommands: number;
  };
  devices: FleetDevice[];
  recentCommands: FleetCommand[];
  recentEvents: FleetEvent[];
};

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

const COMMAND_LABELS: Record<string, string> = {
  refresh_telemetry: "Обновить телеметрию",
  run_health_check: "Диагностика",
  lock_screen: "Заблокировать экран",
  restart_agent: "Перезапустить агент",
  camera_snapshot: "Снимок камеры",
  open_rustdesk: "Запустить RustDesk",
  open_sunshine: "Запустить Sunshine",
  restart_pc: "Перезагрузить ПК",
  shutdown_pc: "Выключить ПК",
};

function relativeTime(value: string | null) {
  if (!value) return "ещё не подключался";
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 10) return "только что";
  if (seconds < 60) return `${seconds} сек назад`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.round(hours / 24)} дн назад`;
}

function formatUptime(seconds = 0) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return [days ? `${days}д` : "", hours ? `${hours}ч` : "", `${minutes}м`]
    .filter(Boolean)
    .join(" ");
}

function statusLabel(status: DeviceStatus) {
  if (status === "online") return "Онлайн";
  if (status === "stale") return "Связь нестабильна";
  if (status === "offline") return "Офлайн";
  if (status === "enrolling") return "Ожидает heartbeat";
  return "Неизвестно";
}

function healthLabel(health: Health) {
  if (health === "ok") return "Норма";
  if (health === "attention") return "Внимание";
  if (health === "risk") return "Риск";
  return "Нет данных";
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });
  const payload = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !payload.ok || payload.data === undefined) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload.data;
}

function MetricBar(props: { label: string; value: number; detail: string }) {
  const value = Math.min(100, Math.max(0, props.value || 0));
  return (
    <div className="fleet-metric">
      <div><span>{props.label}</span><strong>{props.detail}</strong></div>
      <div className="fleet-progress"><span style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function DeviceList(props: {
  devices: FleetDevice[];
  selectedId: string;
  onSelect: (deviceId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const devices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return props.devices;
    return props.devices.filter((device) => [
      device.name,
      device.hostname,
      device.id,
      ...device.groups,
      ...device.tags,
    ].join(" ").toLowerCase().includes(normalized));
  }, [props.devices, query]);

  return (
    <aside className="fleet-sidebar">
      <div className="fleet-sidebar-heading">
        <div><span className="fleet-eyebrow">Fleet</span><h2>Устройства</h2></div>
        <span className="fleet-count">{props.devices.length}</span>
      </div>
      <input
        className="fleet-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Имя, host, группа"
      />
      <div className="fleet-device-list">
        {devices.map((device) => (
          <button
            key={device.id}
            type="button"
            className={`fleet-device-item ${props.selectedId === device.id ? "is-selected" : ""}`}
            onClick={() => props.onSelect(device.id)}
          >
            <span className={`fleet-status-dot is-${device.status}`} />
            <span className="fleet-device-copy">
              <strong>{device.name}</strong>
              <small>{device.hostname} · {relativeTime(device.lastSeenAt)}</small>
            </span>
            <span className={`fleet-health-chip is-${device.health}`}>{healthLabel(device.health)}</span>
          </button>
        ))}
        {devices.length === 0 ? <div className="fleet-list-empty">Ничего не найдено</div> : null}
      </div>
    </aside>
  );
}

function SummaryCards(props: { state: FleetState }) {
  const cards = [
    ["Всего", props.state.counts.total, "зарегистрировано"],
    ["Онлайн", props.state.counts.online, "heartbeat ≤ 90 сек"],
    ["Требуют внимания", props.state.counts.attention + props.state.counts.risk, "health alerts"],
    ["Команды", props.state.counts.queuedCommands, "queued / delivered"],
  ];
  return (
    <section className="fleet-summary-grid">
      {cards.map(([label, value, note]) => (
        <article key={String(label)} className="fleet-summary-card">
          <span>{label}</span><strong>{value}</strong><small>{note}</small>
        </article>
      ))}
    </section>
  );
}

function EmptyFleet(props: { enrollmentEnabled: boolean }) {
  return (
    <section className="fleet-empty">
      <div className="fleet-empty-icon">PC</div>
      <h2>Подключённых Windows-компьютеров пока нет</h2>
      <p>Агент работает исходящими запросами. Входящие порты на Windows открывать не нужно.</p>
      <ol>
        <li>Задайте <code>PROJECT_ATLAS_ENROLLMENT_TOKEN</code> для Atlas.</li>
        <li>Откройте PowerShell на Windows от администратора.</li>
        <li>Запустите <code>agents/windows/install-atlas-device-agent.ps1</code>.</li>
      </ol>
      <div className={`fleet-callout ${props.enrollmentEnabled ? "is-ok" : "is-warning"}`}>
        {props.enrollmentEnabled
          ? "Enrollment включён. Можно подключать первый компьютер."
          : "Enrollment выключен: отсутствует PROJECT_ATLAS_ENROLLMENT_TOKEN."}
      </div>
    </section>
  );
}

function RemoteAccess(props: {
  device: FleetDevice;
  busy: boolean;
  onCommand: (type: string) => Promise<void>;
  onCopy: (value: string) => Promise<void>;
}) {
  const remote = props.device.telemetry?.remote;
  const network = props.device.telemetry?.network;
  if (!remote) return <section className="fleet-panel">Remote telemetry пока не получена.</section>;
  const address = network?.tailscaleIp || network?.ipv4[0] || "";

  return (
    <section className="fleet-panel">
      <div className="fleet-panel-heading">
        <div><span className="fleet-eyebrow">Remote</span><h3>Подключение</h3></div>
        <span className={`fleet-pill ${remote.tailscaleConnected ? "is-ok" : "is-warning"}`}>
          {remote.tailscaleConnected ? "Tailscale online" : "Tailscale offline"}
        </span>
      </div>
      <div className="fleet-remote-grid">
        <article>
          <strong>RustDesk</strong>
          <span>{remote.rustdeskInstalled ? (remote.rustdeskRunning ? "Запущен" : "Не запущен") : "Не установлен"}</span>
          {remote.rustdeskId ? <button type="button" onClick={() => props.onCopy(remote.rustdeskId)}>ID: {remote.rustdeskId}</button> : null}
          {remote.rustdeskInstalled && !remote.rustdeskRunning ? <button type="button" disabled={props.busy} onClick={() => props.onCommand("open_rustdesk")}>Запустить</button> : null}
        </article>
        <article>
          <strong>Sunshine</strong>
          <span>{remote.sunshineInstalled ? (remote.sunshineRunning ? "Стриминг готов" : "Не запущен") : "Не установлен"}</span>
          {remote.sunshineInstalled && !remote.sunshineRunning ? <button type="button" disabled={props.busy} onClick={() => props.onCommand("open_sunshine")}>Запустить</button> : null}
        </article>
        <article><strong>RDP</strong><span>{remote.rdpEnabled ? "Включён" : "Выключен"}</span><small>Автоматически не включается.</small></article>
        <article><strong>Адрес</strong><span>{address || "Нет адреса"}</span>{address ? <button type="button" onClick={() => props.onCopy(address)}>Копировать</button> : null}</article>
      </div>
    </section>
  );
}

function CameraPanel(props: {
  device: FleetDevice;
  busy: boolean;
  onSnapshot: (cameraName: string) => Promise<void>;
}) {
  const cameras = props.device.telemetry?.cameras || [];
  return (
    <section className="fleet-panel">
      <div className="fleet-panel-heading">
        <div><span className="fleet-eyebrow">Vision</span><h3>Камеры</h3></div>
        <span className="fleet-count">{cameras.length}</span>
      </div>
      {props.device.lastArtifact?.url ? (
        <figure className="fleet-camera-preview">
          <img src={props.device.lastArtifact.url} alt={`Последний снимок ${props.device.name}`} />
          <figcaption>Последний снимок · {relativeTime(props.device.lastArtifact.createdAt)}</figcaption>
        </figure>
      ) : null}
      <div className="fleet-camera-list">
        {cameras.map((camera) => (
          <article key={camera.id || camera.name}>
            <div><strong>{camera.name}</strong><small>{camera.status || "unknown"}</small></div>
            <button type="button" disabled={props.busy || !camera.ffmpegName} onClick={() => props.onSnapshot(camera.ffmpegName || camera.name)}>Снимок</button>
          </article>
        ))}
        {cameras.length === 0 ? <div className="fleet-muted-block">Windows не сообщил доступных камер.</div> : null}
      </div>
    </section>
  );
}

function DevWorkspace(props: { device: FleetDevice }) {
  const [task, setTask] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function prepare() {
    if (!task.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{ prompt: string }>("/api/fleet/dev/prepare", {
        method: "POST",
        body: JSON.stringify({ deviceId: props.device.id, task }),
      });
      setPrompt(result.prompt);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="fleet-panel fleet-dev-panel">
      <div className="fleet-panel-heading">
        <div><span className="fleet-eyebrow">Dev mode</span><h3>Device-scoped prompting</h3></div>
        <span className="fleet-pill is-ok">No arbitrary shell</span>
      </div>
      <p>Prompt получает свежую телеметрию выбранного ПК и не выдумывает недоступные runtime-факты.</p>
      <textarea value={task} onChange={(event) => setTask(event.target.value)} placeholder="Например: найти первопричину нестабильного мониторинга GPU" />
      <div className="fleet-button-row">
        <button type="button" className="is-primary" disabled={busy || !task.trim()} onClick={prepare}>{busy ? "Подготовка…" : "Подготовить prompt"}</button>
        {prompt ? <button type="button" onClick={() => navigator.clipboard.writeText(prompt)}>Копировать</button> : null}
      </div>
      {error ? <div className="fleet-error">{error}</div> : null}
      {prompt ? <textarea className="fleet-prepared-prompt" readOnly value={prompt} /> : null}
    </section>
  );
}

function DeviceWorkspace(props: {
  device: FleetDevice;
  commands: FleetCommand[];
  events: FleetEvent[];
  onRefresh: () => Promise<void>;
}) {
  const [busyCommand, setBusyCommand] = useState("");
  const [message, setMessage] = useState("");
  const telemetry = props.device.telemetry;
  const gpu = telemetry?.gpus[0];

  async function enqueue(type: string, payload: Record<string, unknown> = {}) {
    let confirmDeviceName = "";
    if (type === "restart_pc" || type === "shutdown_pc") {
      confirmDeviceName = window.prompt(`Введите точное имя устройства: ${props.device.name}`) || "";
      if (confirmDeviceName !== props.device.name) {
        setMessage("Действие отменено: имя устройства не совпало.");
        return;
      }
    }
    setBusyCommand(type);
    setMessage("");
    try {
      await apiRequest(`/api/fleet/devices/${encodeURIComponent(props.device.id)}/commands`, {
        method: "POST",
        body: JSON.stringify({ type, payload, confirmDeviceName }),
      });
      setMessage("Команда поставлена в подписанную очередь.");
      await props.onRefresh();
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setBusyCommand("");
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setMessage("Скопировано.");
  }

  const commands = props.commands.filter((command) => command.deviceId === props.device.id).slice(0, 12);
  const events = props.events.filter((event) => event.deviceId === props.device.id).slice(0, 12);

  return (
    <div className="fleet-device-workspace">
      <section className="fleet-device-hero">
        <div>
          <div className="fleet-title-row"><span className={`fleet-status-dot is-${props.device.status}`} /><span className="fleet-eyebrow">{props.device.id}</span></div>
          <h2>{props.device.name}</h2>
          <p>{props.device.hostname} · {telemetry?.os.caption || props.device.osVersion || "Windows"}</p>
        </div>
        <div className="fleet-hero-status">
          <span className={`fleet-pill is-${props.device.health}`}>{healthLabel(props.device.health)}</span>
          <strong>{statusLabel(props.device.status)}</strong>
          <small>{relativeTime(props.device.lastSeenAt)}</small>
        </div>
      </section>

      <section className="fleet-actions">
        {["refresh_telemetry", "run_health_check", "lock_screen", "restart_agent"].map((type) => (
          <button key={type} type="button" disabled={Boolean(busyCommand)} onClick={() => enqueue(type)}>{busyCommand === type ? "Отправка…" : COMMAND_LABELS[type]}</button>
        ))}
        <button className="is-danger" type="button" disabled={Boolean(busyCommand)} onClick={() => enqueue("restart_pc")}>Перезагрузить</button>
        <button className="is-danger" type="button" disabled={Boolean(busyCommand)} onClick={() => enqueue("shutdown_pc")}>Выключить</button>
      </section>
      {message ? <div className="fleet-message">{message}</div> : null}

      <section className="fleet-telemetry-grid">
        <article className="fleet-panel">
          <div className="fleet-panel-heading"><h3>Система</h3><span>{formatUptime(telemetry?.system.uptimeSeconds)} uptime</span></div>
          <MetricBar label="CPU" value={telemetry?.system.cpuPercent || 0} detail={`${(telemetry?.system.cpuPercent || 0).toFixed(0)}%`} />
          <MetricBar label="RAM" value={telemetry?.system.memoryPercent || 0} detail={`${(telemetry?.system.memoryUsedGb || 0).toFixed(1)} / ${(telemetry?.system.memoryTotalGb || 0).toFixed(1)} GB`} />
          {gpu ? <MetricBar label="GPU" value={gpu.utilizationPercent} detail={`${gpu.utilizationPercent.toFixed(0)}% · ${gpu.temperatureC.toFixed(0)}°C`} /> : <div className="fleet-muted-block">GPU telemetry отсутствует.</div>}
          {telemetry?.system.rebootPending ? <div className="fleet-callout is-warning">Windows ожидает перезагрузку.</div> : null}
        </article>

        <article className="fleet-panel">
          <div className="fleet-panel-heading"><h3>Диски</h3><span>{telemetry?.disks.length || 0}</span></div>
          <div className="fleet-disk-list">
            {(telemetry?.disks || []).map((disk) => <div key={disk.name}><span><strong>{disk.name}</strong> {disk.label}</span><span>{disk.freeGb.toFixed(1)} GB · {disk.freePercent.toFixed(0)}%</span></div>)}
            {!telemetry?.disks.length ? <div className="fleet-muted-block">Нет данных.</div> : null}
          </div>
        </article>

        <article className="fleet-panel">
          <div className="fleet-panel-heading"><h3>Agent</h3><span>{telemetry?.agent.version || props.device.agentVersion || "unknown"}</span></div>
          <dl className="fleet-definition-list">
            <div><dt>Состояние</dt><dd>{telemetry?.agent.serviceState || "unknown"}</dd></div>
            <div><dt>Capabilities</dt><dd>{props.device.capabilities.join(", ") || "—"}</dd></div>
            <div><dt>IP</dt><dd>{telemetry?.network.tailscaleIp || telemetry?.network.ipv4.join(", ") || "—"}</dd></div>
          </dl>
          {telemetry?.agent.lastError ? <div className="fleet-error">{telemetry.agent.lastError}</div> : null}
        </article>
      </section>

      <RemoteAccess device={props.device} busy={Boolean(busyCommand)} onCommand={enqueue} onCopy={copy} />
      <CameraPanel device={props.device} busy={Boolean(busyCommand)} onSnapshot={(cameraName) => enqueue("camera_snapshot", { cameraName })} />
      <DevWorkspace device={props.device} />

      <section className="fleet-two-column">
        <article className="fleet-panel">
          <div className="fleet-panel-heading"><h3>Последние команды</h3><span>{commands.length}</span></div>
          <div className="fleet-timeline">
            {commands.map((command) => <div key={command.id}><span className={`fleet-status-dot is-${command.status === "succeeded" ? "online" : command.status === "failed" ? "offline" : "stale"}`} /><div><strong>{COMMAND_LABELS[command.type] || command.type}</strong><small>{command.status} · {relativeTime(command.completedAt || command.createdAt)}</small></div></div>)}
            {commands.length === 0 ? <div className="fleet-muted-block">Команд ещё не было.</div> : null}
          </div>
        </article>
        <article className="fleet-panel">
          <div className="fleet-panel-heading"><h3>Device timeline</h3><span>{events.length}</span></div>
          <div className="fleet-timeline">
            {events.map((event) => <div key={event.id}><span className="fleet-status-dot is-online" /><div><strong>{event.type.replaceAll("_", " ")}</strong><small>{relativeTime(event.createdAt)}</small></div></div>)}
            {events.length === 0 ? <div className="fleet-muted-block">Событий пока нет.</div> : null}
          </div>
        </article>
      </section>
    </div>
  );
}

export function DeviceFleetApp() {
  const [state, setState] = useState<FleetState | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const nextState = await apiRequest<FleetState>("/api/fleet/state");
      setState(nextState);
      setError("");
      setSelectedId((current) => {
        if (current && nextState.devices.some((device) => device.id === current)) return current;
        return nextState.devices.find((device) => device.status === "online")?.id || nextState.devices[0]?.id || "";
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(true);
    const timer = window.setInterval(() => void refresh(false), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedDevice = state?.devices.find((device) => device.id === selectedId) || null;

  return (
    <div className="fleet-root">
      <header className="fleet-topbar">
        <div className="fleet-brand">
          <a href="#/overview" className="fleet-back">← Atlas</a>
          <div><span>Project Atlas</span><strong>Windows Fleet Control</strong></div>
        </div>
        <div className="fleet-topbar-actions">
          <a className="fleet-legacy-link" href="?legacyRemote=1#/remote">Legacy Remote</a>
          <span className={`fleet-live ${error ? "is-error" : ""}`}>{error ? "Gateway error" : "Live"}</span>
          <button type="button" disabled={loading} onClick={() => void refresh(true)}>{loading ? "Обновление…" : "Обновить"}</button>
        </div>
      </header>

      {error && !state ? <main className="fleet-fatal"><h1>Fleet gateway недоступен</h1><p>{error}</p><a href="?legacyRemote=1#/remote">Открыть старый Remote</a></main> : null}

      {state ? (
        <div className="fleet-shell">
          <DeviceList devices={state.devices} selectedId={selectedId} onSelect={setSelectedId} />
          <main className="fleet-main">
            <section className="fleet-page-heading">
              <div><span className="fleet-eyebrow">Control plane</span><h1>Windows-инфраструктура</h1><p>Мониторинг, камеры, remote access, безопасные команды и device-scoped AI-контекст.</p></div>
              <div className="fleet-security-badge"><strong>HMAC SHA-256</strong><span>arbitrary shell: {state.security.arbitraryShell ? "enabled" : "disabled"}</span></div>
            </section>
            <SummaryCards state={state} />
            {state.devices.length === 0 ? <EmptyFleet enrollmentEnabled={state.enrollmentEnabled} /> : null}
            {selectedDevice ? <DeviceWorkspace device={selectedDevice} commands={state.recentCommands} events={state.recentEvents} onRefresh={() => refresh(false)} /> : null}
          </main>
        </div>
      ) : null}
    </div>
  );
}
