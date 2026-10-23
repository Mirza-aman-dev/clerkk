import { getDb } from './index'
import { getSettings, setSetting } from './settings'
import { seedIfNeeded } from './seed'

export function clearAllData(): void {
  const db = getDb()
  const theme = getSettings().theme
  db.transaction(() => {
    db.exec(`
      DELETE FROM sale_items;
      DELETE FROM sales;
      DELETE FROM products;
      DELETE FROM customers;
      DELETE FROM categories;
      DELETE FROM activity_log;
      DELETE FROM settings;
    `)
  })()
  setSetting('seeded', true)
  setSetting('theme', theme)
}

export function loadDemoData(): void {
  clearAllData()
  setSetting('seeded', false)
  seedIfNeeded(getDb())
}
