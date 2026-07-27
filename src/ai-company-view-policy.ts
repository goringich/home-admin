import type {
  AiCompanyDataState,
  AiCompanyEntity,
  HealthTone,
  RevenueAutopilotStatus,
} from "./types.ts";


function projectionStateAllowsSuccess(state: AiCompanyDataState | undefined) {
  return state?.availability === "available"
    && state.freshness === "fresh"
    && ["verified", "partially_verified"].includes(state.verification);
}


export function missionTone(
  mission: AiCompanyEntity,
  rootState: AiCompanyDataState,
  missionState: AiCompanyDataState | undefined,
): HealthTone {
  if (mission.status === "failed" || mission.implementation_status === "rejected") return "risk";
  if (
    mission.data_class === "real"
    && projectionStateAllowsSuccess(rootState)
    && projectionStateAllowsSuccess(missionState)
    && mission.status === "completed"
    && mission.implementation_status === "verified"
    && mission.outcome_status === "achieved"
  ) return "ok";
  return "attention";
}


export function operationTone(state: AiCompanyDataState): HealthTone {
  return state.availability === "available"
    && state.freshness === "fresh"
    && state.verification === "verified"
    && state.dataClass === "real"
    ? "ok"
    : "attention";
}


export function revenueProjectionTrusted(
  revenue: Pick<RevenueAutopilotStatus, "status" | "freshness">,
): boolean {
  return revenue.status === "available" && revenue.freshness === "fresh";
}


export function revenueProjectionLabel(
  revenue: Pick<RevenueAutopilotStatus, "status" | "freshness" | "product_readiness">,
): string {
  if (revenue.status !== "available") return "projection unavailable";
  if (revenue.freshness !== "fresh") {
    return `projection ${revenue.freshness ?? "unavailable"}`;
  }
  return revenue.product_readiness?.trim() || "unknown";
}


export type MissionTaskGroup = {
  workstream: AiCompanyEntity | null;
  tasks: AiCompanyEntity[];
};


export function groupMissionTasks(
  workstreams: AiCompanyEntity[],
  tasks: AiCompanyEntity[],
): MissionTaskGroup[] {
  const knownWorkstreamIds = new Set(
    workstreams.map((workstream) => workstream.workstream_id).filter(Boolean),
  );
  const groups: MissionTaskGroup[] = workstreams.map((workstream) => ({
    workstream,
    tasks: tasks.filter((task) => task.workstream_id === workstream.workstream_id),
  }));
  const unresolvedTasks = tasks.filter(
    (task) => !task.workstream_id || !knownWorkstreamIds.has(task.workstream_id),
  );
  if (unresolvedTasks.length) groups.push({ workstream: null, tasks: unresolvedTasks });
  return groups;
}
