import { create } from 'zustand'
import { searchProfiles } from '../services/profileApi'
import type { SearchResponse } from '../types/profile'
import { useFilterStore } from './filterStore'

export const PAGE_SIZE = 10

interface SearchState {
  query: string
  page: number
  results: SearchResponse | null
  busy: boolean
  error: string | null
  setQuery: (query: string) => void
  search: (opts?: { q?: string; page?: number }) => Promise<void>
  goToPage: (page: number) => void
  refresh: () => Promise<void>
  reset: () => void
}

export const useSearchStore = create<SearchState>()((set, get) => ({
  query: '',
  page: 1,
  results: null,
  busy: false,
  error: null,

  setQuery: (query) => set({ query }),

  search: async ({ q, page } = {}) => {
    const query = q ?? get().query
    const target = page ?? 1
    set({ busy: true, error: null, query, page: target })
    try {
      const results = await searchProfiles({
        q: query || undefined,
        page: target,
        limit: PAGE_SIZE,
        filters: useFilterStore.getState().filters,
      })
      set({ results, busy: false })
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'Search failed',
        busy: false,
      })
    }
  },

  goToPage: (page) => {
    void get().search({ page })
  },

  refresh: () => {
    const { query, page } = get()
    return get().search({ q: query, page })
  },

  reset: () => set({ query: '', page: 1, results: null, error: null }),
}))