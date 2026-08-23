export function formatValueForError(value: unknown, maxLength = 500): string {
  let jsonStr: string
  try {
    jsonStr = JSON.stringify(value, null, 2) ?? 'undefined'
  } catch {
    jsonStr = '[unserializable value: circular structure]'
  }
  const truncated =
    jsonStr.length > maxLength
      ? jsonStr.slice(0, maxLength) + '...(truncated)'
      : jsonStr
  if (value === null || value === undefined || typeof value !== 'object') {
    return `${truncated} (type: ${value === null ? 'null' : typeof value})`
  }
  return truncated
}
