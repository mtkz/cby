import { useEffect } from 'react'
import { FACETS, useFacetStore } from '../stores/facetStore'
import { useFilterStore } from '../stores/filterStore'

const VISIBLE = 5

export default function FacetSidebar() {
  const buckets = useFacetStore((s) => s.buckets)
  const expanded = useFacetStore((s) => s.expanded)
  const error = useFacetStore((s) => s.error)
  const loadFacets = useFacetStore((s) => s.loadFacets)
  const toggleExpanded = useFacetStore((s) => s.toggleExpanded)
  const filters = useFilterStore((s) => s.filters)
  const toggleFilter = useFilterStore((s) => s.toggleFilter)
  const clearFilters = useFilterStore((s) => s.clearFilters)

  useEffect(() => {
    void loadFacets()
  }, [loadFacets])

  const hasActive = Object.values(filters).some(Boolean)

  return (
    <aside className="facets">
      <div className="facets-head">
        <h2>Filters</h2>
        {hasActive && (
          <button type="button" className="link" onClick={clearFilters}>
            Clear all
          </button>
        )}
      </div>
      {error && <div className="alert error">{error}</div>}
      {FACETS.map((facet) => {
        const list = (buckets[facet.field] ?? []).filter((b) => b.key !== '')
        if (list.length === 0) return null
        const shown = expanded[facet.field] ? list : list.slice(0, VISIBLE)
        return (
          <div className="facet" key={facet.field}>
            <div className="facet-title">{facet.label}</div>
            <div className="facet-chips">
              {shown.map((b) => {
                const active = filters[facet.field] === b.key
                return (
                  <button
                    type="button"
                    key={b.key}
                    className={active ? 'chip active' : 'chip'}
                    onClick={() => toggleFilter(facet.field, b.key)}
                    title={b.key}
                  >
                    <span className="chip-label">{b.key}</span>
                    <span className="chip-count">{b.doc_count}</span>
                  </button>
                )
              })}
              {list.length > VISIBLE && (
                <button
                  type="button"
                  className="link"
                  onClick={() => toggleExpanded(facet.field)}
                >
                  {expanded[facet.field]
                    ? 'Show less'
                    : `Show all ${list.length}`}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </aside>
  )
}