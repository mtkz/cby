import { create } from 'zustand'
import { getAggregation } from '../services/profileApi'
import type { AggregationBucket } from '../types/profile'

export const FACETS: { field: string; label: string }[] = [
  { field: 'industry', label: 'Industry' },
  { field: 'location_country', label: 'Country' },
  { field: 'gender', label: 'Gender' },
]

interface FacetState {
  buckets: Record<string, AggregationBucket[]>
  expanded: Record<string, boolean>
  error: string | null
  loadFacets: () => Promise<void>
  toggleExpanded: (field: string) => void
}

export const useFacetStore = create<FacetState>()((set) => ({
  buckets: {},
  expanded: {},
  error: null,

  loadFacets: async () => {
    try {
      const results = await Promise.all(
        FACETS.map((facet) => getAggregation(facet.field)),
      )
      set({
        buckets: Object.fromEntries(
          FACETS.map((facet, i) => [facet.field, results[i]]),
        ),
        error: null,
      })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to load filters' })
    }
  },

  toggleExpanded: (field) =>
    set((state) => ({
      expanded: { ...state.expanded, [field]: !state.expanded[field] },
    })),
}))