import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { DeviceFleetApp } from "./DeviceFleetApp";

function useFleetRoute() {
  const resolve = () => {
    const workspace = window.location.hash.replace(/^#\/?/, "").split("/")[0];
    const forceLegacy = new URLSearchParams(window.location.search).get("legacyRemote") === "1";
    return !forceLegacy && (workspace === "remote" || workspace === "fleet");
  };
  const [fleetRoute, setFleetRoute] = useState(resolve);

  useEffect(() => {
    const update = () => setFleetRoute(resolve());
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);

  return fleetRoute;
}

function AtlasRoot() {
  return useFleetRoute() ? <DeviceFleetApp /> : <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AtlasRoot />
  </StrictMode>,
);
