import { rebuildSnapshotAfterProjectionRefresh } from "./local-agent-platform-refresh.mjs";

// Compatibility bridge for the legacy Atlas host. The host currently calls this
// helper as a global identifier; preload it before any host process starts so a
// missing ESM import cannot take the always-on 4174 gateway offline.
globalThis.rebuildSnapshotAfterProjectionRefresh = rebuildSnapshotAfterProjectionRefresh;
