import type { AppError } from '../../shared/types/errors'

export function ErrorAlert({ error }: { error: AppError }) {
  const detail =
    typeof error.details === 'string' && error.details !== error.message
      ? error.details
      : undefined
  return (
    <div className='alert' role='alert'>
      <strong>{error.code}</strong> {error.message}
      {detail && <span className='alert-detail'> — {detail}</span>}
    </div>
  )
}
