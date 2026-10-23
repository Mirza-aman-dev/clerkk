import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowDown, CheckCircle, Download, Loader2, X } from 'lucide-react'
import { Button, Modal } from '../components/ui'
import { useUpdater } from '../stores/updater'
import { cn } from '../lib/cn'
import type { UpdateInfo } from '../../../shared/types'

interface UpdateDialogProps {
  open: boolean
  onClose: () => void
  version?: string
}

export function UpdateDialog({ open, onClose, version }: UpdateDialogProps) {
  const { status, checkForUpdates, downloadUpdate, installUpdate, getStatus } = useUpdater()
  const [phase, setPhase] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const checkRef = useRef(false)

  const renderFooter = () => {
    if (phase === 'idle' || phase === 'checking') {
      return (
        <Button variant="secondary" onClick={handleClose} disabled={phase === 'checking'}>
          Close
        </Button>
      )
    }
    if (phase === 'available') {
      return (
        <>
          <Button variant="secondary" onClick={handleClose} disabled>
            Later
          </Button>
          <Button onClick={handleDownload}>
            <ArrowDown className="mr-2 h-4 w-4" />
            Download & Install
          </Button>
        </>
      )
    }
    if (phase === 'downloading') {
      return (
        <Button variant="secondary" onClick={handleClose} disabled>
          Cancel
        </Button>
      )
    }
    if (phase === 'downloaded') {
      return (
        <>
          <Button variant="secondary" onClick={handleClose}>
            Later
          </Button>
          <Button onClick={handleInstall} className="bg-danger hover:bg-danger/90">
            <CheckCircle className="mr-2 h-4 w-4" />
            Install & Restart
          </Button>
        </>
      )
    }
    if (phase === 'error') {
      return (
        <>
          <Button variant="secondary" onClick={() => { setPhase('idle'); setError(null); }}>
            Try Again
          </Button>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </>
      )
    }
    return (
      <Button variant="secondary" onClick={handleClose}>
        Close
      </Button>
    )
  }

  // Sync with store
  useEffect(() => {
    if (status.checking) setPhase('checking')
    else if (status.updateAvailable && !status.updateDownloaded) setPhase('available')
    else if (status.updateDownloaded) setPhase('downloaded')
    if (status.updateInfo) setUpdateInfo(status.updateInfo)
  }, [status])

  // Initialize listeners
  useEffect(() => {
    if (!checkRef.current) {
      checkRef.current = true
      const unsubscribeStatus = window.api.updater.onStatus(({ status: statusStr, data }) => {
        switch (statusStr) {
          case 'checking':
            setPhase('checking')
            break
          case 'available':
            setPhase('available')
            if (data) setUpdateInfo(data as UpdateInfo)
            break
          case 'not-available':
            setPhase('idle')
            break
          case 'downloaded':
            setPhase('downloaded')
            break
          case 'error':
            setPhase('error')
            setError(data as string)
            break
        }
      })

      const unsubscribeProgress = window.api.updater.onDownloadProgress((p) => {
        setProgress(p.percent)
        setPhase('downloading')
      })

      return () => {
        unsubscribeStatus()
        unsubscribeProgress()
      }
    }
  }, [])

  const handleCheck = async () => {
    setError(null)
    setPhase('checking')
    const result = await checkForUpdates()
    if (!result.success && result.message) {
      setError(result.message)
      setPhase('error')
    }
  }

  const handleDownload = async () => {
    setPhase('downloading')
    setProgress(0)
    const result = await downloadUpdate()
    if (!result.success && result.message) {
      setError(result.message)
      setPhase('error')
    }
  }

  const handleInstall = async () => {
    setPhase('installing')
    const result = await installUpdate()
    if (!result.success && result.message) {
      setError(result.message)
      setPhase('error')
    }
  }

  const handleClose = () => {
    setPhase('idle')
    setProgress(0)
    setError(null)
    setUpdateInfo(null)
    onClose()
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title={phase === 'available' ? 'Update Available' : phase === 'downloading' ? 'Downloading Update' : phase === 'downloaded' ? 'Update Ready' : phase === 'error' ? 'Update Error' : 'Check for Updates'}
      description={
        phase === 'available' && updateInfo
          ? `Version ${updateInfo.version} is available${updateInfo.releaseDate ? ` (${new Date(updateInfo.releaseDate).toLocaleDateString()})` : ''}`
          : phase === 'downloading'
          ? 'Downloading update...'
          : phase === 'downloaded'
          ? 'Update downloaded. Click "Install & Restart" to apply.'
          : phase === 'error'
          ? 'An error occurred while checking for updates.'
          : 'Checking for updates...'
      }
      footer={renderFooter()}
    >
      <div className="space-y-4">
        {/* Status Icon */}
        <div className={cn('flex justify-center', phase === 'error' ? 'text-danger' : 'text-brand')}>
          {phase === 'checking' && (
            <Loader2 className="h-12 w-12 animate-spin" />
          )}
          {phase === 'available' && (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10">
              <ArrowDown className="h-8 w-8 text-brand" />
            </div>
          )}
          {phase === 'downloading' && (
            <div className="relative flex h-16 w-16 items-center justify-center">
              <svg className="h-16 w-16 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-app-border"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray="251.2"
                  strokeDashoffset={`${251.2 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  className="text-brand transition-all duration-300"
                />
              </svg>
              <span className="absolute text-xl font-bold">{Math.round(progress)}%</span>
            </div>
          )}
          {phase === 'downloaded' && (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
          )}
          {phase === 'error' && (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/10">
              <AlertCircle className="h-8 w-8 text-danger" />
            </div>
          )}
          {phase === 'installing' && (
            <Loader2 className="h-12 w-12 animate-spin text-brand" />
          )}
        </div>

        {/* Progress Bar for downloading */}
        {phase === 'downloading' && (
          <div className="h-2 rounded-full bg-app-surface2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand to-indigo-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Update Info */}
        {updateInfo && (
          <div className="rounded-xl border border-app-border bg-app-surface2/50 p-4">
            <h4 className="font-medium text-app-text mb-2">Version {updateInfo.version}</h4>
            {updateInfo.releaseNotes && (
              <a
                href={updateInfo.releaseNotes}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand hover:underline flex items-center gap-1"
                onClick={(e) => {
                  e.preventDefault()
                  window.api.updater.openReleaseNotes()
                }}
              >
                View Release Notes
                <Download className="h-3 w-3" />
              </a>
            )}
            {updateInfo.releaseDate && (
              <p className="mt-2 text-xs text-app-faint">
                Released: {new Date(updateInfo.releaseDate).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-danger text-sm">
            {error}
          </div>
        )}

        {/* Manual Check Button (when idle) */}
        {phase === 'idle' && (
          <div className="pt-4 border-t border-app-border">
            <Button onClick={handleCheck} className="w-full" disabled={status.checking}>
              {status.checking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                'Check for Updates'
              )}
            </Button>
            <p className="mt-2 text-center text-xs text-app-faint">
              Current version: {version || '1.0.0'}
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}