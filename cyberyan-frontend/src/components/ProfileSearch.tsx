import { useEffect } from 'react'
import { useDetailStore } from '../stores/detailStore'
import { useFilterStore } from '../stores/filterStore'
import { PAGE_SIZE, useSearchStore } from '../stores/searchStore'
import { fieldValue } from '../utils/format'

const COLUMNS: { key: string; label: string }[] = [
  { key: 'full_name', label: 'Name' },
  { key: 'job_title', label: 'Title' },
  { key: 'job_company_name', label: 'Company' },
  { key: 'location_name', label: 'Location' },
  { key: 'industry', label: 'Industry' },
]

export default function ProfileSearch() {
  const query = useSearchStore((s) => s.query)
  const results = useSearchStore((s) => s.results)
  const busy = useSearchStore((s) => s.busy)
  const error = useSearchStore((s) => s.error)
  const setQuery = useSearchStore((s) => s.setQuery)
  const search = useSearchStore((s) => s.search)
  const goToPage = useSearchStore((s) => s.goToPage)
  const filters = useFilterStore((s) => s.filters)
  const openProfile = useDetailStore((s) => s.openProfile)

  useEffect(() => {
    void search({ page: 1 })
  }, [filters, search])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void search({ page: 1 })
  }

  return (
    <section className="panel">
      <h2>Search profiles</h2>
      <form className="search-row" onSubmit={handleSubmit}>
        <input
          type="search"
          placeholder="Search name, title, company, skills…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <div className="alert error">{error}</div>}

      {results && (
        <>
          <div className="meta">
            {results.total} profile{results.total === 1 ? '' : 's'} found
          </div>
          <table className="results">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.data.map((p) => (
                <tr key={p.id} onClick={() => openProfile(p)} tabIndex={0}>
                  {COLUMNS.map((c) => (
                    <td key={c.key}>{fieldValue(p[c.key]) || '—'}</td>
                  ))}
                </tr>
              ))}
              {results.data.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="empty">
                    No profiles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {results.total > PAGE_SIZE && (
            <div className="pager">
              <button
                type="button"
                onClick={() => goToPage(results.page - 1)}
                disabled={results.page <= 1 || busy}
              >
                ← Prev
              </button>
              <span>
                Page {results.page} of{' '}
                {Math.max(1, Math.ceil(results.total / PAGE_SIZE))}
              </span>
              <button
                type="button"
                onClick={() => goToPage(results.page + 1)}
                disabled={results.page * PAGE_SIZE >= results.total || busy}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}