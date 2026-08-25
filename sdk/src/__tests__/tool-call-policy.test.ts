import { describe, expect, test } from 'bun:test'

import { createReadOnlyToolCallPolicy } from '../tool-call-policy'

const context = (toolName: string, input: Record<string, unknown> = {}) => ({
  requestId: 'request-1',
  userInputId: 'input-1',
  toolName,
  input,
  isMcpTool: false,
})

describe('createReadOnlyToolCallPolicy', () => {
  test('allows inspection and reversible proposal tools', () => {
    const policy = createReadOnlyToolCallPolicy()

    expect(policy(context('read_files'))).toEqual({
      action: 'allow',
    })
    expect(policy(context('propose_write_file'))).toEqual({
      action: 'allow',
    })
  })

  test('denies file writes and terminal commands', () => {
    const policy = createReadOnlyToolCallPolicy()

    expect(policy(context('write_file'))).toMatchObject({
      action: 'deny',
    })
    expect(policy(context('run_terminal_command'))).toMatchObject({
      action: 'deny',
    })
  })

  test('allows only known read-only subagents', () => {
    const policy = createReadOnlyToolCallPolicy()

    expect(
      policy(context('spawn_agent_inline', { agent_type: 'code-searcher' })),
    ).toEqual({ action: 'allow' })
    expect(
      policy(context('spawn_agent_inline', { agent_type: 'editor' })),
    ).toMatchObject({ action: 'deny' })
  })

  test('denies MCP tools by default', () => {
    const policy = createReadOnlyToolCallPolicy()

    expect(
      policy({ ...context('external_tool'), isMcpTool: true }),
    ).toMatchObject({ action: 'deny' })
  })
})
