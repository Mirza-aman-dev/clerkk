import {
  forwardRef,
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  X,
  XCircle,
  type LucideIcon
} from 'lucide-react'
import { cn } from '../lib/cn'
import { useToasts } from '../stores/toasts'

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-brand-fg hover:bg-brand/90 shadow-sm shadow-brand/20 active:scale-[0.98]',
  secondary: 'bg-app-surface2 text-app-text hover:bg-app-surface3 border border-app-border',
  ghost: 'text-app-muted hover:text-app-text hover:bg-app-surface2',
  danger: 'bg-danger text-white hover:opacity-90 active:scale-[0.98]',
  outline: 'border border-app-border text-app-text hover:bg-app-surface2'
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150 select-none',
        'disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none',
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
})

export function IconButton({
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg text-app-muted transition-colors',
        'hover:bg-app-surface2 hover:text-app-text focus-visible:outline-none disabled:opacity-40',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ---------------------------------- Inputs --------------------------------- */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-xl border bg-app-surface px-3.5 text-sm text-app-text',
        'placeholder:text-app-faint transition-colors focus:outline-none focus:ring-2 focus:ring-brand/60 focus:border-brand/60',
        'disabled:opacity-50',
        invalid ? 'border-danger' : 'border-app-border',
        className
      )}
      {...rest}
    />
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-xl border border-app-border bg-app-surface px-3.5 py-2.5 text-sm text-app-text',
          'placeholder:text-app-faint transition-colors focus:outline-none focus:ring-2 focus:ring-brand/60 focus:border-brand/60',
          'resize-none disabled:opacity-50 scrollbar-thin',
          className
        )}
        {...rest}
      />
    )
  }
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'h-10 w-full appearance-none rounded-xl border border-app-border bg-app-surface px-3.5 pr-9 text-sm text-app-text',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-brand/60 focus:border-brand/60 disabled:opacity-50',
          className
        )}
        {...rest}
      >
        {children}
      </select>
    )
  }
)

export function Field({
  label,
  error,
  hint,
  children,
  className
}: {
  label?: string
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <label className="block text-[13px] font-medium text-app-muted">{label}</label>}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-app-faint">{hint}</p>
      ) : null}
    </div>
  )
}

/* ---------------------------------- Toggle --------------------------------- */

export function Toggle({
  checked,
  onChange,
  disabled
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-none disabled:opacity-40',
        checked ? 'bg-brand' : 'bg-app-surface3'
      )}
    >
      <span
        className={cn(
          'inline-block transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-1'
        )}
        style={{ height: 18, width: 18 }}
      />
    </button>
  )
}

/* ---------------------------------- Badge ---------------------------------- */

type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: 'bg-app-surface3 text-app-muted',
  brand: 'bg-brand/12 text-brand',
  success: 'bg-ok/12 text-ok',
  warning: 'bg-warn/12 text-warn',
  danger: 'bg-danger/12 text-danger'
}

export function Badge({
  variant = 'neutral',
  className,
  children
}: {
  variant?: BadgeVariant
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        badgeVariants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

/* ---------------------------------- Modal ---------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnBackdrop?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-app-border',
          'bg-app-surface shadow-pop animate-scale-in',
          widths[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-app-text">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-app-muted">{description}</p>}
          </div>
          <IconButton onClick={onClose} aria-label="Close" className="-mr-1 -mt-1">
            <X style={{ width: 18, height: 18 }} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6 scrollbar-thin">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2.5 border-t border-app-border bg-app-surface2/50 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  loading
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      closeOnBackdrop={!loading}
      title={
        <span className="flex items-center gap-2">
          {danger && <AlertTriangle className="h-5 w-5 text-danger" style={{ width: 20, height: 20 }} />}
          {title}
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-app-muted">{message}</div>
    </Modal>
  )
}

/* -------------------------------- Misc pieces ------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand', className)} />
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-app-surface2 text-app-faint">
        <Icon className="h-7 w-7" style={{ width: 28, height: 28 }} />
      </div>
      <div>
        <p className="font-semibold text-app-text">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-app-muted">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-app-border bg-app-surface2 px-1.5 font-mono text-[11px] font-medium text-app-muted">
      {children}
    </kbd>
  )
}

/* ---------------------------------- Toasts --------------------------------- */

const toastIcons: Record<string, LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle
}
const toastColors: Record<string, string> = {
  success: 'text-ok',
  error: 'text-danger',
  info: 'text-brand',
  warning: 'text-warn'
}

export function ToastHost() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  return createPortal(
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[360px] flex-col gap-2.5">
      {toasts.map((t) => {
        const Icon = toastIcons[t.kind]
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-app-border bg-app-surface p-3.5 shadow-pop animate-toast-in"
          >
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', toastColors[t.kind])} style={{ width: 20, height: 20 }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-app-text">{t.title}</p>
              {t.message && <p className="mt-0.5 text-[13px] text-app-muted">{t.message}</p>}
              {t.action && (
                <button
                  onClick={() => {
                    t.action?.onClick()
                    dismiss(t.id)
                  }}
                  className="mt-1.5 text-[13px] font-semibold text-brand hover:underline"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-app-faint hover:text-app-text"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" style={{ width: 16, height: 16 }} />
            </button>
          </div>
        )
      })}
    </div>,
    document.body
  )
}
