import { describe, expect, test } from 'bun:test'

import { getClientEnvValue } from '../env-schema'

describe('CLI public environment defaults', () => {
  test('uses the default only for the standalone CLI runtime', () => {
    const previousBinary = process.env.CODEBUFF_IS_BINARY
    const previousFreebuff = process.env.FREEBUFF_MODE

    process.env.CODEBUFF_IS_BINARY = 'true'
    delete process.env.FREEBUFF_MODE

    expect(
      getClientEnvValue(undefined, 'NEXT_PUBLIC_CODEBUFF_APP_URL'),
    ).toBe('https://www.codebuff.com')

    if (previousBinary === undefined) delete process.env.CODEBUFF_IS_BINARY
    else process.env.CODEBUFF_IS_BINARY = previousBinary
    if (previousFreebuff === undefined) delete process.env.FREEBUFF_MODE
    else process.env.FREEBUFF_MODE = previousFreebuff
  })

  test('keeps the web configuration strict outside the CLI runtime', () => {
    const previousBinary = process.env.CODEBUFF_IS_BINARY
    const previousFreebuff = process.env.FREEBUFF_MODE

    delete process.env.CODEBUFF_IS_BINARY
    delete process.env.FREEBUFF_MODE

    expect(
      getClientEnvValue(undefined, 'NEXT_PUBLIC_CODEBUFF_APP_URL'),
    ).toBeUndefined()

    if (previousBinary === undefined) delete process.env.CODEBUFF_IS_BINARY
    else process.env.CODEBUFF_IS_BINARY = previousBinary
    if (previousFreebuff === undefined) delete process.env.FREEBUFF_MODE
    else process.env.FREEBUFF_MODE = previousFreebuff
  })
})
