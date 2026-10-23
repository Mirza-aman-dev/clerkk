import { Heart } from 'lucide-react'

export function Footer() {
  return (
    <footer className="flex-shrink-0 px-4 py-2 text-center border-t border-app-border bg-app-surface2/50">
      <p className="flex items-center justify-center gap-1.5 text-xs text-app-faint">
        <span>Developed by</span>
        <span className="font-medium text-app-muted">Mirza Aman</span>
      </p>
    </footer>
  )
}