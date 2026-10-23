import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { migrate } from './migrate'
import { seedIfNeeded } from './seed'

let db: Database.Database | null = null

export function now(): string {
  return new Date().toISOString()
}

export function dbPath(): string {
  return join(app.getPath('userData'), 'clerkk.db')
}

export function initDatabase(): Database.Database {
  const file = dbPath()
  db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')
  migrate(db)
  seedIfNeeded(db)
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

export function reopenDatabase(): Database.Database {
  return initDatabase()
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database has not been initialized')
  return db
}

export function logActivity(action: string, details?: string): void {
  try {
    getDb()
      .prepare('INSERT INTO activity_log (action, details, created_at) VALUES (?, ?, ?)')
      .run(action, details ?? null, now())
  } catch {
    /* logging must never break a flow */
  }
}
