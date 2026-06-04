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
