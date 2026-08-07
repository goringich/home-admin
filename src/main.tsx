import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AdministrationShellApp } from "./AdministrationShellApp";
import { App } from "./App";
import { DeviceFleetApp } from "./DeviceFleetApp";

type AtlasRoute = "app" | "admin" | "fleet";

function resolveAtlasRoute(): AtlasRoute {
  const workspace = window.location.hash.replace(/^#\/?/, "").split("/")[0];
  const forceLegacy = new URLSearchParams(window.location.search).get("legacyRemote") === "1";
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

function AtlasRoot() {
  const route = useAtlasRoute();
  if (route === "admin") return <AdministrationShellApp />;
  if (route === "fleet") return <DeviceFleetApp />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AtlasRoot />
  </StrictMode>,
);
