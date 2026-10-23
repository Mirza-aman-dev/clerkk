import { useCallback, useRef, useState } from 'react'
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library'
import { Image, Upload, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '../lib/cn'

interface BarcodeImageUploadProps {
  onBarcodeDetected: (code: string) => void
  className?: string
}

export function BarcodeImageUpload({ onBarcodeDetected, className }: BarcodeImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader>()

  // Initialize the reader once
  if (!readerRef.current) {
    readerRef.current = new BrowserMultiFormatReader()
    // Configure hints for better barcode detection
    const hints = new Map()
    hints.set(DecodeHintType.TRY_HARDER, true)
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.PDF_417,
    ])
    readerRef.current.hints = hints
  }

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        setStatus('error')
        return
      }

      // Create preview
      const objectUrl = URL.createObjectURL(file)
      setPreview(objectUrl)
      setStatus('loading')
      setError(null)

      try {
        // Create an image element to load the file
        const img = new window.Image()
        img.src = objectUrl

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Failed to load image'))
        })

        // Decode the barcode
        if (!readerRef.current) throw new Error('Reader not initialized')

        const result = await readerRef.current.decodeFromImageElement(img)
        const code = result.getText()

        if (code) {
          setStatus('success')
          onBarcodeDetected(code)
        } else {
          throw new Error('No barcode found in image')
        }
      } catch (err) {
        setStatus('error')
        const msg = err instanceof Error ? err.message : 'Failed to read barcode'
        setError(msg)
        console.error('Barcode decode error:', err)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    },
    [onBarcodeDetected]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFileSelect(file)
      }
      // Reset input to allow selecting same file again
      e.target.value = ''
    },
    [handleFileSelect]
  )

  const clearPreview = useCallback(() => {
    setPreview(null)
    setStatus('idle')
    setError(null)
  }, [])

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <label
        htmlFor="barcode-image-upload"
        className={cn(
          'relative flex h-24 w-24 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed transition-colors',
          status === 'success' && 'border-emerald-500 bg-emerald-500/10',
          status === 'error' && 'border-danger bg-danger/10',
          status === 'idle' && 'border-app-border hover:border-brand/50',
          status === 'loading' && 'border-brand bg-brand/10'
        )}
      >
        <input
          ref={fileInputRef}
          id="barcode-image-upload"
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
          disabled={status === 'loading'}
        />

        {preview && status !== 'loading' && (
          <>
            <img
              src={preview}
              alt="Barcode preview"
              className="absolute inset-0 h-full w-full object-cover rounded-lg"
            />
            {status === 'success' && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                <div className="flex flex-col items-center gap-1 text-white">
                  <CheckCircle className="h-6 w-6" style={{ width: 24, height: 24 }} />
                  <span className="text-xs font-medium">Detected</span>
                </div>
              </div>
            )}
            {status === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                <div className="flex flex-col items-center gap-1 text-white">
                  <XCircle className="h-6 w-6" style={{ width: 24, height: 24 }} />
                  <span className="text-xs font-medium">Error</span>
                </div>
              </div>
            )}
          </>
        )}

        {!preview && (
          <div className="flex flex-col items-center gap-1.5 text-center p-2">
            {status === 'loading' ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-brand" style={{ width: 24, height: 24 }} />
                <span className="text-xs text-app-muted">Scanning…</span>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 text-app-faint" style={{ width: 20, height: 20 }} />
                <span className="text-[10px] text-app-muted">Upload barcode image</span>
              </>
            )}
          </div>
        )}

        {preview && (
          <button
            type="button"
            onClick={clearPreview}
            className="absolute -top-1 -right-1 rounded-full bg-danger/90 p-1 text-white hover:bg-danger transition-colors"
            aria-label="Remove image"
          >
            <XCircle className="h-3 w-3" style={{ width: 12, height: 12 }} />
          </button>
        )}
      </label>

      {error && (
        <p className="text-xs text-danger text-center max-w-[120px]">{error}</p>
      )}
    </div>
  )
}