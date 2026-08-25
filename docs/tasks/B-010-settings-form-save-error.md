# B-010: SettingsPage save failure destroys form UI

- **Status:** Done
- **Priority:** High
- **Category:** Bug
- **Branch:** `bugfix/settings-form-save-error`

## Source

- `src/renderer/pages/SettingsPage.tsx:67-76` — early return renders only the alert
- `src/renderer/pages/SettingsPage.tsx:55,58` — save failures set the same `error` state as load failure

## Problem

The early return `if (error)` was designed for load errors, but `error` is also set by `handleSave()` failures and `updateSettings` catch. A failed save makes the whole settings form disappear, discarding in-progress edits until the user navigates away and back.

## Fix

- Split into `loadError` and `saveError` state.
- Render load error full-page; render save error as an inline alert above the intact form.
- Keep form values in local state so failed saves don't lose edits.

## Acceptance Criteria

- [ ] Failed save shows an alert while preserving the form and its current values.
- [ ] Genuine load failure still shows the full-page error.
- [ ] Renderer test covering both paths.
