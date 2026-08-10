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
