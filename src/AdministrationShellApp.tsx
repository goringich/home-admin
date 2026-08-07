import { useEffect, useMemo, useState } from "react";
import "./styles/administration-shell.css";

type IntegrationMode = "external" | "embedded" | "proxied" | "native-projection" | "local-source";

type AdministrationSurface = {
  id: string;
  title: string;
  classification: string;
  ownerRepository: string;
  sourceOfTruth: string;
  integrationModes: IntegrationMode[];
  embedding: {
    default: "allowed" | "denied";
    supported: boolean;
    reason: string;
  };
  authBoundary: string;
  mutationOwner: string;
  projectionAllowlist: string[];
  secretPolicy: string;
  fallbackMode: IntegrationMode;
  migrationState: string;
  availability: string;
  launch: {
    label: string;
    target: string;
  };
  runbookTarget: string;
};

type AdministrationManifest = {
  schemaVersion: string;
  generatedAt?: string;
  sourceMode?: string;
  sourceRegistry: string;
  surfaces: AdministrationSurface[];
};

type ShellState = "loading" | "ready" | "error";

const MODE_LABELS: Record<IntegrationMode, string> = {
  external: "Отдельная вкладка",
  embedded: "Встроить",
  proxied: "Через адаптер",
  "native-projection": "Сводка Atlas",
  "local-source": "Локальный источник",
};

function routeSurfaceId(): string {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return parts[0] === "admin" ? parts[1] || "" : "";
}

function isHttpTarget(target: string): boolean {
  return /^https?:\/\//i.test(target);
}

function availabilityTone(value: string): string {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("excluded")) return "muted";
  if (normalized.includes("attention") || normalized.includes("unavailable")) return "attention";
  return "ok";
}

function preferredMode(surface: AdministrationSurface): IntegrationMode {
  if (surface.integrationModes.includes(surface.fallbackMode)) return surface.fallbackMode;
  return surface.integrationModes[0] || "external";
}

export function AdministrationShellApp() {
  const [manifest, setManifest] = useState<AdministrationManifest | null>(null);
  const [state, setState] = useState<ShellState>("loading");
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(routeSurfaceId);
  const [selectedMode, setSelectedMode] = useState<IntegrationMode>("external");
  const [notice, setNotice] = useState("");
  const [frameFailed, setFrameFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/administration-adapters.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`adapter_manifest_http_${response.status}`);
        return response.json() as Promise<AdministrationManifest>;
      })
      .then((payload) => {
        if (!active) return;
        if (!Array.isArray(payload.surfaces) || payload.surfaces.length === 0) {
          throw new Error("adapter_manifest_empty");
        }
        setManifest(payload);
        setState("ready");
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "adapter_manifest_unavailable");
        setState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const update = () => setSelectedId(routeSurfaceId());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  const visibleSurfaces = useMemo(
    () => manifest?.surfaces.filter((surface) => surface.migrationState !== "hidden") || [],
    [manifest],
  );
  const selected = useMemo(
    () => visibleSurfaces.find((surface) => surface.id === selectedId) || visibleSurfaces[0] || null,
    [selectedId, visibleSurfaces],
  );

  useEffect(() => {
    if (!selected) return;
    setSelectedMode(preferredMode(selected));
    setFrameFailed(false);
    setNotice("");
    if (selected.id !== selectedId) {
      window.history.replaceState(null, "", `#/admin/${selected.id}`);
      setSelectedId(selected.id);
    }
  }, [selected, selectedId]);

  async function openTarget(target: string) {
    setNotice("");
    if (!target) {
      setNotice("Точка входа пока не зарегистрирована.");
      return;
    }
    if (isHttpTarget(target)) {
      window.open(target, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      await navigator.clipboard.writeText(target);
      setNotice("Локальный путь скопирован. Открой его на основном компьютере.");
    } catch {
      setNotice(target);
    }
  }

  function chooseSurface(surface: AdministrationSurface) {
    window.location.hash = `/admin/${surface.id}`;
  }

  function modeAvailable(surface: AdministrationSurface, mode: IntegrationMode): boolean {
    if (mode === "embedded") {
      return surface.embedding.supported && isHttpTarget(surface.launch.target);
    }
    if (mode === "proxied") {
      return surface.integrationModes.includes("proxied") && surface.migrationState.includes("ready");
    }
    return true;
  }

  if (state === "loading") {
    return (
      <main className="admin-shell admin-shell-center">
        <div className="admin-shell-loader">Загрузка реестра админок…</div>
      </main>
    );
  }

  if (state === "error" || !manifest || !selected) {
    return (
      <main className="admin-shell admin-shell-center">
        <section className="admin-shell-error">
          <div className="admin-shell-kicker">Atlas / Administration</div>
          <h1>Реестр админок недоступен</h1>
          <p>{error || "Не удалось выбрать зарегистрированную поверхность."}</p>
          <a href="#/overview">Вернуться в Atlas</a>
        </section>
      </main>
    );
  }

  const canEmbed = selectedMode === "embedded" && modeAvailable(selected, "embedded") && !frameFailed;

  return (
    <main className="admin-shell">
      <header className="admin-shell-header">
        <div>
          <div className="admin-shell-kicker">Atlas / Federated Administration</div>
          <h1>Админки</h1>
          <p>Единая оболочка без копирования авторизации и бизнес-логики проектов.</p>
        </div>
        <div className="admin-shell-header-actions">
          <span className="admin-shell-source">{manifest.sourceMode || "registered"}</span>
          <a className="admin-shell-button admin-shell-button-ghost" href="#/overview">Назад в Atlas</a>
        </div>
      </header>

      <div className="admin-shell-layout">
        <aside className="admin-shell-sidebar" aria-label="Registered administration surfaces">
          {visibleSurfaces.map((surface) => (
            <button
              className={`admin-shell-nav-item ${surface.id === selected.id ? "is-active" : ""}`}
              key={surface.id}
              type="button"
              onClick={() => chooseSurface(surface)}
            >
              <span>
                <strong>{surface.title}</strong>
                <small>{surface.ownerRepository}</small>
              </span>
              <i className={`admin-shell-status is-${availabilityTone(surface.availability)}`} aria-hidden="true" />
            </button>
          ))}
        </aside>

        <section className="admin-shell-workspace">
          <div className="admin-shell-title-row">
            <div>
              <div className="admin-shell-kicker">{selected.classification} · {selected.migrationState}</div>
              <h2>{selected.title}</h2>
              <p>{selected.sourceOfTruth}</p>
            </div>
            <span className={`admin-shell-badge is-${availabilityTone(selected.availability)}`}>
              {selected.availability}
            </span>
          </div>

          <div className="admin-shell-mode-bar" role="tablist" aria-label="Integration mode">
            {selected.integrationModes.map((mode) => {
              const available = modeAvailable(selected, mode);
              return (
                <button
                  key={mode}
                  type="button"
                  className={selectedMode === mode ? "is-active" : ""}
                  disabled={!available}
                  title={!available ? selected.embedding.reason : ""}
                  onClick={() => {
                    setSelectedMode(mode);
                    setFrameFailed(false);
                  }}
                >
                  {MODE_LABELS[mode]}
                </button>
              );
            })}
          </div>

          {canEmbed ? (
            <section className="admin-shell-frame-wrap">
              <div className="admin-shell-frame-toolbar">
                <span>Проект сохраняет собственную авторизацию</span>
                <button type="button" onClick={() => void openTarget(selected.launch.target)}>Открыть отдельно</button>
              </div>
              <iframe
                className="admin-shell-frame"
                src={selected.launch.target}
                title={selected.title}
                sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
                referrerPolicy="no-referrer"
                onError={() => setFrameFailed(true)}
              />
            </section>
          ) : (
            <div className="admin-shell-grid">
              <article className="admin-shell-card admin-shell-card-primary">
                <div className="admin-shell-card-label">Current integration</div>
                <h3>{MODE_LABELS[selectedMode]}</h3>
                <p>
                  {selectedMode === "embedded" && !selected.embedding.supported
                    ? selected.embedding.reason
                    : selectedMode === "native-projection"
                      ? "Atlas показывает только разрешённую агрегированную сводку. Проект остаётся владельцем всех мутаций."
                      : selectedMode === "proxied"
                        ? "Bounded same-origin adapter ещё не объявлен готовым. Используется безопасный fallback."
                        : selectedMode === "local-source"
                          ? "Локальный runbook или исходный путь открывается на основном компьютере."
                          : "Полная админка открывается отдельно и самостоятельно выполняет авторизацию."}
                </p>
                <div className="admin-shell-actions">
                  <button
                    className="admin-shell-button"
                    type="button"
                    onClick={() => void openTarget(selected.launch.target || selected.runbookTarget)}
                  >
                    {selected.launch.label || "Открыть"}
                  </button>
                  {selected.runbookTarget && selected.runbookTarget !== selected.launch.target ? (
                    <button
                      className="admin-shell-button admin-shell-button-ghost"
                      type="button"
                      onClick={() => void openTarget(selected.runbookTarget)}
                    >
                      Runbook
                    </button>
                  ) : null}
                </div>
                {notice ? <div className="admin-shell-notice">{notice}</div> : null}
              </article>

              <article className="admin-shell-card">
                <div className="admin-shell-card-label">Ownership boundary</div>
                <dl>
                  <div><dt>Repository</dt><dd>{selected.ownerRepository}</dd></div>
                  <div><dt>Mutations</dt><dd>{selected.mutationOwner}</dd></div>
                  <div><dt>Authentication</dt><dd>{selected.authBoundary}</dd></div>
                  <div><dt>Fallback</dt><dd>{MODE_LABELS[selected.fallbackMode]}</dd></div>
                </dl>
              </article>

              <article className="admin-shell-card">
                <div className="admin-shell-card-label">Projection allowlist</div>
                <ul>
                  {selected.projectionAllowlist.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>

              <article className="admin-shell-card">
                <div className="admin-shell-card-label">Secret boundary</div>
                <p>{selected.secretPolicy}</p>
                <p className="admin-shell-muted">Embedding default: {selected.embedding.default}. {selected.embedding.reason}</p>
              </article>
            </div>
          )}

          {frameFailed ? (
            <div className="admin-shell-warning">
              Встраивание отклонено браузером, CSP или авторизацией проекта. Используется безопасное открытие в отдельной вкладке.
            </div>
          ) : null}

          <footer className="admin-shell-footer">
            <span>{manifest.schemaVersion}</span>
            <span>{manifest.sourceRegistry}</span>
            {manifest.generatedAt ? <span>{new Date(manifest.generatedAt).toLocaleString()}</span> : null}
          </footer>
        </section>
      </div>
    </main>
  );
}
