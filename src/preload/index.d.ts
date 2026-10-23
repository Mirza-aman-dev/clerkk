import type { ClerkkApi } from '../shared/types'

declare global {
  interface Window {
    api: ClerkkApi
  }
}

export {}
