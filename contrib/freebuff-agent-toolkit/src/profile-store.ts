import { chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { readJson, resolveConfigRoot, writeJsonAtomic } from './storage.js'
import type {
  ProfileDocument,
  ProviderProfile,
  ResolvedProviderProfile,
} from './types.js'

const PROFILE_NAME = /^[A-Za-z0-9._-]{1,64}$/
const ENV_NAME = /^[A-Z][A-Z0-9_]{0,127}$/
const DEFAULT_MAX_STEPS = 40

function defaultDocument(): ProfileDocument {
  return {
    version: 1,
    profiles: {},
    updatedAt: new Date(0).toISOString(),
  }
}

function assertProfile(profile: ProviderProfile): void {
  if (!PROFILE_NAME.test(profile.name)) {
    throw new Error('Profile name must contain only letters, numbers, dots, underscores, or hyphens')
  }

  let url: URL
  try {
    url = new URL(profile.baseUrl)
  } catch {
    throw new Error(`Invalid profile base URL: ${profile.baseUrl}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Profile base URL must use HTTP or HTTPS')
  }

  if (!profile.model.trim()) throw new Error('Profile model cannot be empty')
  if (!ENV_NAME.test(profile.apiKeyEnv)) {
    throw new Error('Profile apiKeyEnv must be a valid uppercase environment variable')
  }
  if (profile.maxSteps !== undefined && (!Number.isInteger(profile.maxSteps) || profile.maxSteps < 1 || profile.maxSteps > 200)) {
    throw new Error('Profile maxSteps must be an integer between 1 and 200')
  }

  for (const [key, value] of Object.entries(profile.headers ?? {})) {
    if (!key.trim() || /[\r\n]/.test(key) || /[\r\n]/.test(value)) {
      throw new Error('Profile headers cannot contain empty names or newlines')
    }
  }
}

export class ProfileStore {
  readonly filePath: string

  constructor(filePath = join(resolveConfigRoot(), 'profiles.json')) {
    this.filePath = filePath
  }

  async load(): Promise<ProfileDocument> {
    const raw = await readJson(this.filePath)
    if (raw === null) return defaultDocument()
    if (!raw || typeof raw !== 'object') throw new Error('Profile file must contain a JSON object')

    const document = raw as Partial<ProfileDocument>
    if (document.version !== 1 || !document.profiles || typeof document.profiles !== 'object') {
      throw new Error('Unsupported profile file format')
    }

    for (const profile of Object.values(document.profiles)) assertProfile(profile)
    return {
      version: 1,
      active: document.active,
      profiles: document.profiles,
      updatedAt: document.updatedAt ?? new Date(0).toISOString(),
    }
  }

  async list(): Promise<ProviderProfile[]> {
    const document = await this.load()
    return Object.values(document.profiles).sort((a, b) => a.name.localeCompare(b.name))
  }

  async get(name: string): Promise<ProviderProfile | undefined> {
    return (await this.load()).profiles[name]
  }

  async save(profile: ProviderProfile): Promise<void> {
    assertProfile(profile)
    const document = await this.load()
    document.profiles[profile.name] = {
      ...profile,
      baseUrl: profile.baseUrl.replace(/\/+$/, ''),
      model: profile.model.trim(),
      apiKeyEnv: profile.apiKeyEnv.trim(),
      maxSteps: profile.maxSteps ?? DEFAULT_MAX_STEPS,
    }
    document.updatedAt = new Date().toISOString()
    await writeJsonAtomic(this.filePath, document)
  }

  async remove(name: string): Promise<boolean> {
    const document = await this.load()
    if (!(name in document.profiles)) return false
    delete document.profiles[name]
    if (document.active === name) delete document.active
    document.updatedAt = new Date().toISOString()
    await writeJsonAtomic(this.filePath, document)
    return true
  }

  async setActive(name: string): Promise<void> {
    const document = await this.load()
    if (!document.profiles[name]) throw new Error(`Unknown profile: ${name}`)
    document.active = name
    document.updatedAt = new Date().toISOString()
    await writeJsonAtomic(this.filePath, document)
  }

  async resolve(name?: string, env: NodeJS.ProcessEnv = process.env): Promise<ResolvedProviderProfile> {
    const document = await this.load()
    const selected = name ?? document.active
    if (!selected || !document.profiles[selected]) {
      throw new Error('No active provider profile is configured')
    }
    const profile = document.profiles[selected]
    const apiKey = env[profile.apiKeyEnv]?.trim()
    return apiKey ? { ...profile, apiKey } : { ...profile }
  }

  async makePrivate(): Promise<void> {
    await chmod(this.filePath, 0o600)
  }
}

export function validateProviderProfile(profile: ProviderProfile): void {
  assertProfile(profile)
}
