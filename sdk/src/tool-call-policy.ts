export type ToolCallPolicyContext = {
  requestId: string
  userInputId: string
  toolName: string
  input: Record<string, unknown>
  isMcpTool: boolean
}

export type ToolCallPolicyDecision = {
  action: 'allow' | 'deny'
  reason?: string
}

export type ToolCallPolicy = (
  context: ToolCallPolicyContext,
) => ToolCallPolicyDecision | Promise<ToolCallPolicyDecision>

const READ_ONLY_TOOLS = new Set([
  'ask_user',
  'code_search',
  'end_turn',
  'find_files',
  'glob',
  'gravity_index',
  'list_directory',
  'lookup_agent_info',
  'read_docs',
  'read_files',
  'read_subtree',
  'read_url',
  'render_ui',
  'set_messages',
  'set_output',
  'skill',
  'suggest_followups',
  'think_deeply',
  'web_search',
  // These tools only build an in-memory proposal; they do not write to disk.
  'propose_str_replace',
  'propose_write_file',
])

const READ_ONLY_SUBAGENTS = new Set([
  'code-reviewer',
  'code-searcher',
  'context-pruner',
  'file-picker',
  'general',
  'researcher-docs',
  'researcher-web',
  'thinker',
  'thinker-gpt',
])

function canSpawnReadOnlySubagents(input: Record<string, unknown>): boolean {
  if (Array.isArray(input.agents)) {
    return input.agents.every((agent) => {
      if (!agent || typeof agent !== 'object') return false
      const agentType = (agent as { agent_type?: unknown }).agent_type
      return typeof agentType === 'string' && READ_ONLY_SUBAGENTS.has(agentType)
    })
  }

  const agentType = input.agent_type
  return typeof agentType === 'string' && READ_ONLY_SUBAGENTS.has(agentType)
}

export function createReadOnlyToolCallPolicy(): ToolCallPolicy {
  return ({ toolName, input, isMcpTool }) => {
    if (isMcpTool) {
      return {
        action: 'deny',
        reason: 'Plan mode does not execute MCP tools.',
      }
    }

    if (
      (toolName === 'spawn_agents' || toolName === 'spawn_agent_inline') &&
      canSpawnReadOnlySubagents(input)
    ) {
      return { action: 'allow' }
    }

    if (READ_ONLY_TOOLS.has(toolName)) {
      return { action: 'allow' }
    }

    return {
      action: 'deny',
      reason: `Plan mode is read-only; tool "${toolName}" is not available.`,
    }
  }
}
