import { useEffect, useState } from 'react'
import type { AppError } from '../../shared/types/errors'
import type { AppSettings } from '../../shared/types/settings'
import { DEFAULT_SETTINGS } from '../../shared/constants/defaults'
import { useMediaDownloader } from '../hooks/useMediaDownloader'

export function SettingsPage() {
  const api = useMediaDownloader()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loadError, setLoadError] = useState<AppError | null>(null)
  const [saveError, setSaveError] = useState<AppError | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = await api.getSettings()
        if (cancelled) return
        if (result.ok) {
          setSettings(result.data)
        } else {
          setLoadError(result.error)
        }
      } catch (err) {
        if (cancelled) return
        setLoadError({
          code: 'UnknownError',
          message: err instanceof Error ? err.message : String(err)
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [api])

  async function handleChooseDirectory() {
    const result = await api.selectDirectory()
    if (result.ok && result.data) {
      setSettings((current) => (current ? { ...current, downloadDirectory: result.data! } : current))
    }
  }

  async function handleSave() {
    if (!settings) return
    setBusy(true)
    setSaved(false)
    setSaveError(null)
    try {
      const result = await api.updateSettings(settings)
      if (result.ok) {
        setSettings(result.data)
        setSaved(true)
      } else {
        setSaveError(result.error)
      }
    } catch (err) {
      setSaveError({
        code: 'UnknownError',
        message: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setBusy(false)
    }
  }

  if (loadError) {
    return (
      <section className="page">
        <h1>Settings</h1>
        <div className="alert" role="alert">
          <strong>{loadError.code}</strong> {loadError.message}
        </div>
      </section>
    )
  }

  if (!settings) {
    return (
      <section className="page">
        <h1>Settings</h1>
        <p>Loading…</p>
      </section>
    )
  }

  return (
    <section className="page">
      <h1>Settings</h1>
      {saveError && (
        <div className="alert" role="alert">
          <strong>{saveError.code}</strong> {saveError.message}
        </div>
      )}
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSave()
        }}
      >
        <label className="field">
          <span>Download directory</span>
          <div className="directory-row">
            <input
              type="text"
              value={settings.downloadDirectory}
              readOnly
              aria-label="Download directory"
            />
            <button type="button" onClick={() => void handleChooseDirectory()}>
              Choose…
            </button>
          </div>
        </label>

        <label className="field checkbox">
          <input
            type="checkbox"
            checked={settings.notificationsEnabled}
            onChange={(event) =>
              setSettings({ ...settings, notificationsEnabled: event.target.checked })
            }
          />
          <span>Enable desktop notifications</span>
        </label>

        <label className="field">
          <span>Concurrent downloads</span>
          <input
            type="number"
            min={1}
            max={DEFAULT_SETTINGS.maxConcurrencyLimit}
            value={settings.concurrencyLimit}
            onChange={(event) =>
              setSettings({ ...settings, concurrencyLimit: Number(event.target.value) })
            }
          />
        </label>

        <div className="settings-actions">
          <button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </button>
          {saved && <span className="saved-note">Settings saved.</span>}
        </div>
      </form>
    </section>
  )
}
