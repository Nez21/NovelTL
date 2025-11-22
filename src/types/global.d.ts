import type { ElectronAPI } from '@electron-toolkit/preload'

declare namespace NodeJS {
  interface ProcessEnv {
    ELECTRON_RENDERER_URL?: string
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
