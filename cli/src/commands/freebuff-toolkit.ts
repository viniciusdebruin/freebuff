import {
  AgentRouter,
  BackgroundSessionStore,
  ProfileStore,
  buildRepoMap,
  createDefaultRules,
} from '../../../contrib/freebuff-agent-toolkit/src/index.js'

import { getProjectRoot } from '../project-files'
import { getSystemMessage, getUserMessage } from '../utils/message-history'

import type { RouterParams } from './command-registry'

const MAX_DISPLAYED_MAP_CHARS = 18_000
const MAX_DISPLAYED_LOG_CHARS = 16_000

function clearInput(params: RouterParams): void {
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
}

function postResult(params: RouterParams, text: string): void {
  params.setMessages((previous) => [
    ...previous,
    getUserMessage(params.inputValue.trim()),
    getSystemMessage(text),
  ])
  params.saveToHistory(params.inputValue.trim())
  clearInput(params)
}

function parseArgs(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | undefined
  let escaped = false

  for (const character of input.trim()) {
    if (escaped) {
      current += character
      escaped = false
    } else if (character === '\\') {
      escaped = true
    } else if (quote) {
      if (character === quote) quote = undefined
      else current += character
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (/\s/.test(character)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
    } else {
      current += character
    }
  }

  if (escaped) current += '\\'
  if (current) tokens.push(current)
  return tokens
}

function formatProfiles(store: ProfileStore): Promise<string> {
  return store.load().then((document) => {
    const profiles = Object.values(document.profiles).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
    if (profiles.length === 0) {
      return [
        'Nenhum perfil configurado.',
        `Arquivo: ${store.filePath}`,
        '',
        'Exemplo:',
        '/profiles add coding https://seu-endpoint/v1 seu-modelo FREEBUFF_CODING_KEY 80',
      ].join('\n')
    }

    return [
      `Perfis configurados${document.active ? ` (ativo: ${document.active})` : ''}:`,
      ...profiles.map(
        (profile) =>
          `- ${profile.name}${profile.name === document.active ? ' *' : ''} | model=${profile.model} | steps=${profile.maxSteps ?? 40} | key=${profile.apiKeyEnv} | ${profile.baseUrl}`,
      ),
      '',
      'Roteamento: /profiles route quick|implementation|review|research [perfil] [maxSteps]',
    ].join('\n')
  })
}

async function handleProfiles(params: RouterParams, args: string): Promise<void> {
  const store = new ProfileStore()
  const tokens = parseArgs(args)
  const action = tokens[0]?.toLowerCase() ?? 'list'

  if (action === 'list') {
    postResult(params, await formatProfiles(store))
    return
  }

  if (action === 'add') {
    const [name, baseUrl, model, apiKeyEnv, maxStepsText] = tokens.slice(1)
    if (!name || !baseUrl || !model || !apiKeyEnv) {
      postResult(
        params,
        'Uso: /profiles add <nome> <base-url> <modelo> <ENV_DA_CHAVE> [maxSteps]',
      )
      return
    }
    const maxSteps = maxStepsText === undefined ? undefined : Number(maxStepsText)
    await store.save({ name, baseUrl, model, apiKeyEnv, maxSteps })
    postResult(
      params,
      `Perfil '${name}' salvo. A chave continua somente em $${apiKeyEnv}; o arquivo não armazena segredo.`,
    )
    return
  }

  if (action === 'use') {
    const name = tokens[1]
    if (!name) {
      postResult(params, 'Uso: /profiles use <nome>')
      return
    }
    await store.setActive(name)
    postResult(params, `Perfil ativo: ${name}`)
    return
  }

  if (action === 'remove') {
    const name = tokens[1]
    if (!name) {
      postResult(params, 'Uso: /profiles remove <nome>')
      return
    }
    const removed = await store.remove(name)
    postResult(params, removed ? `Perfil removido: ${name}` : `Perfil não encontrado: ${name}`)
    return
  }

  if (action === 'route') {
    const kind = tokens[1] as 'quick' | 'implementation' | 'review' | 'research' | undefined
    if (!kind || !['quick', 'implementation', 'review', 'research'].includes(kind)) {
      postResult(params, 'Uso: /profiles route quick|implementation|review|research [perfil] [maxSteps]')
      return
    }
    const document = await store.load()
    const profiles = Object.values(document.profiles)
    if (profiles.length === 0) {
      postResult(params, 'Configure pelo menos um perfil antes de rotear tarefas.')
      return
    }
    const router = new AgentRouter(profiles, createDefaultRules(profiles))
    const maxSteps = tokens[3] === undefined ? undefined : Number(tokens[3])
    const route = router.route({ kind, preferredProfile: tokens[2], maxSteps })
    postResult(
      params,
      [
        `Rota ${kind}: ${route.profile.name}`,
        `modelo=${route.profile.model}`,
        `maxSteps=${route.maxSteps}`,
        `fallbacks=${route.fallbacks.map((profile) => profile.name).join(', ') || 'nenhum'}`,
      ].join('\n'),
    )
    return
  }

  postResult(params, 'Uso: /profiles | add | use | remove | route')
}

async function handleRepoMap(params: RouterParams, args: string): Promise<void> {
  const tokens = parseArgs(args)
  let maxTokens = 2500
  const focusFiles: string[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token === '--tokens' || token === '-t') {
      const value = tokens[index + 1]
      if (!value) {
        postResult(params, 'Uso: /repo-map [--tokens N] [arquivos para priorizar]')
        return
      }
      maxTokens = Number(value)
      index += 1
    } else if (token.startsWith('--tokens=')) {
      maxTokens = Number(token.slice('--tokens='.length))
    } else {
      focusFiles.push(token)
    }
  }

  const result = await buildRepoMap({
    root: getProjectRoot(),
    maxTokens,
    focusFiles,
  })
  const map = result.map || '(Nenhum símbolo encontrado nos arquivos rastreados.)'
  const displayedMap = map.length > MAX_DISPLAYED_MAP_CHARS
    ? `${map.slice(0, MAX_DISPLAYED_MAP_CHARS)}\n… (mapa truncado na tela; orçamento preservado)`
    : map
  postResult(
    params,
    [
      `Mapa do repositório: ${result.fileCount}/${result.totalFileCount} arquivos | ~${result.tokenCount} tokens`,
      '',
      displayedMap,
    ].join('\n'),
  )
}

async function handleBackground(params: RouterParams, args: string): Promise<void> {
  const tokens = parseArgs(args)
  const action = tokens[0]?.toLowerCase() ?? 'list'
  const store = new BackgroundSessionStore()

  if (action === 'list') {
    const sessions = await store.list()
    postResult(
      params,
      sessions.length === 0
        ? 'Nenhuma sessão em background.'
        : sessions
            .map((session) => `${session.id} | ${session.status} | ${session.command.join(' ')} | pid=${session.pid}`)
            .join('\n'),
    )
    return
  }

  if (action === 'start') {
    const [command, ...commandArgs] = tokens.slice(1)
    if (!command) {
      postResult(params, 'Uso: /background start <comando> [argumentos...]')
      return
    }
    const session = await store.start(command, commandArgs, { cwd: getProjectRoot() })
    postResult(params, `Sessão iniciada: ${session.id}\npid=${session.pid}\nlog=${session.logPath}`)
    return
  }

  if (action === 'stop') {
    const id = tokens[1]
    if (!id) {
      postResult(params, 'Uso: /background stop <id>')
      return
    }
    const session = await store.stop(id)
    postResult(params, `Sessão ${session.id}: ${session.status}`)
    return
  }

  if (action === 'logs') {
    const id = tokens[1]
    if (!id) {
      postResult(params, 'Uso: /background logs <id>')
      return
    }
    const log = await store.readLog(id, MAX_DISPLAYED_LOG_CHARS)
    postResult(params, log || '(log vazio)')
    return
  }

  postResult(params, 'Uso: /background | start | stop | logs')
}

async function runSafely(
  params: RouterParams,
  operation: () => Promise<void>,
): Promise<void> {
  try {
    await operation()
  } catch (error) {
    postResult(
      params,
      `Toolkit: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export function handleFreebuffToolkitCommand(
  params: RouterParams,
  args: string,
): Promise<void> {
  return runSafely(params, async () => {
    const tokens = parseArgs(args)
    const action = tokens[0]?.toLowerCase() ?? 'help'

    if (action === 'map' || action === 'repo-map') {
      await handleRepoMap(params, tokens.slice(1).join(' '))
    } else if (action === 'profiles' || action === 'profile' || action === 'route') {
      await handleProfiles(params, action === 'route' ? `route ${tokens.slice(1).join(' ')}` : tokens.slice(1).join(' '))
    } else if (action === 'background' || action === 'sessions') {
      await handleBackground(params, tokens.slice(1).join(' '))
    } else {
      postResult(
        params,
        [
          'Freebuff Agent Toolkit',
          '/toolkit map [--tokens N] [arquivos] — mapa priorizado do repositório',
          '/toolkit profiles list|add|use|remove|route — perfis e roteamento',
          '/toolkit background list|start|stop|logs — sessões duráveis sem shell',
          '',
          'Atalhos: /repo-map, /profiles e /background',
        ].join('\n'),
      )
    }
  })
}

export { handleBackground, handleProfiles, handleRepoMap, parseArgs }
