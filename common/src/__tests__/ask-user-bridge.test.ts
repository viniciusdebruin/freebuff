import { afterEach, describe, expect, test } from 'bun:test'

import { AskUserBridge } from '../utils/ask-user-bridge'

const singleSelectQuestion = {
  question: 'Which option should be used?',
  options: [{ label: 'Option A' }, { label: 'Option B' }],
  multiSelect: false,
}

const multiSelectQuestion = {
  question: 'Which checks should run?',
  options: [{ label: 'Typecheck' }, { label: 'Tests' }, { label: 'Lint' }],
  multiSelect: true,
}

describe('AskUserBridge automatic resolution', () => {
  afterEach(() => {
    AskUserBridge.submit({ skipped: true })
  })

  test('does not leave a single-select decision pending after its timeout', async () => {
    const response = await AskUserBridge.request(
      'single-timeout',
      [singleSelectQuestion],
      { timeoutMs: 5 },
    )

    expect(response).toEqual({ skipped: true })
    expect(AskUserBridge.getPendingRequest()).toBeNull()
  })

  test('selects every option in a multi-select decision on timeout', async () => {
    const response = await AskUserBridge.request(
      'multi-timeout',
      [multiSelectQuestion],
      { timeoutMs: 5 },
    )

    expect(response).toEqual({
      answers: [
        {
          questionIndex: 0,
          selectedOptions: ['Typecheck', 'Tests', 'Lint'],
        },
      ],
    })
  })

  test('manual answers win and cancel the timeout', async () => {
    const pending = AskUserBridge.request(
      'manual-answer',
      [singleSelectQuestion],
      { timeoutMs: 20 },
    )
    AskUserBridge.submit({
      answers: [{ questionIndex: 0, selectedOption: 'Option B' }],
    })

    await expect(pending).resolves.toEqual({
      answers: [{ questionIndex: 0, selectedOption: 'Option B' }],
    })
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(AskUserBridge.getPendingRequest()).toBeNull()
  })
})
