import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['pdfkit', 'bwip-js', '#standard-fonts/Helvetica', '#standard-fonts/Courier', '#standard-fonts/Helvetica-Bold', '#standard-fonts/Helvetica-BoldOblique', '#standard-fonts/Helvetica-Oblique', '#standard-fonts/Symbol', '#standard-fonts/Times-Bold', '#standard-fonts/Times-BoldItalic', '#standard-fonts/Times-Italic', '#standard-fonts/Times-Roman', '#standard-fonts/ZapfDingbats'] })]
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
