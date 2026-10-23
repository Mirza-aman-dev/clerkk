import { useEffect, useState } from 'react'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'

interface SplashScreenProps {
  onComplete: (hasError: boolean, errorMessage?: string) => void
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('Initializing…')
  const [error, setError] = useState<string | null>(null)
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const startTime = Date.now()

    // Simulate initialization steps (visual only)
    const steps = [
      { message: 'Loading configuration…', duration: 400 },
      { message: 'Connecting to database…', duration: 500 },
      { message: 'Initializing scanner…', duration: 400 },
      { message: 'Preparing UI…', duration: 300 },
    ]

    // Poll for settings load completion
    let pollInterval: ReturnType<typeof setInterval> | null = null

    async function runInitialization() {
      try {
        // Run visual steps
        for (let i = 0; i < steps.length; i++) {
          if (cancelled) return
          const step = steps[i]
          setMessage(step.message)
          setProgress(((i + 1) / steps.length) * 60) // Up to 60% for visual steps

          const elapsed = Date.now() - startTime
          const waitTime = Math.max(step.duration, 2000 - elapsed - (steps.length - i - 1) * 100)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }

        // Now wait for actual settings load (polling approach)
        setMessage('Loading settings…')
        setProgress(70)

        // Start polling for settings load
        pollInterval = setInterval(() => {
          // We can't directly access zustore state here, so we'll use a different approach
          // The App component will handle the actual completion logic
        }, 100)

        // Wait minimum 2 seconds total
        const elapsed = Date.now() - startTime
        if (elapsed < 2000) {
          await new Promise(resolve => setTimeout(resolve, 2000 - elapsed))
        }

        // The actual completion is handled by App component watching settings.loaded
        // This splash just ensures minimum display time
        if (cancelled) return
        setProgress(90)
        setMessage('Finalizing…')
        await new Promise(resolve => setTimeout(resolve, 300))
        
        if (!cancelled) {
          setProgress(100)
          setMessage('Ready')
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      } catch (err) {
        if (cancelled) return
        const errorMsg = err instanceof Error ? err.message : 'Unknown error during startup'
        setError(errorMsg)
        setShowError(true)
        setMessage('Initialization failed')
      } finally {
        if (pollInterval) clearInterval(pollInterval)
      }
    }

    runInitialization()

    return () => {
      cancelled = true
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [onComplete])

  if (showError && error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-app-bg p-6">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/10">
            <AlertCircle className="h-8 w-8 text-danger" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-app-text">Unable to Start</h2>
            <p className="mt-2 text-sm text-app-muted">{message}</p>
            <p className="mt-1 text-xs text-app-faint font-mono">{error}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
            >
              Reload App
            </button>
            <button
              onClick={() => onComplete(true, error)}
              className="px-4 py-2 rounded-lg border border-app-border bg-app-surface text-app-text text-sm font-medium hover:bg-app-surface2 transition-colors"
            >
              Continue Anyway
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-app-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-brand/20" />
          <div className="absolute inset-0 rounded-full border-4 border-brand border-t-transparent animate-spin" />
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-indigo-500 text-white shadow-lg shadow-brand/30 relative z-10">
            <span className="text-2xl font-bold">C</span>
          </div>
        </div>
        <div className="w-64">
          <div className="h-2 rounded-full bg-app-surface2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand to-indigo-400 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-app-muted text-center">{message}</p>
          {progress < 100 && (
            <p className="mt-1 text-xs text-app-faint text-center">
              {Math.round(progress)}%
            </p>
          )}
        </div>
      </div>
    </div>
  )
}