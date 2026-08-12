const SUPPORTED_PROTOCOLS = ['http:', 'https:']

export function isValidMediaUrl(value: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return false
  }
  return SUPPORTED_PROTOCOLS.includes(parsed.protocol)
}

export function normalizeUrl(value: string): string {
  const trimmed = value.trim()
  try {
    return new URL(trimmed).toString()
  } catch {
    return trimmed
  }
}
