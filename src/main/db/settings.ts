import { getDb } from './index'
import { AppSettings, DEFAULT_SETTINGS } from '../../shared/types'

export function getSettings(): AppSettings {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as {
    key: string
    value: string
  }[]
  const out: AppSettings = { ...DEFAULT_SETTINGS }
  for (const r of rows) {
    try {
      ;(out as unknown as Record<string, unknown>)[r.key] = JSON.parse(r.value)
    } catch {
      /* ignore malformed value */
    }
  }
  return out
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const db = getDb()
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(partial)) {
      if (v === undefined) continue
      upsert.run(k, JSON.stringify(v))
    }
  })
  tx()
  return getSettings()
}

export function getSetting<T>(key: string, fallback: T): T {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  if (!row) return fallback
  try {
    return JSON.parse(row.value) as T
  } catch {
    return fallback
  }
}

export function setSetting(key: string, value: unknown): void {
  getDb()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value))
}
