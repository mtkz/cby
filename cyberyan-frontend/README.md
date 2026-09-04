# Cyberyan frontend

The UI for Cyberyan, a LinkedIn-profile search tool. It talks to the NestJS
backend over the `/api` endpoints: upload a CSV, then search and filter
thousands of profiles with live facet counts.

Stack: React 19, Vite, TypeScript, Zustand for state, oxlint for linting. The
React Compiler is enabled through the Babel plugin.

## Architecture

The app is split into four layers, and data flows in one direction:

```
src/
├── types/        domain types shared by everything (Profile, SearchResponse, …)
├── services/     the only code that touches the backend — a small fetch wrapper
├── stores/       Zustand stores — one per slice of state
├── components/   dumb UI: reads stores, calls their actions
└── utils/        display helpers (formatting values for the table and detail view)
```

### services/

`profileApi.ts` is the whole network layer: a typed `request()` wrapper around
`fetch` that turns non-2xx responses into readable `Error`s (it understands
Nest's `{ message }` error shape), plus one function per endpoint —
`searchProfiles()`, `getAggregation()`, `uploadCsv()`. Nothing else in the app
calls `fetch` directly.

The base URL comes from `VITE_API_BASE_URL`; in development it's left empty
and Vite's proxy forwards `/api` to the backend, so no CORS headaches.

### stores/

Five Zustand stores, each owning one slice of state:

| Store | Holds | Actions |
| --- | --- | --- |
| `searchStore` | query, page, results, loading/error | `search()`, `goToPage()`, `refresh()`, `reset()` |
| `filterStore` | the active facet filters | `toggleFilter()`, `clearFilters()` |
| `facetStore` | facet buckets + which facets are expanded | `loadFacets()` |
| `uploadStore` | chosen file, upload progress and result | `upload()`, `reset()` |
| `detailStore` | the profile currently shown in the detail view | `openProfile()`, `closeProfile()` |

Zustand was chosen because it's tiny and unopinionated — no providers, no
boilerplate, just stores you can read from any component and call from
anywhere.

### components/

Components stay deliberately thin — they read state with selectors and call
actions; they don't own data.

- `App.tsx` is just a shell. If `detailStore` has a profile it renders
  `ProfileDetail`; otherwise it lays out the sidebar and the main column.
- `ProfileSearch` — the search box, results table and pager. It runs a search
  on mount and re-runs it (back to page 1) whenever the active filters
  change. Clicking a row calls `openProfile()`.
- `FacetSidebar` — the filters column. Loads facet counts on mount and renders
  each facet as chips with counts; clicking a chip toggles the filter, and the
  search re-runs because the filters changed.
- `CsvImport` — the file input and the upload report (stored/indexed/failed
  counts, skipped rows with reasons).
- `ProfileDetail` — every non-empty field of a profile, laid out in a grid.

### How the pieces talk

The interesting bit is cross-store coordination, which happens inside the
stores rather than in components:

```
CsvImport ──upload()──▶ uploadStore ──success──▶ searchStore.refresh()
                                              └▶ facetStore.loadFacets()

FacetSidebar ──toggleFilter()──▶ filterStore ──▶ ProfileSearch effect re-runs
                                                  search() at page 1

ProfileSearch ──openProfile()──▶ detailStore ──▶ App renders ProfileDetail
```

So after an upload the results table and the facet counts refresh
automatically, and applying a filter always lands you back on page 1.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:5173 — /api is proxied to http://127.0.0.1:3000
```

Environment: copy `.env.example` to `.env` if you need to point at a
separately hosted backend (`VITE_API_BASE_URL`); leave it empty for local
development.

Scripts: `dev`, `build` (`tsc -b && vite build`), `preview`, `lint`
(oxlint). For a static preview of a production build that also proxies the
API, run `pnpm build && node serve.mjs` (serves `dist/` on port 4173).