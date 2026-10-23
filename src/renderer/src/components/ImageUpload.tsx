import { useRef, useState, type DragEvent } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { cn } from '../lib/cn'
import { fileToResizedDataUrl } from '../lib/image'
import { toast } from '../stores/toasts'

export function ImageUpload({
  value,
  onChange,
  square = true,
  size = 112,
  label
}: {
  value: string | null
  onChange: (dataUrl: string | null) => void
  square?: boolean
  size?: number
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  async function handleFile(file: File | undefined | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file', 'Please choose an image file')
      return
    }
    setBusy(true)
    try {
      const dataUrl = await fileToResizedDataUrl(file, { square, maxDim: 720 })
      onChange(dataUrl)
    } catch {
      toast.error('Upload failed', 'Could not process that image')
    } finally {
      setBusy(false)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed',
          'text-app-faint transition-colors hover:border-brand/50 hover:text-brand',
          dragOver ? 'border-brand bg-brand/5' : 'border-app-border',
          value ? 'border-solid' : ''
        )}
        style={{ width: size, height: size }}
      >
        {value ? (
          <>
            <img src={value} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100">
              <ImagePlus className="h-5 w-5 text-white" style={{ width: 20, height: 20 }} />
            </span>
          </>
        ) : busy ? (
          <Loader2 className="h-6 w-6 animate-spin" style={{ width: 24, height: 24 }} />
        ) : (
          <span className="flex flex-col items-center gap-1 px-2">
            <ImagePlus className="h-5 w-5" style={{ width: 20, height: 20 }} />
            {label && <span className="text-[11px] font-medium leading-tight">{label}</span>}
          </span>
        )}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-app-muted transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 className="h-4 w-4" style={{ width: 16, height: 16 }} />
          Remove
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
