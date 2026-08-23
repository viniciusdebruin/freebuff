import {
  getAutoAcceptFollowups,
  getAutoAcceptFollowupsDelaySeconds,
  getAutoStartNextSession,
  saveSettings,
} from '../utils/settings'
import { getSystemMessage, getUserMessage } from '../utils/message-history'

import type { RouterParams } from './command-registry'

function clearInput(params: RouterParams): void {
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
}

function postConfig(params: RouterParams, message: string): void {
  params.setMessages((previous) => [
    ...previous,
    getUserMessage(params.inputValue.trim()),
    getSystemMessage(message),
  ])
  params.saveToHistory(params.inputValue.trim())
  clearInput(params)
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === 'on' || value === 'true' || value === '1') return true
  if (value === 'off' || value === 'false' || value === '0') return false
  return undefined
}

export function configHelp(): string {
  return [
    'Configuração do Freebuff',
    '',
    `/config auto-session on|off       ${getAutoStartNextSession() ? 'ON' : 'OFF'} — retoma se havia trabalho ativo`,
    `/config auto-followups on|off     ${getAutoAcceptFollowups() ? 'ON' : 'OFF'} — aceita as 3 sugestões sem clique`,
    `/config followup-delay <segundos> ${getAutoAcceptFollowupsDelaySeconds()}s — espera antes das 3 sugestões`,
    '',
    'A auto-session só roda se a sessão terminou durante trabalho ativo ou com sugestões pendentes. Ela não entra em loop depois de um chat finalizado e parado.',
  ].join('\n')
}

export function handleConfigCommand(params: RouterParams, args: string): void {
  const tokens = args.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const setting = tokens[0]
  const value = tokens[1]

  if (!setting) {
    postConfig(params, configHelp())
    return
  }

  if (setting === 'auto-session' || setting === 'session') {
    const parsed = parseBoolean(value)
    if (parsed === undefined) {
      postConfig(params, 'Uso: /config auto-session on|off')
      return
    }
    saveSettings({ autoStartNextSession: parsed })
    postConfig(
      params,
      `Auto-session ${parsed ? 'ativado' : 'desativado'}. ${parsed ? 'A retomada ocorrerá somente se havia trabalho ativo ou sugestões pendentes.' : ''}`.trim(),
    )
    return
  }

  if (
    setting === 'auto-followups' ||
    setting === 'followups' ||
    setting === 'suggestions'
  ) {
    const parsed = parseBoolean(value)
    if (parsed === undefined) {
      postConfig(params, 'Uso: /config auto-followups on|off')
      return
    }
    saveSettings({ autoAcceptFollowups: parsed })
    postConfig(
      params,
      `Aceite automático das 3 sugestões ${parsed ? 'ativado' : 'desativado'}.`,
    )
    return
  }

  if (
    setting === 'followup-delay' ||
    setting === 'suggestion-delay' ||
    setting === 'delay'
  ) {
    const seconds = Number(value)
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) {
      postConfig(params, 'Uso: /config followup-delay <segundos> (0 a 3600)')
      return
    }
    saveSettings({ autoAcceptFollowupsDelaySeconds: seconds })
    postConfig(params, `Atraso das 3 sugestões definido para ${seconds}s.`)
    return
  }

  postConfig(params, configHelp())
}
