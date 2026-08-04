function finiteDate(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function normalizeCodexAudit(latest, exporterState, now = Date.now()) {
  if (!latest || typeof latest !== "object") {
    return {
      sourceStatus: "unavailable",
      freshness: "unavailable",
      syncStatus: "unavailable",
      generatedAt: "",
      ageHours: null,
      taskCount: 0,
      statusCounts: {},
      tasks: [],
      exporter: exporterState || { status: "unavailable", counts: {}, jobs: [] },
    };
  }

  const generatedAt = String(latest.generated_at || latest.freshness?.generated_at || "");
  const generatedMs = finiteDate(generatedAt);
  const maxAgeHours = Number(latest.freshness?.max_age_hours || 24);
  const ageHours = generatedMs === null ? null : Math.max(0, (now - generatedMs) / 3_600_000);
  const freshness = ageHours === null ? "unavailable" : ageHours <= maxAgeHours ? "fresh" : "stale";
  const syncStatus = String(latest.sync?.status || "unsynced");
  const exporter = exporterState && typeof exporterState === "object"
    ? exporterState
    : { status: "unavailable", counts: {}, jobs: [] };
  const degraded = exporter.status === "degraded" || !["synced", "syncing"].includes(syncStatus);
  const sourceStatus = freshness === "stale" ? "stale" : degraded ? "degraded" : freshness === "fresh" ? "healthy" : "unavailable";

  return {
    sourceStatus,
    freshness,
    syncStatus,
    generatedAt,
    ageHours: ageHours === null ? null : Number(ageHours.toFixed(3)),
    taskCount: Number(latest.task_count || 0),
    statusCounts: latest.status_counts && typeof latest.status_counts === "object" ? latest.status_counts : {},
    tasks: Array.isArray(latest.tasks) ? latest.tasks.slice(-20).reverse().map((task) => ({
      taskId: String(task?.task_id || ""),
      status: String(task?.status || "unknown"),
      repository: String(task?.repository || "unknown"),
      branch: String(task?.branch || ""),
      headSha: String(task?.head_sha || ""),
      diffUrl: String(task?.diff_url || ""),
      failedChecks: Array.isArray(task?.failed_checks) ? task.failed_checks.map(String) : [],
      blockers: Array.isArray(task?.blockers) ? task.blockers.map(String) : [],
      taskPath: String(task?.task_path || ""),
      updatedAt: String(task?.updated_at || ""),
    })) : [],
    exporter,
  };
}
