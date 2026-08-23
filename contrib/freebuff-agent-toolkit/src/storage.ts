import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

export function resolveConfigRoot(env: NodeJS.ProcessEnv = process.env): string {
  const root = env.FREEBUFF_AGENT_TOOLKIT_HOME?.trim()
  if (root) return root

  const configHome = env.XDG_CONFIG_HOME?.trim() || join(homedir(), '.config')
  return join(configHome, 'freebuff', 'agent-toolkit')
}

export function resolveStateRoot(env: NodeJS.ProcessEnv = process.env): string {
  const root = env.FREEBUFF_AGENT_TOOLKIT_HOME?.trim()
  if (root) return join(root, 'state')

  const stateHome = env.XDG_STATE_HOME?.trim() || join(homedir(), '.local', 'state')
  return join(stateHome, 'freebuff', 'agent-toolkit')
}

export async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 })
  await chmod(path, 0o700)
}

export async function writeJsonAtomic(
  filePath: string,
  value: unknown,
): Promise<void> {
  await ensureDirectory(dirname(filePath))
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`
  const contents = `${JSON.stringify(value, null, 2)}\n`

  try {
    await writeFile(temporaryPath, contents, { encoding: 'utf8', mode: 0o600 })
    await chmod(temporaryPath, 0o600)
    await rename(temporaryPath, filePath)
    await chmod(filePath, 0o600)
  } catch (error) {
    try {
      await Bun.file(temporaryPath).delete()
    } catch {
      // The original error is more useful than cleanup failures.
    }
    throw error
  }
}

export async function readJson(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as unknown
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}
