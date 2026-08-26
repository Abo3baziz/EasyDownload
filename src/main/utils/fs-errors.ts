export function isMissingFileError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as NodeJS.ErrnoException).code === 'ENOENT'
}

export function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
