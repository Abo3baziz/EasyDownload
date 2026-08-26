const WINDOWS_ILLEGAL_CHARACTERS = /[<>:"|?*\\/\u0000-\u001f]/g
const WINDOWS_TRAILING_CHARACTERS = /[. ]+$/g

export function sanitizeFilename(value: string): string {
  return value.replace(WINDOWS_ILLEGAL_CHARACTERS, '_').replace(WINDOWS_TRAILING_CHARACTERS, '')
}
