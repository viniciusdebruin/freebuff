import { afterEach, describe, expect, test } from 'bun:test'

import { configureAiSdkWarningLogging } from '../ai-sdk-warnings'

const warningGlobals = globalThis as {
  AI_SDK_LOG_WARNINGS?: false | (() => void)
}

const originalMode = process.env.FREEBUFF_MODE
const originalLogger = warningGlobals.AI_SDK_LOG_WARNINGS

afterEach(() => {
  if (originalMode === undefined) {
    delete process.env.FREEBUFF_MODE
  } else {
    process.env.FREEBUFF_MODE = originalMode
  }

  if (originalLogger === undefined) {
    delete warningGlobals.AI_SDK_LOG_WARNINGS
  } else {
    warningGlobals.AI_SDK_LOG_WARNINGS = originalLogger
  }
})

describe('AI SDK warning configuration', () => {
  test('disables only AI SDK warning logging in Freebuff', () => {
    process.env.FREEBUFF_MODE = 'true'

    configureAiSdkWarningLogging()

    expect(warningGlobals.AI_SDK_LOG_WARNINGS).toBe(false)
  })

  test('does not change warning logging for Codebuff', () => {
    const logger = () => undefined
    process.env.FREEBUFF_MODE = 'false'
    warningGlobals.AI_SDK_LOG_WARNINGS = logger

    configureAiSdkWarningLogging()

    expect(warningGlobals.AI_SDK_LOG_WARNINGS).toBe(logger)
  })
})
