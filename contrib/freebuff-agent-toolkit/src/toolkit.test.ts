import { afterEach, describe, expect, test } from 'bun:test'
import { chmod, mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AgentRouter } from './agent-routing.js'
import { BackgroundSessionStore } from './background-sessions.js'
import { ProfileStore } from './profile-store.js'
import { buildRepoMap } from './repo-map.js'
import type { BackgroundSession, ProviderProfile } from './types.js'

const temporaryRoots: string[] = []

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'freebuff-agent-toolkit-'))
  temporaryRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

const profiles: ProviderProfile[] = [
  { name: 'quick', baseUrl: 'https://example.test/v1', model: 'fast-model', apiKeyEnv: 'QUICK_KEY', maxSteps: 12 },
  { name: 'coding', baseUrl: 'https://example.test/v1', model: 'code-model', apiKeyEnv: 'CODE_KEY', maxSteps: 80 },
]

describe('ProfileStore', () => {
  test('stores profile metadata atomically and resolves credentials from env', async () => {
    const root = await temporaryRoot()
    const filePath = join(root, 'config', 'profiles.json')
    const store = new ProfileStore(filePath)
    await store.save(profiles[1])
    await store.setActive('coding')

    const resolved = await store.resolve(undefined, { CODE_KEY: 'secret-value' })
    expect(resolved.apiKey).toBe('secret-value')
    expect(JSON.parse(await readFile(filePath, 'utf8')).profiles.coding.apiKey).toBeUndefined()
  })

  test('rejects unsafe profile values', async () => {
    const root = await temporaryRoot()
    const store = new ProfileStore(join(root, 'profiles.json'))
    await expect(store.save({ ...profiles[0], name: '../escape' })).rejects.toThrow()
    await expect(store.save({ ...profiles[0], baseUrl: 'file:///tmp/model' })).rejects.toThrow()
  })
})

describe('BackgroundSessionStore', () => {
  test('marks dead registered sessions stale and reads bounded logs', async () => {
    const root = await temporaryRoot()
    const store = new BackgroundSessionStore(root)
    const logPath = join(root, 'logs', 'dead.log')
    await Bun.write(logPath, 'x'.repeat(100))
    const session: BackgroundSession = {
      id: 'dead-session',
      pid: 999999,
      cwd: root,
      command: ['fake-command'],
      logPath,
      status: 'running',
      startedAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }
    await store.register(session)
    const listed = await store.list()
    expect(listed[0].status).toBe('stale')
    expect((await store.readLog('dead-session', 10)).length).toBeGreaterThan(10)
  })
})

describe('buildRepoMap', () => {
  test('ranks imported definitions and respects a token budget', async () => {
    const root = await temporaryRoot()
    await Bun.write(join(root, 'helper.ts'), 'export function helper() { return 1 }\n')
    await Bun.write(join(root, 'main.ts'), 'import { helper } from "./helper"\nexport function main() { return helper() }\n')
    const result = await buildRepoMap({ root, maxTokens: 100 })
    expect(result.totalFileCount).toBe(2)
    expect(result.files[0].path).toBe('helper.ts')
    expect(result.map).toContain('helper')
    expect(result.tokenCount).toBeLessThanOrEqual(100)
  })
})

describe('AgentRouter', () => {
  test('selects an explicit route and keeps fallback order', () => {
    const router = new AgentRouter(profiles, [
      { kind: 'implementation', profile: 'coding', maxSteps: 80, fallbacks: ['quick'] },
    ])
    const route = router.route({ kind: 'implementation', maxSteps: 20 })
    expect(route.profile.name).toBe('coding')
    expect(route.maxSteps).toBe(20)
    expect(route.fallbacks.map(profile => profile.name)).toEqual(['quick'])
  })
})
