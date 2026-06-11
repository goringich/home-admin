export type ProjectDomain =
  | "product"
  | "infra"
  | "system"
  | "local-ai"
  | "embedded"
  | "study"
  | "tooling"
  | "external";

export type HealthTone = "ok" | "attention" | "risk" | "unknown";
export type TaskStatus = "planned" | "active" | "review" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type DetailTab = "overview" | "architecture" | "deploy" | "tasks" | "docs";

export interface ServiceInfo {
  name: string;
  stack: string;
  status: "ok" | "attention" | "risk";
  version: string;
}

export interface TaskItem {
  id: string;
  project: string;
  projectTitle: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  area: string;
  note: string;
}

export interface ProjectDoc {
  label: string;
  path: string;
}

export interface ReleaseWindow {
  label: string;
  days: number;
  confidence: number;
}

export interface ProjectRecord {
  id: string;
  title: string;
  name: string;
  repoPath: string;
  section: string;
  domain: ProjectDomain;
  focus: boolean;
  summary: string;
  remote: string;
  branch: string;
  dirtyCount: number;
  ahead: number;
  behind: number;
  healthTone: HealthTone;
  lastCommit: {
    timestamp: number;
    date: string;
    sha: string;
    subject: string;
  };
  commitAgeHours: number | null;
  tags: string[];
  related: string[];
  services: ServiceInfo[];
  commands: {
    dev: string;
    build: string;
    test: string;
    deploy: string;
  };
  deploy: {
    surface: string;
    environment: string;
    status: string;
    note: string;
  } | null;
  docs: ProjectDoc[];
  release: ReleaseWindow | null;
  riskNotes: string[];
  tasks: TaskItem[];
  quickOpen: {
    root: string;
    readme: string;
    docs: string;
    vscode: string;
  };
  paths: {
    root: string;
    readme: string;
    docs: string;
  };
  position: {
    x: number;
    y: number;
  } | null;
  sparkline: number[];
  dirtyFiles: string[];
  metrics: {
    signal: number;
    commits7d: number;
    services: number;
  };
}

export interface Snapshot {
  generatedAt: string;
  focusProjectIds: string[];
  summary: {
    totalRepos: number;
    focusRepos: number;
    dirtyRepos: number;
    deployConfigured: number;
    activeTasks: number;
    blockedTasks: number;
    completedTasks: number;
    weeklyVelocity: number;
    deployPulse: number[];
    domainCounts: Partial<Record<ProjectDomain, number>>;
  };
  system: {
    systemStatus: string;
    overall: string;
    safeMode: boolean;
    hyprlandOnline: boolean;
    topIssue: string;
    gpuNote?: string;
    gpu: {
      temperature: number;
      memoryUsed: number;
      memoryTotal: number;
      utilization: number;
    };
    diskRootPercent: number;
  };
  hostAudit: HostAudit;
  projects: ProjectRecord[];
  tasks: TaskItem[];
  recentCommits: Array<{
    project: string;
    title: string;
    sha: string;
    subject: string;
    timestamp: number;
    branch: string;
  }>;
  localCodexLab: LocalCodexLab;
  localAiControl: LocalAiControl;
  aiTelemetry: AiTelemetryExport;
  commercialReadiness: CommercialReadiness;
}

export interface SourceMeta {
  path: string;
  generatedAt?: string;
  modifiedAt?: string;
  modifiedAtMs?: number;
}

export interface LocalCodexGoalCapsule {
  goalId: string;
  status: string;
  objective: string;
  nextAction: string;
  latestRunSummary: string;
  recommendedContextBudget: string;
  remainingGaps: string[];
  knownBlockers: string[];
  lastUsefulCommits: string[];
  sourceNotes: string[];
  source: SourceMeta;
}

export interface LocalCodexRunSummary {
  runId: string;
  goalId: string;
  task: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  reposTouched: string[];
  verification: string[];
  commits: string[];
  whatRemains: string[];
  nextAction: string;
  source: SourceMeta;
}

export interface LocalCodexLab {
  generatedAt: string;
  hostHealth: string;
  source: SourceMeta;
  modelRouting: {
    fast: string;
    balanced: string;
    planning: string;
    embedding: string;
    source: SourceMeta;
  };
  retrievalPolicy: {
    priorityOrder: string[];
    denylistedClasses: string[];
    denylistedFiles: number;
    source: SourceMeta;
  };
  tokenEfficiency: {
    filesScanned: number;
    longGoalRuns: number;
    bridgeNoiseFiles: number;
    repeatedHealthGateCount: number;
    filesWithNoAssistantReply: number;
    source: SourceMeta;
  };
  openclawReliability: {
    warningCount: number;
    status: string;
    classifications: Record<string, number>;
    recommendedActions: string[];
    source: SourceMeta;
  };
  repoIntel: {
    targetCount: number;
    safeTargets: string[];
    targets: Array<{
      repoId: string;
      title: string;
      path: string;
      dirtyCount: number;
      ahead: number;
      symbolCount: number;
      testCount: number;
      dependencyManifestCount: number;
      source: SourceMeta;
    }>;
    source: SourceMeta;
  };
  research: {
    runCount: number;
    sourceCardCount: number;
    providers: string[];
    sourceDomains: string[];
    latestRun: Record<string, unknown>;
    paths: Record<string, string>;
    freshness: Record<string, unknown>;
    source: SourceMeta;
  };
  memory: {
    workspaceFocus: string;
    activeGoalCount: number;
    activeGoalIds: string[];
    latestRunId: string;
    latestTask: string;
    hostHealth: string;
    highlights: string[];
    sourcePaths: Record<string, string>;
    source: SourceMeta;
  };
  tokenEconomy: {
    contextBudgetsPath: string;
    tokenWasteMetricsPath: string;
    runSummariesPath: string;
    freshness: Record<string, unknown>;
    source: SourceMeta;
  };
  failureAwareObservability: {
    hostHealth: string;
    safeMode: string;
    openclawWarningCount: number;
    latestRunFailures: string[];
    sourcePaths: Record<string, string>;
    source: SourceMeta;
  };
  activeRuns: Array<{
    run_id: string;
    status: string;
    dry_run: boolean;
    repo_id: string;
    task_type: string;
    task_text: string;
    context_budget: string;
    selected_agent: string;
    generated_at: string;
    run_report_path: string;
    context_pack_path: string;
    failed_checks: string[];
    next_best_action: string;
  }>;
  latestRunReports: Array<{
    run_id: string;
    status: string;
    dry_run: boolean;
    repo_id: string;
    task_type: string;
    task_text: string;
    context_budget: string;
    selected_agent: string;
    generated_at: string;
    run_report_path: string;
    context_pack_path: string;
    failed_checks: string[];
    next_best_action: string;
  }>;
  evalStatus: {
    status: string;
    matched_spec_ids?: string[];
    spec_count?: number;
    specs?: Array<{
      id: string;
      title: string;
      repo_id: string;
      task_type: string;
      status: string;
      last_run_id: string;
      source_path: string;
    }>;
  };
  agentRouting: {
    source_path?: string;
    default_route?: string;
    default_context_budget?: string;
    routes?: Array<{
      id: string;
      label: string;
      context_budget: string;
      sandbox_mode: string;
      permission_tier: string;
      preferred_agents: string[];
    }>;
    status?: string;
  };
  tokenCostPlaceholders: {
    input_tokens: number | null;
    output_tokens: number | null;
    total_tokens: number | null;
    cost_usd: number | null;
  };
  failedChecks: string[];
  nextBestAction: string;
  goalCapsules: LocalCodexGoalCapsule[];
  runSummaries: LocalCodexRunSummary[];
}

export interface HostAudit {
  generatedAt: string;
  hostname: string;
  kernel: string;
  os: string;
  overall: string;
  safeMode: boolean;
  hyprlandOnline: boolean;
  topIssue: string;
  issueBundlePath: string;
  watchdogReason: string;
  gpu: {
    temperature: number;
    memoryUsed: number;
    memoryTotal: number;
    utilization: number;
    raw: string;
    note: string;
  };
  disk: {
    rootPercent: number;
    root: string;
    boot: string;
  };
  hyprland: {
    instances: string;
  };
  services: LocalAiRuntime[];
  modelRoles: Record<string, string | null>;
  activeModels: string[];
  gemma4: LocalAiGemma4;
  openclawSecurity: {
    critical: number;
    warn: number;
    info: number;
  };
  codexOrchestrator: LocalAiRuntime | null;
  atlas: {
    status: string;
    health: string;
    build_exists: boolean;
    processes: string[];
    repo_dirty: number | null;
    repo_error: string;
  };
  repos: Array<{
    id: string;
    path: string;
    type: string;
    present: boolean;
    branch: string;
    dirtyCount: number | null;
    note: string;
  }>;
  blockers: string[];
  sourcePaths: {
    localAiControl: string;
    healthGate: string;
    bundle: string;
  };
  healthGate: Record<string, unknown>;
  source: SourceMeta;
}

export interface LocalAiRuntime {
  id: string;
  label: string;
  status: string;
  detail: string;
  endpoint: string;
}

export interface LocalAiModel {
  name: string;
  id: string;
  size: string;
  size_bytes: number;
  modified: string;
  modified_at: string;
  family: string;
  parameter_size: string;
  quantization: string;
  roles: string[];
  active: boolean;
  classification: "keep" | "keep-but-manual" | "candidate-for-removal" | "unknown-needs-test";
  reason: string;
}

export interface LocalAiGemma4 {
  recommended_tag: string;
  tags: Record<
    string,
    {
      available: boolean;
      detail: string;
    }
  >;
  reason: string;
}

export interface LocalAiAgent {
  id: string;
  label: string;
  bootstrap: string;
  sessions: string;
  active: string;
  store: string;
}

export interface LocalAiSecurityFinding {
  severity: "warn" | "info";
  id: string;
  title: string;
  detail: string;
  fix: string;
}

export interface LocalAiControl {
  generatedAt: string;
  host: {
    hostname: string;
    overall: string;
    safe_mode: boolean | null;
    top_issue: string;
  };
  ollamaVersion: string;
  recommendations: Record<string, string | null>;
  roleMap: Record<string, string | null>;
  models: LocalAiModel[];
  activeModels: Array<{
    name: string;
    id: string;
    size: string;
    processor: string;
    context: string;
    until: string;
  }>;
  cleanup: {
    keep: string[];
    "keep-but-manual": string[];
    "candidate-for-removal": string[];
    "unknown-needs-test": string[];
  };
  gemma4: LocalAiGemma4;
  runtimes: LocalAiRuntime[];
  blockers: string[];
  atlas: {
    status: string;
    health: string;
    build_exists: boolean;
    processes: string[];
    repo_dirty: number | null;
    repo_error: string;
  };
  openclaw: {
    overview: Record<string, string>;
    channels: Array<{
      channel: string;
      enabled: string;
      state: string;
      detail: string;
    }>;
    agents: LocalAiAgent[];
  };
  security: {
    summary: {
      critical: number;
      warn: number;
      info: number;
    };
    findings: LocalAiSecurityFinding[];
  };
  source: SourceMeta;
}

export interface AiTelemetryRecentEvent {
  ts: string;
  category: string;
  tool: string;
  subject: string;
  query: string;
  status: string;
  result_count: number;
  semantic_enabled: boolean;
  provider?: string;
  model?: string;
  total_tokens?: number;
  cost_usd?: number;
  run_id?: string;
  goal_id?: string;
  response_id?: string;
  context_budget?: string;
  retrieval_pack_hash?: string;
  success_status?: string;
}

export interface AiTelemetryRegistryEntry {
  id: string;
  title: string;
  source_path: string;
  installed_path: string;
  installed: boolean;
}

export interface AiTelemetryExport {
  generatedAt: string;
  retrievalQuality: {
    status: string;
    count?: number;
    avg_results?: number;
    avg_snippets?: number;
    avg_context_chars?: number;
    semantic_count?: number;
    semantic_rate?: number;
    last_query?: string;
    last_scope?: string;
    last_status?: string;
    last_at?: string;
  };
  codeContextSearch: {
    status: string;
    count?: number;
    avg_results?: number;
    avg_snippets?: number;
    avg_context_chars?: number;
    semantic_count?: number;
    semantic_rate?: number;
    last_query?: string;
    last_repo?: string;
    last_status?: string;
    last_at?: string;
  };
  skillRegistry: {
    status: string;
    source_count?: number;
    installed_count?: number;
    entries?: AiTelemetryRegistryEntry[];
  };
  skillUsage: {
    status: string;
    total?: number;
    by_skill?: Array<{
      id: string;
      count: number;
      last_used_at: string;
    }>;
  };
  codexProductivity: {
    status: string;
    total_runs?: number;
    verified_runs?: number;
    unique_repos_touched?: number;
    tool_usage_events?: number;
    latest_run?: {
      task: string;
      next_action: string;
      finished_at: string;
    };
    recent_ledger?: Array<{
      run_id: string;
      task: string;
      finished_at: string;
      status: string;
      repo_count: number;
      repos: string[];
      verification_count: number;
      commit_count: number;
      next_action: string;
      blockers: string[];
    }>;
  };
  tokenContextWaste: {
    status: string;
    files_scanned?: number;
    repeated_health_gate_count?: number;
    files_with_no_assistant_reply?: number;
    bridge_noise_files?: number;
    wrapper_total_context_chars?: number;
    wrapper_avg_context_chars?: number;
  };
  modelRouting: {
    status: string;
    fast?: string;
    balanced?: string;
    heavy?: string;
    embedding?: string;
    embedding_event_count?: number;
    latest_embedding_model?: string;
  };
  toolUsage: {
    status: string;
    count?: number;
    last_tool?: string;
    last_status?: string;
    last_at?: string;
  };
  aiResponse: {
    status: string;
    count?: number;
    required_fields?: string[];
    providers?: string[];
    models?: string[];
    latest?: Record<string, unknown>;
    source_paths?: Record<string, string>;
  };
  aiResponseUsage: {
    status: string;
    count?: number;
    success_count?: number;
    success_rate?: number;
    provider_count?: number;
    model_count?: number;
    providers?: string[];
    models?: string[];
    total_input_tokens?: number;
    total_cached_input_tokens?: number;
    total_output_tokens?: number;
    total_reasoning_tokens?: number;
    total_tokens?: number;
    total_cost_usd?: number;
    avg_latency_ms?: number;
    avg_cost_usd?: number;
    last_provider?: string;
    last_model?: string;
    last_run_id?: string;
    last_goal_id?: string;
    last_status?: string;
    last_at?: string;
    latest_summary?: string;
  };
  promptCacheEfficiency: {
    status: string;
    count?: number;
    cached_input_tokens?: number;
    uncached_input_tokens?: number;
    effective_input_tokens?: number;
    cache_ratio?: number;
    by_model?: Array<{
      provider: string;
      model: string;
      count: number;
      cached_input_tokens: number;
      uncached_input_tokens: number;
      cache_ratio: number;
    }>;
  };
  costByModel: {
    status: string;
    entries?: Array<{
      provider: string;
      model: string;
      count: number;
      success_count: number;
      total_cost_usd: number;
      total_tokens: number;
      avg_latency_ms: number;
      avg_cost_usd: number;
    }>;
  };
  costByGoal: {
    status: string;
    entries?: Array<{
      goal_id: string;
      count: number;
      run_ids: string[];
      model_count: number;
      total_cost_usd: number;
      total_tokens: number;
    }>;
  };
  tokensPerVerifiedRun: {
    status: string;
    run_count?: number;
    avg_tokens?: number;
    avg_cost_usd?: number;
    entries?: Array<{
      run_id: string;
      goal_id: string;
      task: string;
      event_count: number;
      total_tokens: number;
      total_cost_usd: number;
      verified_checks: number;
    }>;
  };
  budgetDrift: {
    status: string;
    evaluated_count?: number;
    unknown_budget_count?: number;
    by_budget?: Array<{
      context_budget: string;
      count: number;
      within_budget: number;
      over_budget: number;
      under_budget: number;
      avg_drift_ratio: number;
    }>;
  };
  research: {
    status: string;
    run_count?: number;
    source_card_count?: number;
    provider_count?: number;
    providers?: string[];
    source_domains?: string[];
    last_research_run_id?: string;
    last_title?: string;
    last_topic?: string;
    last_imported_at?: string;
    obsidian_note_path?: string;
    obsidian_note_present?: boolean;
    source_paths?: Record<string, string>;
    freshness?: Record<string, string>;
  };
  memory: {
    status: string;
    architectural_decision_count?: number;
    agent_intent_count?: number;
    active_goal_count?: number;
    shared_scratchpad_present?: boolean;
    workspace_focus?: string;
    highlights?: string[];
    source_paths?: Record<string, string>;
    freshness?: Record<string, string>;
  };
  tokenEconomy: {
    status: string;
    total_tokens?: number;
    total_cost_usd?: number;
    avg_latency_ms?: number;
    cache_ratio?: number;
    verified_run_count?: number;
    avg_tokens_per_verified_run?: number;
    avg_cost_per_verified_run?: number;
    wrapper_total_context_chars?: number;
    repeated_health_gate_count?: number;
    budget_evaluated_count?: number;
    budget_unknown_count?: number;
    over_budget_count?: number;
    under_budget_count?: number;
  };
  failureAwareObservability: {
    status: string;
    ai_response_failure_count?: number;
    run_with_blockers_count?: number;
    openclaw_warning_count?: number;
    openclaw_status?: string;
    latest_ai_failure?: Record<string, unknown>;
    latest_blocked_run?: Record<string, unknown>;
    source_paths?: Record<string, string>;
  };
  recentEvents: AiTelemetryRecentEvent[];
  source: SourceMeta;
}

export interface CommercialReadiness {
  generatedAt: string;
  overallStatus: string;
  hostHealth: string;
  blockedByHostHealth: boolean;
  score: number;
  targetProduct: {
    id: string;
    title: string;
    path: string;
  };
  summary: {
    implemented: number;
    scaffolded: number;
    missing: number;
    dirtyFocusRepos: number;
    highRiskBlockers: number;
  };
  nextAction: string;
  highRiskBlockers: string[];
  checks: Array<{
    label: string;
    status: string;
    repo_id: string;
    evidence: string[];
    detail: string;
  }>;
  atlasExport: {
    safe_to_expose: boolean;
    section_label: string;
    endpoint_hint: string;
    source_path: string;
  };
  focusRepos: Array<{
    id: string;
    title: string;
    kind: string;
    path: string;
    source_note: string;
    branch: string;
    dirty_count: number;
    dirty_preview: string[];
    status: string;
  }>;
  source: SourceMeta;
  productIntelSource: SourceMeta;
}
