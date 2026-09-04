import { create } from 'zustand'
import type { ProfileFilters } from '../types/profile'

interface FilterState {
  filters: ProfileFilters
  toggleFilter: (field: string, value: string) => void
  clearFilters: () => void
}

export const useFilterStore = create<FilterState>()((set) => ({
  filters: {},
  toggleFilter: (field, value) =>
    set((state) => {
      const next = { ...state.filters }
      if (next[field] === value) {
        delete next[field]
      } else {
        next[field] = value
      }
      return { filters: next }
    }),
  clearFilters: () => set({ filters: {} }),
}))