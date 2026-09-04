export function fieldLabel(key: string): string {
  return key.replaceAll('_', ' ')
}

export function fieldValue(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(String).join(', ')
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}