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

export interface AiLabGroupAction {
  label: string;
  launcherId: string;
  target: string;
  status: string;
}

export interface AiLabGroupItem {
  id: string;
  label: string;
  status: string;
  summary: string;
  path?: string;
  primaryTarget?: string;
  installedTools?: string[];
  missingTools?: string[];
  actions?: AiLabGroupAction[];
}

export interface AiLabToolInventoryEntry {
  id: string;
  label: string;
  command: string;
  path: string;
  category: string;
  status: string;
  openTarget: string;
}

export interface AiLabLauncher {
  id: string;
  label: string;
  status: string;
  kind: string;
  target: string;
}

export interface AiLabRunEntry {
  runId: string;
  status: string;
  dryRun: boolean;
  repoId: string;
  taskType: string;
  taskText: string;
  contextBudget: string;
  selectedAgent: string;
  sandboxBackend: string;
  generatedAt: string;
  runReportPath: string;
  failedChecks: string[];
  overBudget: boolean;
  delegationStatus: string;
  fallbackUsed: boolean;
  savedContextCharsEstimated: number;
  plannedWorkerModels: Record<string, string>;
  nextBestAction: string;
}

export interface ContextPackStatus {
  status: string;
  generatedAt: string;
  scope: string;
  agent: string;
  taskHash: string;
  contextBudget: string;
  hybridStatus: string;
  hybridMatchCount: number;
  repoIntelStatus: string;
  repoCandidateCount: number;
  goalCount: number;
  runSummaryCount: number;
  verificationCommandCount: number;
  sourceRegistryHitCount: number;
  sanitized: boolean;
}

export interface KnowledgeGraphStatus {
  status: string;
  scope: string;
  generatedAt: string;
  nodeCount: number;
  edgeCount: number;
  durationMs: number;
  sanitized: boolean;
}

export interface RagE2eEvalStatus {
  status: string;
  scope: string;
  limit: number;
  budget: string;
  fixtureCount: number;
  hitAt1: number;
  hitAt3: number;
  mrr: number;
  sanitized: boolean;
}

export interface LocalModelRagEntrypointStatus {
  status: string;
  generatedAt: string;
  taskHash: string;
  scope: string;
  model: string;
  mode: string;
  graphMatchCount: number;
  sourceRegistryHitCount: number;
  dryRun: boolean;
  sanitized: boolean;
}

export interface CodexContextEntrypointStatus {
  status: string;
  generatedAt: string;
  scope: string;
  taskHash: string;
  sourceRegistryHitCount: number;
  graphMatchCount: number;
  sanitized: boolean;
}

export interface LocalGpuLiveBenchStatus {
  status: string;
  generatedAt: string;
  model: string;
  numCtx: number;
  numPredict: number;
  processorLine: string;
  metrics: {
    status: string;
    elapsedSec: number;
    promptEvalCount: number;
    promptEvalSec: number;
    evalCount: number;
    evalSec: number;
    tokensPerSec: number;
  };
  gpuSummary: {
    status: string;
    sampleCount: number;
    gpuUtilAvgPct: number;
    gpuUtilMaxPct: number;
    memUtilAvgPct: number;
    memUtilMaxPct: number;
    memUsedAvgMib: number;
    memUsedMaxMib: number;
    powerAvgW: number;
    powerMaxW: number;
    tempMaxC: number;
    pstates: string[];
  };
  offloadRecommendations: {
    status: string;
    fast: string;
    balanced: string;
    heavy: string;
    rankedCount: number;
    sanitized: boolean;
  };
  sanitized: boolean;
}

export interface AiLabPrepareResponse {
  task: string;
  proposedBudget: string;
  routeId: string;
  routeLabel: string;
  selectedAgent: string;
  localCloudDecision: {
    mode: string;
    reason: string;
  };
  sandboxStatus: {
    backend: string;
    mode: string;
    permissionTier: string;
  };
  retrievalSources: string[];
  excludedSources: string[];
  focusFiles: string[];
  scientificToolTarget: {
    labId: string;
    label: string;
    launcherId: string;
    target: string;
    reason: string;
  } | null;
  verificationCommands: string[];
  codexNecessary: boolean;
  codexReason: string;
  nextBestAction: string;
}

export interface AiLab {
  generatedAt: string;
  status: string;
  source: SourceMeta;
  control: {
    tokenBudgetTier: string;
    retrievalSources: string[];
    excludedSources: string[];
    selectedAgentRoute: {
      routeId: string;
      routeLabel: string;
      selectedAgent: string;
      defaultContextBudget: string;
      localCloudDecision: {
        mode: string;
        reason: string;
      };
    };
    sandboxStatus: {
      backend: string;
      mode: string;
      permissionTier: string;
      rawConversationMirrorsAllowed: boolean;
      hostHealth: string;
    };
    activeRuns: AiLabRunEntry[];
    latestRunReports: AiLabRunEntry[];
    tokenWasteMarkers: {
      filesScanned: number;
      repeatedHealthGateCount: number;
      bridgeNoiseFiles: number;
      filesWithNoAssistantReply: number;
      highWasteCapsulesPath: string;
    };
    goalCapsules: Array<{
      goalId: string;
      status: string;
      objective: string;
      nextAction: string;
      recommendedContextBudget: string;
      sourcePath: string;
    }>;
    nextBestAction: string;
  };
  groups: {
    codexControlLab: AiLabGroupItem[];
    scientificVisualLab: AiLabGroupItem[];
  };
  scientificTools: {
    generatedAt: string;
    inventory: AiLabToolInventoryEntry[];
    installed: string[];
    missing: string[];
    launchers: AiLabLauncher[];
  };
  prepareFlow: {
    endpoint: string;
    toolInventoryEndpoint: string;
    launcherEndpoint: string;
    executionPolicy: string;
    launcherIds: string[];
  };
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
    highWasteCapsulesPath?: string;
    tokenEconomyReportPath?: string;
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
  activeRuns: AiLabRunEntry[];
  latestRunReports: AiLabRunEntry[];
  knowledgeGraphStatus: KnowledgeGraphStatus;
  contextPackStatus: ContextPackStatus;
  ragE2eEvalStatus: RagE2eEvalStatus;
  localModelRagEntrypointStatus: LocalModelRagEntrypointStatus;
  codexContextEntrypointStatus: CodexContextEntrypointStatus;
  localGpuLiveBenchStatus: LocalGpuLiveBenchStatus;
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
  latestHermes: {
    status: string;
    runtime_state: string;
    state_reason: string;
    selected_runtime: string;
    requested_runtime: string;
    fallback_used: boolean;
    fallback_target: string;
    policy_allowed: boolean;
    delegation_status: string;
    preflight_completed: boolean;
    preflight_mode_resolved: string;
    hermes_installed: boolean;
    hermes_binary: string;
    runtime_policy_path: string;
    worker_manifest_path: string;
    workers_dir: string;
    skip_reason: string;
    saved_context_chars_estimated: number;
    failed_roles: string[];
    planned_worker_models: Record<string, string>;
  };
  agentRouting: {
    source_path?: string;
    default_route?: string;
    default_context_budget?: string;
    agents?: Array<{
      id: string;
      label: string;
      kind: string;
      why?: string;
      preferred_model?: string;
      availability?: {
        command?: string;
      };
    }>;
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
  aiLab: AiLab;
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
    optional_fields?: string[];
    providers?: string[];
    models?: string[];
    latest?: {
      ts?: string;
      provider?: string;
      model?: string;
      workspace_id?: string;
      agent_id?: string;
      billing_source?: string;
      session_id?: string;
      cache_policy?: string;
      cache_write_tokens?: number;
      cache_read_tokens?: number;
      cache_discount_usd?: number;
      guardrail_status?: string;
      input_tokens?: number;
      input_tokens_include_cached?: boolean;
      uncached_input_tokens?: number;
      cached_input_tokens?: number;
      output_tokens?: number;
      reasoning_tokens?: number;
      total_tokens?: number;
      cost_usd?: number;
      latency_ms?: number;
      response_id?: string;
      context_budget?: string;
      run_id?: string;
      goal_id?: string;
      success_status?: string;
    };
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
    workspace_count?: number;
    agent_count?: number;
    session_count?: number;
    billing_sources?: string[];
    cache_policies?: string[];
    guardrail_status_buckets?: Record<string, number>;
    total_input_tokens?: number;
    total_uncached_input_tokens?: number;
    total_effective_input_tokens?: number;
    total_cached_input_tokens?: number;
    total_cache_write_tokens?: number;
    total_cache_read_tokens?: number;
    total_cache_discount_usd?: number;
    total_output_tokens?: number;
    total_reasoning_tokens?: number;
    total_tokens?: number;
    total_cost_usd?: number;
    avg_latency_ms?: number;
    avg_cost_usd?: number;
    last_provider?: string;
    last_model?: string;
    last_workspace_id?: string;
    last_agent_id?: string;
    last_billing_source?: string;
    last_session_id?: string;
    last_cache_policy?: string;
    last_guardrail_status?: string;
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
  tokenGovernor: {
    status: string;
    run_count?: number;
    budget_names?: string[];
    over_budget_count?: number;
    latest?: {
      run_id: string;
      repo_id: string;
      context_budget: string;
      estimated_context_chars: number;
      max_context_chars: number;
      warning_threshold_chars: number;
      retrieval_pack_hash: string;
      excluded_source_count: number;
      warning_count: number;
      over_budget: boolean;
    };
    by_budget?: Array<{
      context_budget: string;
      count: number;
      avg_estimated_context_chars: number;
      avg_max_context_chars: number;
      over_budget_count: number;
    }>;
    source_paths?: Record<string, string>;
  };
  hermesRuntime: {
    status: string;
    state?: string;
    installed?: boolean;
    binary?: string;
    selected_runtime?: string;
    fallback_used?: boolean;
    fallback_target?: string;
    state_reason?: string;
    delegation_status?: string;
    run_count?: number;
    policy_status?: string;
    gateway_enabled?: boolean;
    latest?: Record<string, unknown>;
    state_counts?: Array<{
      state: string;
      count: number;
    }>;
    source_paths?: Record<string, string>;
  };
  agentTrace: {
    status: string;
    total_events?: number;
    run_count?: number;
    cache_hit_count?: number;
    cache_miss_count?: number;
    command_run_count?: number;
    test_run_count?: number;
    file_read_count?: number;
    patch_applied_count?: number;
    ai_response_count?: number;
    by_event?: Array<{
      event_type: string;
      count: number;
    }>;
    recent_events?: Array<{
      ts: string;
      event_type: string;
      run_id: string;
      repo_id: string;
      subject: string;
      status: string;
    }>;
    latest_run?: {
      run_id: string;
      repo_id: string;
      status: string;
      phase: string;
    };
    source_paths?: Record<string, string>;
  };
  cacheLedger: {
    status: string;
    hit_count?: number;
    miss_count?: number;
    hit_rate?: number;
    unique_cache_keys?: number;
    entries?: Array<{
      ts: string;
      event_type: string;
      run_id: string;
      repo_id: string;
      cache_key: string;
      previous_run_id: string;
    }>;
    by_repo?: Array<{
      repo_id: string;
      count: number;
    }>;
    source_paths?: Record<string, string>;
  };
  redundantWork: {
    status: string;
    repeated_retrieval_packs?: number;
    repeated_queries?: number;
    repeated_commands?: number;
    repeated_file_reads?: number;
    top_retrieval_packs?: Array<{
      retrieval_pack_hash: string;
      count: number;
    }>;
    top_queries?: Array<{
      query: string;
      count: number;
    }>;
    top_commands?: Array<{
      command: string;
      count: number;
    }>;
    top_files?: Array<{
      path: string;
      count: number;
    }>;
    source_paths?: Record<string, string>;
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
    tracked_account_count?: number;
    top_expensive_run_count?: number;
  };
  accountAnalytics: {
    status: string;
    tokens_by_account?: Array<{
      account_key: string;
      account_label: string;
      account_email: string;
      account_id: string;
      conversation_tokens: number;
      ai_response_tokens: number;
      total_tokens: number;
      runs: number;
      sessions: number;
      verified_runs: number;
      unverified_runs: number;
    }>;
    runs_by_account?: Array<{
      account_label: string;
      account_email: string;
      account_id: string;
      runs: number;
      sessions: number;
      verified_runs: number;
      unverified_runs: number;
    }>;
    unknown_account_sessions?: Array<{
      session_id: string;
      path: string;
      tokens_used: number;
    }>;
    source_paths?: Record<string, string>;
  };
  tokenEconomyReport: {
    status: string;
    wasted_tokens?: number;
    repeated_health_gate_count?: number;
    over_budget_run_count?: number;
    top_expensive_runs?: Array<{
      run_id: string;
      goal_id: string;
      account_email: string;
      account_id: string;
      account_label: string;
      models: string[];
      verification_status: string;
      success_status: string;
      event_count: number;
      total_tokens: number;
      total_cost_usd: number;
    }>;
    over_budget_runs?: Array<{
      run_id: string;
      repo_id: string;
      context_budget: string;
      verification_status: string;
      estimated_context_chars: number;
      max_context_chars: number;
      over_budget: boolean;
      gate_blocked: boolean;
      blocked_reasons: string[];
    }>;
    budget_drift?: {
      status?: string;
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
    tokens_per_verified_run?: {
      run_count?: number;
      avg_tokens?: number;
      entries?: Array<{
        run_id: string;
        goal_id: string;
        task: string;
        account_email: string;
        account_id: string;
        account_label: string;
        models: string[];
        verification_status: string;
        event_count: number;
        total_tokens: number;
        total_cost_usd: number;
        verified_checks: number;
      }>;
    };
    failed_or_partial_token_waste?: {
      status?: string;
      total_tokens?: number;
      run_count?: number;
      entries?: Array<{
        run_id: string;
        goal_id: string;
        account_email: string;
        account_id: string;
        account_label: string;
        verification_status: string;
        success_status: string;
        total_tokens: number;
        total_cost_usd: number;
      }>;
    };
    top_waste_sources?: Array<{
      session_id: string;
      account_label: string;
      account_email: string;
      account_id: string;
      tokens_used: number;
      classification: string;
      reason: string;
    }>;
    tokens_by_account?: Array<{
      account_key: string;
      account_label: string;
      account_email: string;
      account_id: string;
      conversation_tokens: number;
      ai_response_tokens: number;
      total_tokens: number;
      runs: number;
      sessions: number;
      verified_runs: number;
      unverified_runs: number;
    }>;
    runs_by_account?: Array<{
      account_label: string;
      account_email: string;
      account_id: string;
      runs: number;
      sessions: number;
      verified_runs: number;
      unverified_runs: number;
    }>;
    unknown_account_sessions?: Array<{
      session_id: string;
      path?: string;
      tokens_used: number;
    }>;
    source_paths?: Record<string, string>;
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
  guardrailEvents: {
    status: string;
    count?: number;
    blocked_count?: number;
    review_count?: number;
    by_type?: Array<{
      event_type: string;
      count: number;
    }>;
    by_status?: Array<{
      status: string;
      count: number;
    }>;
    recent_events?: Array<{
      ts: string;
      event_type: string;
      status: string;
      summary: string;
      reason: string;
      run_id: string;
      repo_id: string;
      context_budget: string;
      workspace_id: string;
      agent_id: string;
      billing_source: string;
      session_id: string;
      matched_pattern: string;
      command: string;
      source: string;
      source_path: string;
    }>;
    latest_event?: Record<string, unknown>;
    safe_to_expose?: boolean;
    source_paths?: Record<string, string>;
  };
  aiActivityExplorer: {
    status: string;
    overview?: {
      status: string;
      ai_response_count?: number;
      provider_count?: number;
      model_count?: number;
      workspace_count?: number;
      agent_count?: number;
      session_count?: number;
      total_tokens?: number;
      total_cost_usd?: number;
      total_cache_discount_usd?: number;
      openrouter_response_count?: number;
      openrouter_total_tokens?: number;
      optional_provider_present?: boolean;
      guardrail_event_count?: number;
      last_guardrail_status?: string;
      last_provider?: string;
      last_model?: string;
    };
    trends?: {
      status: string;
      by_provider?: Array<{
        provider: string;
        count: number;
        total_tokens: number;
        total_cost_usd: number;
        openrouter: boolean;
      }>;
      by_billing_source?: Array<{
        billing_source: string;
        count: number;
        total_tokens: number;
        total_cost_usd: number;
      }>;
      by_cache_policy?: Array<{
        cache_policy: string;
        count: number;
        cache_read_tokens: number;
        cache_write_tokens: number;
        cache_discount_usd: number;
      }>;
      by_guardrail_status?: Array<{
        guardrail_status: string;
        count: number;
      }>;
      by_day?: Array<{
        day: string;
        count: number;
        total_tokens: number;
        total_cost_usd: number;
        guardrail_event_count: number;
      }>;
    };
    explore?: {
      status: string;
      recent_responses?: Array<{
        ts: string;
        provider: string;
        model: string;
        workspace_id: string;
        agent_id: string;
        billing_source: string;
        session_id: string;
        context_budget: string;
        run_id: string;
        success_status: string;
        guardrail_status: string;
        cache_policy: string;
        cache_write_tokens: number;
        cache_read_tokens: number;
        cache_discount_usd: number;
        total_tokens: number;
        cost_usd: number;
      }>;
      workspaces?: Array<{
        workspace_id: string;
        count: number;
        total_tokens: number;
      }>;
      agents?: Array<{
        agent_id: string;
        count: number;
        total_tokens: number;
      }>;
      sessions?: Array<{
        session_id: string;
        count: number;
        total_tokens: number;
        last_at: string;
      }>;
    };
    guardrails?: {
      status: string;
      count?: number;
      blocked_count?: number;
      review_count?: number;
      by_type?: Array<{
        event_type: string;
        count: number;
      }>;
      by_status?: Array<{
        status: string;
        count: number;
      }>;
      recent_events?: Array<{
        ts: string;
        event_type: string;
        status: string;
        summary: string;
        reason: string;
        run_id: string;
        repo_id: string;
        context_budget: string;
        workspace_id: string;
        agent_id: string;
        billing_source: string;
        session_id: string;
        matched_pattern: string;
        command: string;
        source: string;
        source_path: string;
      }>;
      latest_event?: Record<string, unknown>;
      safe_to_expose?: boolean;
      source_paths?: Record<string, string>;
    };
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
