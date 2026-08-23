export function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? 'undefined'
  } catch {
    return '[unserializable value: circular structure]'
  }
}

export function formatValueForError(value: unknown, maxLength = 500): string {
  const jsonStr = safeJsonStringify(value)
  const truncated =
    jsonStr.length > maxLength
      ? jsonStr.slice(0, maxLength) + '...(truncated)'
      : jsonStr
  if (value === null || value === undefined || typeof value !== 'object') {
    return `${truncated} (type: ${value === null ? 'null' : typeof value})`
  }
  return truncated
}
