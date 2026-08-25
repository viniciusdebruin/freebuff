import { createTestRenderer } from '@opentui/core/testing'
import { createRoot, flushSync } from '@opentui/react'
import { afterEach, describe, expect, test } from 'bun:test'
import React from 'react'

import { useTerminalDimensions } from '../use-terminal-dimensions'

describe('useTerminalDimensions', () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  test('shares one resize listener across multiple consumers', async () => {
    let observed: Array<number> = []
    const Harness = () => {
      const first = useTerminalDimensions()
      const second = useTerminalDimensions()
      observed = [first.terminalWidth, second.terminalWidth]
      return <text>{observed.join(',')}</text>
    }

    const setup = await createTestRenderer({ width: 80, height: 24 })
    const baselineListenerCount = setup.renderer.listenerCount('resize')
    const root = createRoot(setup.renderer)
    flushSync(() => root.render(<Harness />))
    await setup.renderOnce()
    cleanup = () => {
      flushSync(() => root.unmount())
      setup.renderer.destroy()
    }

    expect(setup.renderer.listenerCount('resize')).toBe(
      baselineListenerCount + 1,
    )
    expect(observed).toEqual([80, 80])

    setup.renderer.resize(120, 30)
    await setup.renderOnce()
    expect(observed).toEqual([120, 120])

    flushSync(() => root.unmount())
    expect(setup.renderer.listenerCount('resize')).toBe(baselineListenerCount)
  })
})
