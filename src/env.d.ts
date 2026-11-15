import type { SoloLevingApi } from '@shared/contracts/api'

declare global {
  interface Window {
    /** Typed preload API. See shared/contracts/api.ts and docs/ipc-contracts.md */
    soloLeving: SoloLevingApi
  }
}

export {}
