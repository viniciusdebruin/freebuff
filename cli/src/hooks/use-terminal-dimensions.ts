import { useRenderer } from '@opentui/react'
import { useMemo, useSyncExternalStore } from 'react'

type TerminalDimensions = {
  width: number
  height: number
}

type ResizeRenderer = {
  width: number
  height: number
  on: (event: 'resize', listener: () => void) => unknown
  off: (event: 'resize', listener: () => void) => unknown
}

type TerminalDimensionsStore = {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => TerminalDimensions
}

/**
 * Every component needs terminal dimensions, but OpenTUI's hook installs one
 * `resize` listener per component. The chat screen has more than ten such
 * consumers, which triggers Node's MaxListenersExceededWarning and makes
 * resize-heavy sessions increasingly fragile. Share one listener per renderer
 * and fan out updates to the React subscribers instead.
 */
const dimensionsStores = new WeakMap<object, TerminalDimensionsStore>()

const sanitizeDimension = (value: number | null | undefined): number | null => {
  if (typeof value !== 'number') return null
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

const readTerminalDimensions = (
  renderer: ResizeRenderer,
): TerminalDimensions => ({
  width: sanitizeDimension(renderer.width) ?? 80,
  height: sanitizeDimension(renderer.height) ?? 24,
})

const getTerminalDimensionsStore = (
  renderer: ResizeRenderer,
): TerminalDimensionsStore => {
  const existingStore = dimensionsStores.get(renderer)
  if (existingStore) return existingStore

  let snapshot = readTerminalDimensions(renderer)
  const listeners = new Set<() => void>()

  const handleResize = () => {
    const nextSnapshot = readTerminalDimensions(renderer)
    if (
      nextSnapshot.width === snapshot.width &&
      nextSnapshot.height === snapshot.height
    ) {
      return
    }

    snapshot = nextSnapshot
    for (const listener of listeners) {
      listener()
    }
  }

  const store: TerminalDimensionsStore = {
    subscribe: (listener) => {
      listeners.add(listener)
      if (listeners.size === 1) {
        renderer.on('resize', handleResize)
      }

      return () => {
        if (!listeners.delete(listener)) return
        if (listeners.size === 0) {
          renderer.off('resize', handleResize)
        }
      }
    },
    getSnapshot: () => snapshot,
  }

  dimensionsStores.set(renderer, store)
  return store
}

export const useTerminalDimensions = () => {
  const renderer = useRenderer() as ResizeRenderer
  const dimensionsStore = useMemo(
    () => getTerminalDimensionsStore(renderer),
    [renderer],
  )
  const { width: measuredWidth, height: measuredHeight } = useSyncExternalStore(
    dimensionsStore.subscribe,
    dimensionsStore.getSnapshot,
    dimensionsStore.getSnapshot,
  )

  const resolvedTerminalWidth = useMemo(
    () =>
      sanitizeDimension(measuredWidth) ??
      sanitizeDimension(renderer.width) ??
      80,
    [measuredWidth, renderer.width],
  )

  const resolvedTerminalHeight = useMemo(
    () =>
      sanitizeDimension(measuredHeight) ??
      sanitizeDimension(renderer.height) ??
      24,
    [measuredHeight, renderer.height],
  )

  const terminalWidth = resolvedTerminalWidth
  const terminalHeight = resolvedTerminalHeight
  const separatorWidth = useMemo(
    () => Math.max(1, Math.floor(terminalWidth) - 2),
    [terminalWidth],
  )

  const contentMaxWidth = useMemo(
    () => Math.max(10, Math.min(terminalWidth - 4, 80)),
    [terminalWidth],
  )

  return {
    terminalWidth,
    terminalHeight,
    separatorWidth,
    contentMaxWidth,
  }
}
