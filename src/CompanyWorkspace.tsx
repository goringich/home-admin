import { useEffect, useMemo, useState } from "react";
import type {
  AiCompanyDataState,
  AiCompanyEntity,
  AiCompanyMissionControl,
  HealthTone,
} from "./types";


const EMPTY_STATE: AiCompanyDataState = {
  availability: "unavailable",
  freshness: "unavailable",
  verification: "unverified",
  dataClass: "unavailable",
  reason: "source_missing",
};

const EMPTY_COMPANY: AiCompanyMissionControl = {
  schemaVersion: "unavailable",
  generatedAt: "",
  exportHash: "",
  safeToExpose: false,
  state: EMPTY_STATE,
  sectionStates: {},
  portfolios: [],
  missions: [],
  workstreams: [],
  tasks: [],
  dependencies: [],
  attempts: [],
  runs: [],
  evidence: [],
  verifications: [],
  approvals: [],
  economics: [],
  incidents: [],
  decisions: [],
  outcomes: [],
  operations: {
    offers: [], leads: [], opportunities: [], experiments: [], orders: [], deliveries: [],
    payments: [], customerFeedback: [],
    counters: { offers: null, leads: null, opportunities: null, experiments: null, orders: null, deliveries: null, payments: null, feedback: null },
    state: EMPTY_STATE,
  },
};


function stateTone(value: string): HealthTone {
  if (["rejected", "failed", "stale"].includes(value)) return "risk";
  if (["unavailable", "unknown", "unverified", "partially_verified", "fixture"].includes(value)) return "attention";
  if (["available", "fresh", "verified"].includes(value)) return "ok";
  return "unknown";
}


function missionTone(mission: AiCompanyEntity): HealthTone {
  if (mission.status === "failed" || mission.implementation_status === "rejected") return "risk";
  if (
    mission.status === "completed"
    && mission.implementation_status === "verified"
    && mission.outcome_status === "achieved"
  ) return "ok";
  return "attention";
}


function CompanyBadge(props: { label: string; tone: HealthTone }) {
  return <span className={`status-badge tone-${props.tone}`}>{props.label}</span>;
}


function TrustStrip(props: { state: AiCompanyDataState }) {
  return (
    <div className="company-trust-strip" aria-label="Company data trust state">
      <div><span>availability</span><CompanyBadge label={props.state.availability} tone={stateTone(props.state.availability)} /></div>
      <div><span>freshness</span><CompanyBadge label={props.state.freshness} tone={stateTone(props.state.freshness)} /></div>
      <div><span>verification</span><CompanyBadge label={props.state.verification} tone={stateTone(props.state.verification)} /></div>
      <div><span>data class</span><CompanyBadge label={props.state.dataClass} tone={stateTone(props.state.dataClass)} /></div>
    </div>
  );
}


function exactCost(rows: AiCompanyEntity[]) {
  if (!rows.length || rows.some((row) => typeof row.actual_cost !== "number")) return null;
  return rows.reduce((total, row) => total + (row.actual_cost as number), 0);
}


function money(value: number | null | undefined) {
  return typeof value === "number" ? `$${value.toFixed(4)}` : "unknown";
}


function OperationsGrid(props: { data: AiCompanyMissionControl["operations"] }) {
  const entries = [
    ["offers", "Offers"], ["leads", "Leads"], ["opportunities", "Opportunities"],
    ["experiments", "Experiments"], ["orders", "Orders"], ["deliveries", "Deliveries"],
    ["payments", "Payments"], ["feedback", "Feedback"],
  ] as const;
  return (
    <section className="panel">
      <div className="panel-head">
        <div><div className="section-kicker">Company operations</div><h3>Minimal commercial core</h3></div>
        <CompanyBadge label={props.data.state.availability} tone={stateTone(props.data.state.availability)} />
      </div>
      <div className="local-status-grid">
        {entries.map(([key, label]) => (
          <div className="metric-card" key={key}>
            <span>{label}</span>
            <strong>{props.data.counters[key] ?? "unavailable"}</strong>
            <p>{props.data.state.dataClass} data</p>
          </div>
        ))}
      </div>
      <p className="panel-note">No outreach, publication, payment, or delivery action is executed from this view.</p>
    </section>
  );
}


type CompanyWorkspaceProps = {
  data?: AiCompanyMissionControl;
  onRefresh: () => void;
};


export function CompanyWorkspace(props: CompanyWorkspaceProps) {
  const data = props.data ?? EMPTY_COMPANY;
  const [selectedMissionId, setSelectedMissionId] = useState(data.missions[0]?.mission_id ?? "");
  const [actor, setActor] = useState("owner");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [pendingApproval, setPendingApproval] = useState("");
  const [approvalMessage, setApprovalMessage] = useState("");
  const [localDecisions, setLocalDecisions] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data.missions.some((mission) => mission.mission_id === selectedMissionId)) {
      setSelectedMissionId(data.missions[0]?.mission_id ?? "");
    }
  }, [data.missions, selectedMissionId]);

  const selectedMission = data.missions.find((mission) => mission.mission_id === selectedMissionId);
  const connected = useMemo(() => {
    const missionId = selectedMission?.mission_id;
    const tasks = data.tasks.filter((item) => item.mission_id === missionId);
    const taskIds = new Set(tasks.map((item) => item.task_id).filter(Boolean));
    const attempts = data.attempts.filter((item) => item.task_id && taskIds.has(item.task_id));
    const attemptIds = new Set(attempts.map((item) => item.attempt_id).filter(Boolean));
    return {
      workstreams: data.workstreams.filter((item) => item.mission_id === missionId),
      tasks,
      dependencies: data.dependencies.filter((item) => item.task_id && taskIds.has(item.task_id)),
      attempts,
      runs: data.runs.filter((item) => item.attempt_id && attemptIds.has(item.attempt_id)),
      evidence: data.evidence.filter((item) => item.mission_id === missionId || (item.task_id && taskIds.has(item.task_id))),
      verifications: data.verifications.filter((item) => item.mission_id === missionId || (item.task_id && taskIds.has(item.task_id))),
      approvals: data.approvals.filter((item) => item.mission_id === missionId),
      economics: data.economics.filter((item) => item.mission_id === missionId),
      incidents: data.incidents.filter((item) => item.mission_id === missionId),
      decisions: data.decisions.filter((item) => item.mission_id === missionId),
      outcomes: data.outcomes.filter((item) => item.mission_id === missionId),
    };
  }, [data, selectedMission]);

  const completedTasks = connected.tasks.filter((task) => task.status === "completed").length;
  const missionActualCost = exactCost(connected.economics);
  const decisionsTrusted = data.safeToExpose
    && data.state.availability === "available"
    && data.state.freshness === "fresh"
    && data.state.dataClass === "real"
    && !["unverified", "rejected", "unknown"].includes(data.state.verification);

  async function decideApproval(approval: AiCompanyEntity, decision: "approve" | "reject") {
    const approvalId = approval.approval_id ?? "";
    const reason = (reasons[approvalId] ?? "").trim();
    if (!approvalId || !reason || !actor.trim()) {
      setApprovalMessage("Actor and reason are required; no decision was sent.");
      return;
    }
    if (!decisionsTrusted || typeof approval.revision !== "number") {
      setApprovalMessage(`${approvalId}: fresh verified real data and a concrete revision are required.`);
      return;
    }
    setPendingApproval(approvalId);
    setApprovalMessage("");
    const revision = approval.revision;
    try {
      const response = await fetch("./api/company/approvals/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id: approvalId,
          decision,
          actor: actor.trim(),
          reason,
          expected_revision: revision,
          idempotency_key: `atlas-${approvalId}-${revision}-${decision}`,
        }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || result.ok !== true) throw new Error(result.error || `http_${response.status}`);
      setLocalDecisions((current) => ({ ...current, [approvalId]: decision === "approve" ? "approved" : "rejected" }));
      setApprovalMessage(`${approvalId}: decision recorded; underlying action was not executed.`);
      props.onRefresh();
    } catch (error) {
      setApprovalMessage(`${approvalId}: ${error instanceof Error ? error.message : "decision_failed"}`);
    } finally {
      setPendingApproval("");
    }
  }

  return (
    <div className="workspace-stack">
      <section className="workspace-header">
        <div><div className="section-kicker">Atlas / Company</div><h1>AI Company Mission Control</h1><p>Portfolio intent, bounded execution, evidence, owner decisions, economics, and outcome state in one workspace.</p></div>
        <CompanyBadge label={data.state.availability} tone={stateTone(data.state.availability)} />
      </section>
      <TrustStrip state={data.state} />

      {data.state.availability === "unavailable" ? (
        <section className="panel"><div className="empty-inline">Mission Ledger projection unavailable: {data.state.reason ?? "unknown"}. No success state is inferred.</div></section>
      ) : null}

      <section className="panel">
        <div className="panel-head"><div><div className="section-kicker">Portfolio</div><h3>Priority and expected value</h3></div><CompanyBadge label={data.sectionStates.portfolios?.verification ?? "unknown"} tone={stateTone(data.sectionStates.portfolios?.verification ?? "unknown")} /></div>
        <div className="detail-grid compact-grid">
          {data.portfolios.map((portfolio) => (
            <article className="detail-card" key={portfolio.portfolio_id}>
              <div className="detail-card-title">{portfolio.title ?? portfolio.portfolio_id}</div>
              <div className="class-grid">
                <div className="class-row"><span>score</span><strong>{portfolio.score ?? "unknown"}</strong></div>
                <div className="class-row"><span>expected value</span><strong>{portfolio.expected_value ?? "unknown"}</strong></div>
                <div className="class-row"><span>actual cost</span><strong>{money(portfolio.actual_cost)}</strong></div>
                <div className="class-row"><span>status</span><strong>{portfolio.status ?? "unknown"}</strong></div>
              </div>
            </article>
          ))}
          {!data.portfolios.length ? <div className="empty-inline">Portfolio data unavailable.</div> : null}
        </div>
      </section>

      <section className="company-mission-layout">
        <aside className="project-list" aria-label="Missions">
          {data.missions.map((mission) => (
            <button key={mission.mission_id} className={`project-list-item ${mission.mission_id === selectedMissionId ? "project-list-item-active" : ""}`} type="button" onClick={() => setSelectedMissionId(mission.mission_id ?? "")}>
              <span className={`project-health-dot tone-${missionTone(mission)}`} />
              <span><strong>{mission.title ?? mission.mission_id}</strong><small>{mission.status ?? "unknown"} · {mission.outcome_status ?? "not_measured"}</small></span>
            </button>
          ))}
          {!data.missions.length ? <div className="empty-inline">Missions unavailable.</div> : null}
        </aside>

        <div className="workspace-stack">
          <section className="panel">
            <div className="panel-head"><div><div className="section-kicker">Mission detail</div><h3>{selectedMission?.title ?? "No mission selected"}</h3></div>{selectedMission ? <CompanyBadge label={String(selectedMission.status ?? "unknown")} tone={missionTone(selectedMission)} /> : null}</div>
            <p>{selectedMission?.objective ?? "Outcome objective unavailable."}</p>
            <div className="local-status-grid">
              <div className="metric-card"><span>work progress</span><strong>{connected.tasks.length ? `${completedTasks}/${connected.tasks.length}` : "unknown"}</strong><p>completed bounded tasks</p></div>
              <div className="metric-card"><span>implementation</span><strong>{selectedMission?.implementation_status ?? "unknown"}</strong><p>not inferred from commits</p></div>
              <div className="metric-card"><span>outcome</span><strong>{selectedMission?.outcome_status ?? "not_measured"}</strong><p>{selectedMission?.target_metric ?? "target unavailable"}</p></div>
              <div className="metric-card"><span>actual cost</span><strong>{money(missionActualCost)}</strong><p>{connected.economics.length} cost records</p></div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><div><div className="section-kicker">Mission DAG</div><h3>Tasks, dependencies, attempts, and runs</h3></div><CompanyBadge label={`${connected.tasks.length} tasks`} tone={connected.tasks.length ? "attention" : "unknown"} /></div>
            <div className="mission-dag">
              {connected.tasks.map((task) => {
                const dependencies = connected.dependencies.filter((item) => item.task_id === task.task_id);
                const attempts = connected.attempts.filter((item) => item.task_id === task.task_id);
                const attemptIds = new Set(attempts.map((item) => item.attempt_id));
                const runs = connected.runs.filter((item) => attemptIds.has(item.attempt_id));
                return (
                  <article className="detail-card" key={task.task_id}>
                    <div className="detail-card-title">{task.title ?? task.task_id}</div>
                    <div className="status-cluster"><CompanyBadge label={String(task.status ?? "unknown")} tone={task.status === "failed" ? "risk" : "attention"} />{task.critical_path ? <CompanyBadge label="critical path" tone="attention" /> : null}</div>
                    <p>{dependencies.length ? `depends on ${dependencies.map((item) => item.depends_on_task_id).join(", ")}` : "parallel-ready / no blocking dependency recorded"}</p>
                    <p>{attempts.length} attempts · {runs.length} runs</p>
                  </article>
                );
              })}
              {!connected.tasks.length ? <div className="empty-inline">Task DAG unavailable.</div> : null}
            </div>
          </section>
        </div>
      </section>

      <section className="detail-grid">
        <article className="panel">
          <div className="panel-head"><div><div className="section-kicker">Evidence & verification</div><h3>Independent proof</h3></div><CompanyBadge label={data.sectionStates.verifications?.verification ?? "unknown"} tone={stateTone(data.sectionStates.verifications?.verification ?? "unknown")} /></div>
          <div className="doc-list">
            {connected.evidence.map((item) => <div className="class-row" key={item.evidence_id}><span>{item.evidence_type ?? "evidence"}</span><strong>{item.freshness ?? "unknown"} · {item.summary ?? item.evidence_id}</strong></div>)}
            {connected.verifications.map((item) => <div className="class-row" key={item.verification_id}><span>{item.independent ? "independent" : "author"}</span><strong>{item.status ?? "unverified"} · {item.reason ?? "no reason"}</strong></div>)}
            {!connected.evidence.length && !connected.verifications.length ? <div className="empty-inline">Evidence unavailable; mission is not verified.</div> : null}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head"><div><div className="section-kicker">Economics</div><h3>Known spend and uncertainty</h3></div><CompanyBadge label={missionActualCost === null ? "partial / unknown" : "known"} tone={missionActualCost === null ? "attention" : "ok"} /></div>
          <div className="class-grid">
            <div className="class-row"><span>actual cost</span><strong>{money(missionActualCost)}</strong></div>
            <div className="class-row"><span>budget</span><strong>{money(selectedMission?.budget_limit)}</strong></div>
            <div className="class-row"><span>cost records</span><strong>{connected.economics.length || "unavailable"}</strong></div>
            <div className="class-row"><span>outcomes</span><strong>{connected.outcomes.length || "not measured"}</strong></div>
          </div>
          <p>Missing cost components remain unknown; they are never coerced to zero.</p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-head"><div><div className="section-kicker">Approvals</div><h3>Owner decisions only</h3></div><CompanyBadge label={`${connected.approvals.filter((item) => (localDecisions[item.approval_id ?? ""] ?? item.status) === "pending").length} pending`} tone="attention" /></div>
        <label className="company-owner-field"><span>Decision actor</span><input value={actor} onChange={(event) => setActor(event.target.value)} maxLength={120} /></label>
        <div className="doc-list">
          {connected.approvals.map((approval) => {
            const approvalId = approval.approval_id ?? "";
            const status = localDecisions[approvalId] ?? approval.status ?? "unknown";
            const decisionEnabled = decisionsTrusted && typeof approval.revision === "number";
            return (
              <article className="detail-card" key={approvalId}>
                <div className="detail-card-title">{approval.approval_type ?? approvalId}</div>
                <p>{approval.requested_action ?? "Requested action unavailable"}</p>
                <p>risk: {approval.risk ?? "unknown"} · reversibility: {approval.reversibility ?? "unknown"}</p>
                <CompanyBadge label={status} tone={status === "rejected" ? "risk" : status === "approved" ? "ok" : "attention"} />
                {status === "pending" ? <>
                  <label className="company-owner-field"><span>Decision reason</span><input value={reasons[approvalId] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [approvalId]: event.target.value }))} maxLength={2000} /></label>
                  <div className="approval-actions"><button type="button" disabled={!decisionEnabled || pendingApproval === approvalId} onClick={() => decideApproval(approval, "approve")}>Approve decision</button><button type="button" disabled={!decisionEnabled || pendingApproval === approvalId} onClick={() => decideApproval(approval, "reject")}>Reject decision</button></div>
                  {!decisionEnabled ? <p>Decision disabled: fresh, partially/fully verified real data and a concrete revision are required.</p> : null}
                </> : null}
              </article>
            );
          })}
          {!connected.approvals.length ? <div className="empty-inline">No approval records available.</div> : null}
        </div>
        <p className="panel-note">An approval decision never auto-executes deployment, payment, publication, contact, deletion, or another risky action.</p>
        {approvalMessage ? <div className="notice" role="status">{approvalMessage}</div> : null}
      </section>

      <OperationsGrid data={data.operations} />

      <section className="panel">
        <div className="panel-head"><div><div className="section-kicker">Organizational record</div><h3>Incidents, decisions, and outcome measurements</h3></div></div>
        <div className="detail-grid compact-grid">
          <article className="detail-card"><div className="detail-card-title">Incidents</div><strong>{connected.incidents.length || "none recorded"}</strong></article>
          <article className="detail-card"><div className="detail-card-title">Decisions</div><strong>{connected.decisions.length || "none recorded"}</strong></article>
          <article className="detail-card"><div className="detail-card-title">Outcome measurements</div><strong>{connected.outcomes.length || "not measured"}</strong></article>
          <article className="detail-card"><div className="detail-card-title">Timeline</div><strong>{connected.attempts.length + connected.runs.length + connected.evidence.length + connected.approvals.length} linked records</strong></article>
        </div>
      </section>
    </div>
  );
}
