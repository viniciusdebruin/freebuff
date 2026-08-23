import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { promisify } from 'node:util'
import { extname, join, relative, resolve } from 'node:path'
import type { RepoMapFile, RepoMapOptions, RepoMapResult, RepoSymbol } from './types.js'

const execFileAsync = promisify(execFile)
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.rb'])
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', 'target', 'vendor'])
const SYMBOL_PATTERNS = [
  /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,
  /^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/,
  /^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/,
  /^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*[=<]/,
  /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/,
  /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/,
  /^\s*class\s+([A-Za-z_]\w*)\s*[:(]/,
]

async function walk(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) files.push(...await walk(root, join(directory, entry.name)))
      continue
    }
    if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(relative(root, join(directory, entry.name)))
    }
  }
  return files
}

async function listFiles(root: string): Promise<string[]> {
  try {
    const result = await execFileAsync('git', ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    return result.stdout
      .split('\0')
      .filter(file => file && SOURCE_EXTENSIONS.has(extname(file)))
  } catch {
    return walk(root)
  }
}

function symbolsFor(source: string): RepoSymbol[] {
  const symbols: RepoSymbol[] = []
  for (const [index, rawLine] of source.split('\n').entries()) {
    const line = rawLine.trimEnd()
    for (const pattern of SYMBOL_PATTERNS) {
      const match = line.match(pattern)
      if (match) {
        symbols.push({ name: match[1], line: index + 1, signature: line.trim() })
        break
      }
    }
  }
  return symbols
}

function importedPaths(source: string): string[] {
  const imports: string[] = []
  const pattern = /(?:from\s*['"]|import\s*['"]|require\(\s*['"])([^'"]+)/g
  for (const match of source.matchAll(pattern)) {
    if (match[1].startsWith('.')) imports.push(match[1])
  }
  return imports
}

function resolveImport(from: string, imported: string, files: Set<string>): string | undefined {
  const base = join(from, imported)
  const candidates = [base, ...Array.from(SOURCE_EXTENSIONS, extension => `${base}${extension}`), ...Array.from(SOURCE_EXTENSIONS, extension => join(base, `index${extension}`))]
  return candidates.find(candidate => files.has(candidate))
}

function approximateTokens(value: string): number {
  return Math.ceil(value.length / 4)
}

export async function buildRepoMap(options: RepoMapOptions): Promise<RepoMapResult> {
  const root = resolve(options.root)
  const discovered = (options.focusFiles?.length || 0) > 0 || options.root ? await listFiles(root) : []
  const files = [...new Set(discovered.map(file => file.replaceAll('\\', '/')))]
  const fileSet = new Set(files)
  const records = new Map<string, RepoMapFile>()
  const incoming = new Map<string, number>()

  for (const file of files) {
    const source = await readFile(join(root, file), 'utf8').catch(() => '')
    const symbols = symbolsFor(source)
    records.set(file, { path: file, symbols, score: 1 + symbols.length * 0.25 })
    const fromDir = file.slice(0, file.lastIndexOf('/'))
    for (const imported of importedPaths(source)) {
      const target = resolveImport(fromDir, imported, fileSet)
      if (target) incoming.set(target, (incoming.get(target) ?? 0) + 1)
    }
  }

  const focus = new Set(options.focusFiles?.map(file => file.replaceAll('\\', '/')) ?? [])
  const ranked = [...records.values()].map(file => ({
    ...file,
    score: file.score + (incoming.get(file.path) ?? 0) * 2 + (focus.has(file.path) ? 5 : 0),
  })).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))

  const maxTokens = options.maxTokens ?? 2500
  if (!Number.isInteger(maxTokens) || maxTokens < 1) throw new Error('maxTokens must be a positive integer')
  const sections: string[] = []
  let tokenCount = 0
  for (const file of ranked) {
    if (file.symbols.length === 0) continue
    const section = [
      `${file.path}:`,
      ...file.symbols.flatMap(symbol => ['⋮', `  ${symbol.signature}`]),
      '⋮',
    ].join('\n')
    const sectionTokens = approximateTokens(section)
    if (tokenCount + sectionTokens > maxTokens) continue
    sections.push(section)
    tokenCount += sectionTokens
  }

  return {
    map: sections.join('\n'),
    files: ranked,
    tokenCount,
    fileCount: sections.length,
    totalFileCount: files.length,
  }
}
