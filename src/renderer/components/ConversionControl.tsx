import { useState } from 'react'
import type { Conversion, ConversionStartOptions } from '../../shared/types/conversion'
import { formatDuration } from '../../shared/utils/format'

const CONVERSION_OPTIONS: readonly { label: string; options: Omit<ConversionStartOptions, 'input'> }[] = [
  {
    label: 'MP4 video (H.264)',
    options: { type: 'convert', videoCodec: 'h264', audioCodec: 'copy' }
  },
  {
    label: 'MP3 audio',
    options: { type: 'extractAudio', audioCodec: 'mp3' }
  },
  {
    label: 'AAC audio',
    options: { type: 'extractAudio', audioCodec: 'aac' }
  },
  {
    label: 'Opus audio',
    options: { type: 'extractAudio', audioCodec: 'opus' }
  },
  {
    label: 'FLAC audio',
    options: { type: 'extractAudio', audioCodec: 'flac' }
  }
]

interface ConversionControlProps {
  conversion?: Conversion
  disabled?: boolean
  onStart: (options: Omit<ConversionStartOptions, 'input'>) => void
  onCancel: (id: string) => void
}

export function ConversionControl({ conversion, disabled, onStart, onCancel }: ConversionControlProps) {
  const [selected, setSelected] = useState(0)

  if (conversion?.status === 'running') {
    const processedSeconds = Math.round(conversion.progress.processedMs / 1000)
    return (
      <div className="conversion-control">
        <span className="progress-label">
          Converting…{processedSeconds > 0 ? ` · ${formatDuration(processedSeconds)}` : ''}
        </span>
        <button type="button" className="btn" onClick={() => onCancel(conversion.id)}>
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="conversion-control">
      {conversion && (
        <div className="conversion-result">
          {conversion.status === 'failed' && (
            <span className="download-error">
              {conversion.error?.code}: {conversion.error?.message}
            </span>
          )}
          {conversion.status === 'cancelled' && (
            <span className="download-meta">Conversion cancelled.</span>
          )}
        </div>
      )}
      <div className="conversion-form">
        <select
          aria-label="Conversion format"
          value={selected}
          onChange={(event) => setSelected(Number(event.target.value))}
        >
          {CONVERSION_OPTIONS.map((option, index) => (
            <option key={option.label} value={index}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn"
          disabled={disabled}
          onClick={() => onStart(CONVERSION_OPTIONS[selected]!.options)}
        >
          {disabled ? 'Starting…' : 'Convert'}
        </button>
      </div>
    </div>
  )
}
