export interface ResizeOptions {
  maxDim?: number
  square?: boolean
  quality?: number
}

export function fileToResizedDataUrl(file: File, opts: ResizeOptions = {}): Promise<string> {
  const { maxDim = 640, square = false, quality = 0.86 } = opts
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width
        const srcH = img.naturalHeight || img.height
        let sx = 0
        let sy = 0
        let sw = srcW
        let sh = srcH
        if (square) {
          const side = Math.min(srcW, srcH)
          sx = (srcW - side) / 2
          sy = (srcH - side) / 2
          sw = side
          sh = side
        }
        const scale = Math.min(1, maxDim / Math.max(sw, sh))
        const w = Math.max(1, Math.round(sw * scale))
        const h = Math.max(1, Math.round(sh * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas not supported'))
          return
        }
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
        const isPng = file.type === 'image/png'
        const out = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : quality)
        resolve(out)
      } catch (e) {
        reject(e)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }
    img.src = url
  })
}
