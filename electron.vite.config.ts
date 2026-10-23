import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({ exclude: ['pdfkit', 'bwip-js'] }),
      {
        name: 'copy-fonts',
        writeBundle() {
          const srcDir = resolve(__dirname, 'src/main/fonts')
          const destDir = resolve(__dirname, 'out/main/fonts')
          if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true })
          }
          const fonts = ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf']
          for (const font of fonts) {
            const src = resolve(srcDir, font)
            const dest = resolve(destDir, font)
            if (existsSync(src)) {
              copyFileSync(src, dest)
            }
          }
        }
      }
    ]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
