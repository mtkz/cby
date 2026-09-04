# Cyberyan

Cyberyan is a LinkedIn-profile search tool. You drop in a CSV of profiles, it
stores them in MongoDB, indexes them into Elasticsearch, and gives you a search
UI where you can filter by industry, country, gender, salary, experience and
more in a couple of clicks.

The repo contains two independent projects:

| Folder | What it is | Stack |
| --- | --- | --- |
| `cberyan-backend/` | the API | NestJS, MongoDB (Mongoose), Elasticsearch, csv-parser |
| `cyberyan-frontend/` | the UI | React 19, Vite, TypeScript, Zustand |

They talk over a plain HTTP API (`/api/...`). In development the Vite server
proxies those calls to the backend, so there's no CORS setup to fiddle with.

## The idea in 30 seconds

1. **Upload** a CSV of profiles. The backend parses it row by row, drops the
   corrupt rows (and tells you why), repairs rows that have a single bad
   field, and stores the survivors in MongoDB.
2. **Index** the same documents into Elasticsearch, using the Mongo `_id` as
   the Elasticsearch `_id` so both stores always refer to the same profile.
3. **Search.** The UI sends queries to Elasticsearch, which is fast and
   forgiving — fuzzy matching on names, titles, companies, skills.
4. **Filter.** The sidebar shows live facet counts (industry, country,
   gender) computed from Elasticsearch aggregations. Pick one and the results
   update immediately.
5. **Inspect.** Click any row to see every field the CSV contained.

One rule runs through the whole design: **MongoDB is the source of truth,
Elasticsearch is a derived search index.** If the two ever drift apart, a
single endpoint rebuilds the entire index from Mongo.

## Backend architecture — onion style

The backend follows an onion architecture: the business logic sits in the
middle and knows nothing about MongoDB, Elasticsearch or HTTP. Everything
external lives on the outside and implements interfaces that the core defines.

```
cberyan-backend/src/modules/profile/
├── domain/                  ← the core: what a profile is, and what we can do with it
│   ├── profile.entity.ts              the Profile shape (plain interface, no framework)
│   ├── profile.repository.port.ts     "somewhere to save and load profiles"
│   ├── profile-search.port.ts         "somewhere to search profiles"
│   └── csv-parser.port.ts             "something that turns a CSV into profiles"
├── application/             ← use cases; orchestrate the ports above
│   ├── profile-query.service.ts       reads: search, findOne, aggregations
│   └── profile-command.service.ts     writes: create, CSV import, reindex, update, delete
├── infrastructure/          ← the real implementations of the ports
│   ├── persistence/                   Mongoose schema + MongoProfileRepository
│   ├── search/                        ElasticsearchProfileRepository (mapping, queries, bulk, aggs)
│   └── csv/                           CsvProfileParser (validation + repair)
└── presentation/            ← the HTTP surface
    ├── profile.controller.ts          routes; maps the query DTO to search criteria
    └── dto/search-profile.dto.ts      validated query parameters
```

The rule that keeps this sane is simple: **dependencies point inward.**
`domain/` imports nothing from the rest of the app. `application/` only talks
to the interfaces in `domain/`. Only `infrastructure/` and `presentation/`
know about MongoDB, Elasticsearch, csv-parser and HTTP. `profile.module.ts`
wires it all together through Nest's DI, mapping each port to its concrete
adapter (`ProfileRepositoryPort → MongoProfileRepository`, and so on). Want to
swap the search engine later? Write one new adapter — the use cases don't
change.

Why onion? The original `profile.service.ts` was a single ~900-line file that
mixed Mongo queries, Elasticsearch query DSL, index mappings and CSV
validation together. It worked, but touching anything meant reading
everything. Now each concern lives in its own small file — the query service
is roughly sixty lines of pure orchestration, and all the Elasticsearch
specifics live in the search adapter where they belong.

A few behaviors worth knowing:

- **Index bootstrapping.** The Elasticsearch adapter creates the `profiles`
  index with its full mapping on startup, if it isn't there already.
- **Best-effort sync.** Every write goes to Mongo first; the Elasticsearch
  write is best-effort. If it fails, Mongo is still correct — hit
  `POST /api/profiles/reindex` to rebuild the index.
- **CSV hygiene.** Rows are checked for alignment (a stray quote shifts
  columns), and a handful of "sentinel" fields — birth year, salary, dates —
  are sanity-checked. One implausible value: the field is dropped and the row
  is repaired. Two or more: the row is rejected as misaligned.

## Frontend architecture — clean layers + Zustand

The frontend is split into four layers, and data flows in one direction:
types → services → stores → components.

```
cyberyan-frontend/src/
├── types/          Profile, SearchResponse, UploadResult… shared by everything
├── services/       the only code that touches the backend (a small fetch wrapper)
├── stores/         Zustand stores — one per slice of state
├── components/     dumb UI: reads stores, calls their actions
└── utils/          display helpers (formatting values for the table/detail view)
```

There are five stores, each with a single responsibility:

| Store | Holds | Actions |
| --- | --- | --- |
| `searchStore` | query, page, results, loading/error | `search()`, `goToPage()`, `refresh()` |
| `filterStore` | the active facet filters | `toggleFilter()`, `clearFilters()` |
| `facetStore` | facet buckets and expand state | `loadFacets()` |
| `uploadStore` | chosen file, upload progress and result | `upload()`, `reset()` |
| `detailStore` | the profile currently shown in detail | `openProfile()`, `closeProfile()` |

The components stay deliberately thin — `App.tsx` is just a shell that reads
`detailStore` and lays out the three panels. `ProfileSearch` runs a search on
mount and whenever the active filters change (reset to page 1); `FacetSidebar`
loads the facet counts; `CsvImport` handles the file input. After a successful
upload, `uploadStore` pokes `searchStore.refresh()` and
`facetStore.loadFacets()` so the new data shows up immediately.

## API

Base URL: `http://localhost:3000` (or wherever `PORT` points).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | hello / health |
| `GET` | `/api/profiles/search` | search with filters, pagination and sorting |
| `GET` | `/api/profiles/aggregations/:field` | facet buckets for a field |
| `GET` | `/api/profiles/:id` | one profile (Mongo id, or legacy ES id) |
| `POST` | `/api/profiles/upload-csv` | import a CSV (multipart field `file`) |
| `POST` | `/api/profiles/reindex` | rebuild the ES index from MongoDB |
| `POST` | `/api/profiles` | create one profile |
| `PUT` | `/api/profiles/:id` | update one profile |
| `DELETE` | `/api/profiles/:id` | delete one profile |

Search accepts: `q`, `page`, `limit`, `sort_by`, `sort_order`, `first_name`,
`last_name`, `full_name`, `job_title`, `job_company_name`, `location_name`,
`location_country`, `location_region`, `industry`, `skills`,
`min_experience`, `max_experience`, `min_salary`, `max_salary`.

## Environment variables

Backend (`cberyan-backend/.env`, see `.env.example`):

| Variable | Default | What it is |
| --- | --- | --- |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/cyberyan` | MongoDB connection string |
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Elasticsearch cluster |
| `ELASTICSEARCH_USERNAME` / `ELASTICSEARCH_PASSWORD` | — | optional basic auth |
| `PORT` | `3000` | HTTP port |

Frontend (`cyberyan-frontend/.env`, see `.env.example`):

| Variable | Default | What it is |
| --- | --- | --- |
| `VITE_API_BASE_URL` | empty | leave empty in dev (Vite proxies `/api`); set it to point at a separately hosted backend |

## Running it

You'll need Node 20+, `pnpm`, MongoDB and an Elasticsearch 8 cluster
(Elasticsearch must be reachable at `ELASTICSEARCH_URL` — the backend fails
fast if it can't connect, by design).

```bash
# backend
cd cberyan-backend
pnpm install
cp .env.example .env      # adjust values if needed
pnpm start:dev            # → http://localhost:3000

# frontend (in another terminal)
cd cyberyan-frontend
pnpm install
pnpm dev                  # → http://localhost:5173, /api proxied to :3000
```

For a static preview of a production build:

```bash
cd cyberyan-frontend
pnpm build
node serve.mjs            # → http://localhost:4173 (serves dist/ and proxies /api)
```

## Scripts

Backend: `start:dev` (watch mode), `start:prod`, `build`, `lint` (oxlint),
`test` (vitest), `test:e2e`, `format` (prettier).

Frontend: `dev`, `build` (`tsc -b && vite build`), `preview`, `lint`
(oxlint). The React Compiler is enabled via the Babel plugin, so the build
relies on Babel during dev and bundling.