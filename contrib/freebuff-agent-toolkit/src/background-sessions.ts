import { createWriteStream } from 'node:fs'
import { chmod, mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { spawn, type ChildProcess } from 'node:child_process'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ensureDirectory, readJson, resolveStateRoot, writeJsonAtomic } from './storage.js'
import type { BackgroundSession, BackgroundSessionStatus } from './types.js'

const ID = /^[A-Za-z0-9._-]{1,80}$/
const SIGNALS = new Set(['SIGTERM', 'SIGINT', 'SIGKILL', 'SIGHUP'])

function assertId(id: string): void {
  if (!ID.test(id)) throw new Error('Session id contains unsafe characters')
}

function isAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function metadataIsComplete(value: unknown): value is BackgroundSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<BackgroundSession>
  return Boolean(
    typeof session.id === 'string' &&
      ID.test(session.id) &&
      Number.isInteger(session.pid) &&
      typeof session.cwd === 'string' &&
      Array.isArray(session.command) &&
      session.command.every(item => typeof item === 'string') &&
      typeof session.logPath === 'string' &&
      typeof session.status === 'string' &&
      typeof session.startedAt === 'string' &&
      typeof session.updatedAt === 'string',
  )
}

export class BackgroundSessionStore {
  readonly root: string
  readonly sessionsDir: string
  readonly logsDir: string

  constructor(root = resolveStateRoot()) {
    this.root = resolve(root)
    this.sessionsDir = join(this.root, 'sessions')
    this.logsDir = join(this.root, 'logs')
  }

  private pathFor(id: string): string {
    assertId(id)
    return join(this.sessionsDir, `${id}.json`)
  }

  private async write(session: BackgroundSession): Promise<void> {
    await writeJsonAtomic(this.pathFor(session.id), session)
  }

  async register(session: BackgroundSession): Promise<void> {
    assertId(session.id)
    if (!resolve(session.cwd)) throw new Error('Session cwd is required')
    if (!metadataIsComplete(session)) throw new Error('Invalid background session metadata')
    await ensureDirectory(this.sessionsDir)
    await ensureDirectory(this.logsDir)
    await this.write(session)
  }

  async start(
    command: string,
    args: string[] = [],
    options: { cwd?: string; name?: string } = {},
  ): Promise<BackgroundSession> {
    if (!command.trim()) throw new Error('Background command cannot be empty')
    if (args.some(arg => typeof arg !== 'string')) throw new Error('Background arguments must be strings')
    const cwd = resolve(options.cwd ?? process.cwd())
    const id = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`
    const logPath = join(this.logsDir, `${id}.log`)
    await ensureDirectory(this.logsDir)
    const log = createWriteStream(logPath, { flags: 'a', mode: 0o600 })
    const child = spawn(command, args, {
      cwd,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout?.pipe(log, { end: false })
    child.stderr?.pipe(log, { end: false })
    child.unref()

    const now = new Date().toISOString()
    const session: BackgroundSession = {
      id,
      name: options.name,
      pid: child.pid ?? -1,
      cwd,
      command: [command, ...args],
      logPath,
      status: 'running',
      startedAt: now,
      updatedAt: now,
    }
    await this.register(session)

    child.once('exit', (exitCode, signal) => {
      void this.finish(session.id, exitCode ?? undefined, signal ?? undefined)
      log.end()
    })
    child.once('error', error => {
      void this.finish(session.id, 1, error.name)
      log.end()
    })
    return session
  }

  async get(id: string): Promise<BackgroundSession | undefined> {
    const raw = await readJson(this.pathFor(id))
    if (raw === null) return undefined
    if (!metadataIsComplete(raw)) throw new Error(`Invalid metadata for session: ${id}`)
    return raw
  }

  async list(): Promise<BackgroundSession[]> {
    let names: string[]
    try {
      names = await readdir(this.sessionsDir)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
      throw error
    }

    const sessions: BackgroundSession[] = []
    for (const name of names.filter(item => item.endsWith('.json'))) {
      const session = await this.get(name.slice(0, -5))
      if (!session) continue
      if (session.status === 'running' && !isAlive(session.pid)) {
        session.status = 'stale'
        session.updatedAt = new Date().toISOString()
        await this.write(session)
      }
      sessions.push(session)
    }
    return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  async stop(id: string, signal = 'SIGTERM'): Promise<BackgroundSession> {
    if (!SIGNALS.has(signal)) throw new Error(`Unsupported stop signal: ${signal}`)
    const session = await this.get(id)
    if (!session) throw new Error(`Unknown background session: ${id}`)
    if (session.status !== 'running') return session

    try {
      process.kill(session.pid, signal as NodeJS.Signals)
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) throw error
    }
    session.status = 'killed'
    session.updatedAt = new Date().toISOString()
    session.finishedAt = session.updatedAt
    await this.write(session)
    return session
  }

  async finish(id: string, exitCode?: number, signal?: string): Promise<void> {
    const session = await this.get(id)
    if (!session || session.status !== 'running') return
    session.status = signal || exitCode !== 0 ? 'failed' : 'exited'
    session.exitCode = exitCode ?? undefined
    session.signal = signal
    session.finishedAt = new Date().toISOString()
    session.updatedAt = session.finishedAt
    await this.write(session)
  }

  async readLog(id: string, maxBytes = 128 * 1024): Promise<string> {
    if (!Number.isInteger(maxBytes) || maxBytes < 1) throw new Error('maxBytes must be positive')
    const session = await this.get(id)
    if (!session) throw new Error(`Unknown background session: ${id}`)
    const info = await stat(session.logPath)
    const contents = await readFile(session.logPath)
    if (info.size <= maxBytes) return contents.toString('utf8')
    return `[log truncated; showing last ${maxBytes} bytes]\n${contents.subarray(-maxBytes).toString('utf8')}`
  }
}

export function normalizeSessionStatus(status: BackgroundSessionStatus): BackgroundSessionStatus {
  return status
}
