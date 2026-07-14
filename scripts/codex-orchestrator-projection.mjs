import path from "node:path";

const SENSITIVE_TEXT = /(authorization|bearer|cookie|password|secret|token|api[_-]?key|ssh-rsa)/i;

export function safeProjectionText(value, limit = 240) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
  return SENSITIVE_TEXT.test(normalized) ? "[redacted]" : normalized;
}

export function compactPath(value) {
  return String(value || "").replace("/home/goringich", "~");
}

export function queueTaskId(value) {
  return path.basename(String(value || "")).replace(/\.task(?:\.(?:failed|done|running))?$/, "");
}

export function sanitizeSharedRunReport(payload = {}, { reportPath = "", modifiedAt = "" } = {}) {
  const verification = Array.isArray(payload.verification_results) ? payload.verification_results : [];
  const failureReasons = [...new Set(verification
    .map((entry) => safeProjectionText(entry?.status, 48))
    .filter((status) => status === "failed" || status === "blocked"))];
  const dirtyAfter = Number(payload.dirty_after || 0);
  const rawRepo = payload.repo && typeof payload.repo === "object" ? payload.repo : {};
  return {
    runId: safeProjectionText(payload.run_id || path.basename(reportPath, ".json"), 180),
    queueTaskId: queueTaskId(payload.queue_task_path || payload.queue_task_id || payload.task_id),
    createdAt: safeProjectionText(payload.created_at || modifiedAt, 80),
    taskTitle: safeProjectionText(payload.task_title, 240),
    taskText: "",
    workdir: compactPath(payload.workdir),
    repo: {
      id: safeProjectionText(rawRepo.id || payload.repo_id, 100),
      path: compactPath(rawRepo.path),
      remote: "",
    },
    branchBefore: safeProjectionText(payload.branch_before, 120),
    branchAfter: safeProjectionText(payload.branch_after, 120),
    dirtyBefore: Number(payload.dirty_before || 0),
    dirtyAfter,
    commitBefore: safeProjectionText(payload.commit_before, 80),
    commitAfter: safeProjectionText(payload.commit_after, 80),
    filesChanged: [],
    verificationCommands: [],
    verificationResults: verification.map((entry) => ({ status: safeProjectionText(entry?.status, 48) })).filter((entry) => entry.status),
    failedVerificationCount: failureReasons.length,
    failureReasons,
    status: safeProjectionText(payload.status || "unknown", 80),
    summary: "",
    nextAction: failureReasons.length ? "Inspect the structured failure classification before retrying." : "",
    sourceFiles: [],
    reportPath: compactPath(reportPath),
    artifactDir: compactPath(payload.artifact_dir),
    dirtyAfterRun: dirtyAfter > 0,
  };
}

export function reconcileRecentRuns(artifacts = [], sharedReports = []) {
  const reportsByArtifact = new Map();
  for (const report of sharedReports) {
    if (report.artifactDir) {
      reportsByArtifact.set(path.resolve(report.artifactDir.replace(/^~/, "/home/goringich")), report);
    }
  }
  return artifacts.map((artifact) => {
    const artifactPath = path.resolve(String(artifact.artifactDir || ""));
    const report = reportsByArtifact.get(artifactPath);
    return {
      ...artifact,
      id: report?.runId || artifact.artifactId,
      taskId: report?.queueTaskId || "",
      reconciliation: report ? "matched_shared_report" : "unmatched_artifact",
      failureStatus: report?.status || "",
    };
  });
}
