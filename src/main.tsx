import { StrictMode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AdministrationShellApp } from "./AdministrationShellApp";
import { App } from "./App";
import { ArchitectureWorkspace } from "./ArchitectureWorkspace";
import { DeviceFleetApp } from "./DeviceFleetApp";

type AtlasRoute = "app" | "admin" | "fleet" | "architecture";

function resolveAtlasRoute(): AtlasRoute {
  const workspace = window.location.hash.replace(/^#\/?/, "").split("/")[0];
  const forceLegacy = new URLSearchParams(window.location.search).get("legacyRemote") === "1";
  if (workspace === "architecture" || workspace === "system-map" || workspace === "universe") return "architecture";
  if (workspace === "admin" || workspace === "administration") return "admin";
  if (!forceLegacy && (workspace === "remote" || workspace === "fleet")) return "fleet";
  return "app";
}

function useAtlasRoute() {
  const [route, setRoute] = useState<AtlasRoute>(resolveAtlasRoute);

  useEffect(() => {
    const update = () => setRoute(resolveAtlasRoute());
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);

  return route;
}

function ArchitectureLauncher() {
  const [navTarget, setNavTarget] = useState<Element | null>(null);

  useEffect(() => {
    const resolveTarget = () => setNavTarget(document.querySelector(".sidebar-nav"));
    resolveTarget();
    const observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const openArchitecture = () => { window.location.hash = "#/architecture"; };
  const nativeItem = (
    <button
      className="nav-item architecture-nav-item"
      type="button"
      onClick={openArchitecture}
      aria-label="Открыть Architecture Universe"
    >
      <span className="nav-glyph">09</span>
      <span className="nav-copy"><strong>Architecture</strong><small>Полная карта системы</small></span>
    </button>
  );

  if (navTarget) return createPortal(nativeItem, navTarget);
  return (
    <button className="architecture-launcher architecture-launcher-fallback" type="button" onClick={openArchitecture} aria-label="Открыть Architecture Universe">
      <span className="architecture-launcher-glyph">09</span>
      <span className="architecture-launcher-copy"><strong>Architecture</strong><small>Whole system universe</small></span>
    </button>
  );
}

function AtlasRoot() {
  const route = useAtlasRoute();
  if (route === "architecture") return <ArchitectureWorkspace />;
  if (route === "admin") return <><AdministrationShellApp /><ArchitectureLauncher /></>;
  if (route === "fleet") return <><DeviceFleetApp /><ArchitectureLauncher /></>;
  return <><App /><ArchitectureLauncher /></>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AtlasRoot />
  </StrictMode>,
);
