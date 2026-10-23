import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from './ui'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Render error:', error, info)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-app-bg p-6 text-app-text">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
              <AlertTriangle style={{ width: 26, height: 26 }} />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Something went wrong</h1>
              <p className="mt-1 text-sm text-app-muted">{this.state.error.message}</p>
            </div>
            <Button onClick={() => this.setState({ error: null })}>
              <RotateCw style={{ width: 16, height: 16 }} />
              Try again
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
