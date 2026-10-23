import { app, dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { getDb, closeDatabase, reopenDatabase, dbPath } from './db'
import { logActivity } from './db'

export async function backupDatabase(win: BrowserWindow): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Back up database',
    defaultPath: `clerkk-backup-${new Date().toISOString().slice(0, 10)}.db`,
    filters: [{ name: 'SQLite Database', extensions: ['db'] }]
  })
  if (canceled || !filePath) return null
  await getDb().backup(filePath)
  logActivity('system.backup', `Database backed up to ${filePath}`)
  return filePath
}

export async function restoreDatabase(win: BrowserWindow): Promise<boolean> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Restore database',
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    properties: ['openFile']
  })
  if (canceled || !filePaths[0]) return false
  const src = filePaths[0]

  const fd = await fs.open(src, 'r')
  const head = Buffer.alloc(16)
  await fd.read(head, 0, 16, 0)
  await fd.close()
  if (head.toString('utf8', 0, 16) !== 'SQLite format 3\u0000') {
    throw new Error('The selected file is not a valid Clerkk database')
  }

  closeDatabase()
  try {
    await fs.copyFile(src, dbPath())
  } finally {
    reopenDatabase()
  }
  logActivity('system.restore', `Database restored from ${src}`)
  return true
}
