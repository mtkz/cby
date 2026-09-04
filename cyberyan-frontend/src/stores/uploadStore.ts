import { create } from 'zustand'
import { uploadCsv } from '../services/profileApi'
import type { UploadResult } from '../types/profile'
import { useFacetStore } from './facetStore'
import { useSearchStore } from './searchStore'

interface UploadState {
  file: File | null
  busy: boolean
  error: string | null
  result: UploadResult | null
  showAllInvalid: boolean
  selectFile: (file: File | null) => void
  setShowAllInvalid: (show: boolean) => void
  upload: () => Promise<void>
  reset: () => void
}

export const useUploadStore = create<UploadState>()((set, get) => ({
  file: null,
  busy: false,
  error: null,
  result: null,
  showAllInvalid: false,

  selectFile: (file) => set({ file, result: null, error: null }),

  setShowAllInvalid: (show) => set({ showAllInvalid: show }),

  upload: async () => {
    const { file } = get()
    if (!file) return
    set({ busy: true, error: null, result: null, showAllInvalid: false })
    try {
      const result = await uploadCsv(file)
      set({ result, busy: false })
      await Promise.all([
        useSearchStore.getState().refresh(),
        useFacetStore.getState().loadFacets(),
      ])
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'Upload failed',
        busy: false,
      })
    }
  },

  reset: () => set({ file: null, result: null, error: null }),
}))