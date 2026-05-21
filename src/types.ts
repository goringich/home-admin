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
}
