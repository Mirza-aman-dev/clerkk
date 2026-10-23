import { getDb, now } from './index'
import { Category } from '../../shared/types'

export function listCategories(): Category[] {
  return getDb().prepare('SELECT * FROM categories ORDER BY name COLLATE NOCASE').all() as Category[]
}

export function createCategory(name: string): Category {
  const db = getDb()
  const trimmed = name.trim()
  const existing = db
    .prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE')
    .get(trimmed) as { id: number } | undefined
  if (existing) {
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(existing.id) as Category
  }
  const info = db.prepare('INSERT INTO categories (name, created_at) VALUES (?, ?)').run(trimmed, now())
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid) as Category
}

export function deleteCategory(id: number): void {
  getDb().prepare('DELETE FROM categories WHERE id = ?').run(id)
}
