import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { autoUpdater, UpdateInfo } from 'electron-updater'
import log from 'electron-log'

// Configure electron-log
log.initialize({ preload: true })
log.transports.file.level = 'info'
autoUpdater.logger = log

// Prevent multiple checks
let updateCheckInProgress = false
let updateDownloaded = false
let updateInfo: UpdateInfo | null = null

export function initializeUpdater(): void {
  // Configure autoUpdater
  autoUpdater.autoDownload = false // We'll download manually after user confirmation
  autoUpdater.autoInstallOnAppQuit = true

  // Handle events
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...')
    broadcastUpdateStatus('checking')
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log.info('Update available:', info)
    updateInfo = info
    broadcastUpdateStatus('available', info)
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    log.info('No update available:', info)
    updateInfo = null
    broadcastUpdateStatus('not-available', info)
  })

  autoUpdater.on('error', (err: Error) => {
    log.error('Update error:', err)
    updateCheckInProgress = false
    broadcastUpdateStatus('error', err.message)
  })

  autoUpdater.on('download-progress', (progress) => {
    log.info(`Download progress: ${progress.percent}%`)
    broadcastDownloadProgress(progress)
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    log.info('Update downloaded:', info)
    updateDownloaded = true
    broadcastUpdateStatus('downloaded', info)
  })

  // IPC handlers
  ipcMain.handle('updater:check-for-updates', async () => {
    if (updateCheckInProgress) {
      return { success: false, message: 'Update check already in progress' }
    }

    try {
      updateCheckInProgress = true
      const result = await autoUpdater.checkForUpdates()
      updateCheckInProgress = false
      return { success: true, updateInfo: result?.updateInfo }
    } catch (error) {
      updateCheckInProgress = false
      const err = error as Error
      log.error('Check for updates failed:', err)
      return { success: false, message: err.message }
    }
  })

  ipcMain.handle('updater:download-update', async () => {
    if (!updateInfo) {
      return { success: false, message: 'No update available' }
    }
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      const err = error as Error
      log.error('Download update failed:', err)
      return { success: false, message: err.message }
    }
  })

  ipcMain.handle('updater:install-update', async () => {
    if (!updateDownloaded) {
      return { success: false, message: 'Update not downloaded yet' }
    }
    try {
      autoUpdater.quitAndInstall(false, true)
      return { success: true }
    } catch (error) {
      const err = error as Error
      log.error('Install update failed:', err)
      return { success: false, message: err.message }
    }
  })

  ipcMain.handle('updater:get-status', async () => {
    return {
      checking: updateCheckInProgress,
      updateAvailable: !!updateInfo,
      updateDownloaded,
      updateInfo: updateInfo
        ? {
            version: updateInfo.version,
            releaseNotes: updateInfo.releaseNotes,
            releaseDate: updateInfo.releaseDate,
            files: updateInfo.files?.map(f => ({ url: f.url, size: f.size })) ?? []
          }
        : null
    }
  })

  ipcMain.handle('updater:open-release-notes', async () => {
    if (updateInfo?.releaseNotes) {
      const url = `https://github.com/Mirza-aman-dev/clerkk/releases/tag/v${updateInfo.version}`
      await shell.openExternal(url)
    }
  })
}

function broadcastUpdateStatus(status: string, data?: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  windows.forEach(win => {
    win.webContents.send('updater:status', { status, data })
  })
}

function broadcastDownloadProgress(progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }): void {
  const windows = BrowserWindow.getAllWindows()
  windows.forEach(win => {
    win.webContents.send('updater:download-progress', progress)
  })
}

// Check for updates on startup (if internet available)
export async function checkForUpdatesOnStartup(): Promise<void> {
  // Wait a bit for app to fully start
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Check internet connectivity (but don't block update check if it fails)
  let isOnline = false
  try {
    isOnline = await checkInternetConnection()
  } catch {
    isOnline = false
  }
  
  if (!isOnline) {
    log.warn('Internet check failed, but attempting update check anyway...')
  }

  try {
    updateCheckInProgress = true
    const result = await autoUpdater.checkForUpdates()
    log.info('Startup update check result:', result?.updateInfo?.version || 'no update')
  } catch (error) {
    log.error('Startup update check failed:', error)
  } finally {
    updateCheckInProgress = false
  }
  
  // Schedule periodic checks every 4 hours
  setInterval(async () => {
    if (!updateCheckInProgress) {
      try {
        updateCheckInProgress = true
        await autoUpdater.checkForUpdates()
      } catch (error) {
        log.error('Periodic update check failed:', error)
      } finally {
        updateCheckInProgress = false
      }
    }
  }, 4 * 60 * 60 * 1000)
}

function checkInternetConnection(): Promise<boolean> {
  const hosts = [
    { hostname: 'github.com', port: 443, path: '/' },
    { hostname: 'api.github.com', port: 443, path: '/' },
    { hostname: 'www.google.com', port: 443, path: '/' }
  ]

  return new Promise(resolve => {
    let resolved = false
    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; resolve(false) }
    }, 8000)

    for (const host of hosts) {
      if (resolved) break
      const { net } = require('electron')
      const request = net.request({
        method: 'HEAD',
        protocol: 'https:',
        hostname: host.hostname,
        port: host.port,
        path: host.path,
        timeout: 5000
      })
      request.on('response', () => {
        if (!resolved) { resolved = true; clearTimeout(timeout); resolve(true) }
      })
      request.on('error', () => {})
      request.on('timeout', () => {})
      request.end()
    }
    
    // If none resolved within timeout, the timeout will resolve false
  })
}

// Allow disabling auto-check (for testing)
export function setAutoCheckEnabled(enabled: boolean): void {
  autoUpdater.autoDownload = enabled
  autoUpdater.autoInstallOnAppQuit = enabled
}