export type ProfileName = string

export interface ProviderProfile {
  name: ProfileName
  baseUrl: string
  model: string
  apiKeyEnv: string
  maxSteps?: number
  headers?: Record<string, string>
}

export interface ProfileDocument {
  version: 1
  active?: ProfileName
  profiles: Record<ProfileName, ProviderProfile>
  updatedAt: string
}

export interface ResolvedProviderProfile extends ProviderProfile {
  apiKey?: string
}

export type BackgroundSessionStatus =
  | 'running'
  | 'exited'
  | 'failed'
  | 'killed'
  | 'stale'

export interface BackgroundSession {
  id: string
  name?: string
  pid: number
  cwd: string
  command: string[]
  logPath: string
  status: BackgroundSessionStatus
  startedAt: string
  updatedAt: string
  finishedAt?: string
  exitCode?: number
  signal?: string
}

export interface RepoSymbol {
  name: string
  line: number
  signature: string
}

export interface RepoMapFile {
  path: string
  symbols: RepoSymbol[]
  score: number
}

export interface RepoMapOptions {
  root: string
  maxTokens?: number
  focusFiles?: string[]
}

export interface RepoMapResult {
  map: string
  files: RepoMapFile[]
  tokenCount: number
  fileCount: number
  totalFileCount: number
}

export type TaskKind = 'quick' | 'implementation' | 'review' | 'research'

export interface RouteRule {
  kind: TaskKind
  profile: ProfileName
  maxSteps: number
  fallbacks?: ProfileName[]
}

export interface RouteRequest {
  kind: TaskKind
  preferredProfile?: ProfileName
  maxSteps?: number
}

export interface AgentRoute {
  kind: TaskKind
  profile: ProviderProfile
  maxSteps: number
  fallbacks: ProviderProfile[]
}
