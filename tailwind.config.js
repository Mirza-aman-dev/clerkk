/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: 'rgb(var(--bg) / <alpha-value>)',
          surface: 'rgb(var(--surface) / <alpha-value>)',
          surface2: 'rgb(var(--surface-2) / <alpha-value>)',
          surface3: 'rgb(var(--surface-3) / <alpha-value>)',
          border: 'rgb(var(--border) / <alpha-value>)',
          text: 'rgb(var(--text) / <alpha-value>)',
          muted: 'rgb(var(--muted) / <alpha-value>)',
          faint: 'rgb(var(--faint) / <alpha-value>)'
        },
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          fg: 'rgb(var(--brand-fg) / <alpha-value>)'
        },
        ok: 'rgb(var(--success) / <alpha-value>)',
        warn: 'rgb(var(--warning) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)'
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ]
      },
      borderRadius: {
        xl2: '1rem',
        xl3: '1.25rem'
      },
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.06)',
        card: '0 1px 2px rgb(0 0 0 / 0.03), 0 4px 16px rgb(0 0 0 / 0.05)',
        pop: '0 12px 40px rgb(0 0 0 / 0.18)',
        glow: '0 0 0 4px rgb(var(--brand) / 0.18)'
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' }
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgb(var(--brand) / 0.45)' },
          '70%': { boxShadow: '0 0 0 8px rgb(var(--brand) / 0)' },
          '100%': { boxShadow: '0 0 0 0 rgb(var(--brand) / 0)' }
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease-out',
        'slide-up': 'slide-up 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 0.16s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
        'toast-in': 'toast-in 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.6s infinite'
      }
    }
  },
  plugins: []
}
