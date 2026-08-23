import { getInitialSessionState } from '@codebuff/common/types/session-state'
import { getStubProjectFileContext } from '@codebuff/common/util/file'
import { describe, expect, it } from 'bun:test'

import {
  applyOverridesToSessionState,
  withMessageHistory,
} from '../run-state'

describe('run-state cloning', () => {
  it('resumes a session containing cyclic tool schemas', async () => {
    const state = getInitialSessionState(getStubProjectFileContext())
    const recursiveSchema: Record<string, unknown> = {}
    recursiveSchema.self = recursiveSchema
    state.mainAgentState.toolDefinitions = {
      gravity_index: {
        description: undefined,
        inputSchema: recursiveSchema,
      },
    }

    const resumed = await applyOverridesToSessionState(undefined, state, {
      maxAgentSteps: 12,
    })

    expect(resumed).not.toBe(state)
    expect(resumed.mainAgentState).not.toBe(state.mainAgentState)
    expect(resumed.mainAgentState.stepsRemaining).toBe(12)
    expect(resumed.mainAgentState.toolDefinitions.gravity_index.inputSchema).not.toBe(
      state.mainAgentState.toolDefinitions.gravity_index.inputSchema,
    )
    const clonedSchema = resumed.mainAgentState.toolDefinitions.gravity_index
      .inputSchema as { self: unknown }
    expect(clonedSchema.self).toBe(clonedSchema)
  })

  it('replays message history without JSON serialization', () => {
    const state = getInitialSessionState(getStubProjectFileContext())
    const recursiveSchema: Record<string, unknown> = {}
    recursiveSchema.self = recursiveSchema
    ;(state.mainAgentState.toolDefinitions as any).tool = {
      description: undefined,
      inputSchema: recursiveSchema,
    }

    const replayed = withMessageHistory({ runState: { sessionState: state, output: { type: 'lastMessage', value: [] }, traceSessionId: 'trace' }, messages: [] })

    expect(replayed).not.toBe(state)
    expect(replayed.sessionState?.mainAgentState.toolDefinitions.tool.inputSchema).not.toBe(
      recursiveSchema,
    )
  })
})
