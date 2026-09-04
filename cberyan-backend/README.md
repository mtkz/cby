# Cyberyan backend

The API for Cyberyan, a LinkedIn-profile search tool. It ingests CSVs of
profiles, keeps them in MongoDB, indexes them into Elasticsearch and serves
search + facet queries to the frontend.

Stack: NestJS 12, MongoDB via Mongoose, Elasticsearch 8 (official client),
csv-parser, class-validator.

There's a sample dataset checked in (`300 user linkedin.txt`) if you want
something to import.

## Architecture

The code follows an **onion architecture** — business logic in the middle,
infrastructure on the outside, and a strict dependency rule: each layer only
ever points inward.

```
src/
├── main.ts                       bootstrap, global ValidationPipe, CORS
├── app.module.ts                 root module
├── common/
│   └── error.util.ts             shared error-message extraction (used everywhere)
└── modules/
    ├── database/                 Mongo connection (MONGO_URI), fail-fast timeout
    ├── elasticsearch/            the ES client singleton (ELASTICSEARCH_URL)
    └── profile/
        ├── profile.module.ts     wires ports → adapters
        ├── domain/               entities and ports — the core, framework-free
        ├── application/          use cases, depend only on the ports
        ├── infrastructure/       Mongo / ES / CSV adapters
        └── presentation/         controller + DTOs
```

### domain/ — what a profile is, and what we can do with it

The innermost layer. `profile.entity.ts` is a plain TypeScript interface with
no Mongoose, no Nest, no HTTP in it. Next to it sit three *ports* — abstract
classes that describe capabilities without saying how they're implemented:

- `ProfileRepositoryPort` — save, bulk-save, load, count, update, delete.
- `ProfileSearchPort` — index documents, search, aggregate, clear, get by id.
- `CsvParserPort` — turn a `Buffer` of CSV into validated profiles.

That's the whole contract of the system.

### application/ — the use cases

Two small services, split by read vs write so neither one grows into a monster:

- `ProfileQueryService` — `search()`, `findOne()`, `getAggregations()`. It
  maps HTTP-free search criteria to results and translates low-level errors
  into proper `NotFoundException` / `BadRequestException` responses.
- `ProfileCommandService` — `create()`, `importCsv()`, `bulkCreate()`,
  `reindexAll()`, `update()`, `remove()`. The write flow is always the same:
  **Mongo first, Elasticsearch best-effort after.**

Neither service imports anything from `infrastructure/` or `presentation/` —
swap the adapters and they keep working.

### infrastructure/ — the actual work

- `persistence/mongo-profile.repository.ts` — implements `ProfileRepositoryPort`
  over Mongoose. Strips Mongo-only fields (`_id`, `__v`, timestamps) and
  returns plain `Profile` objects.
- `search/elasticsearch-profile.repository.ts` — implements
  `ProfileSearchPort`. Owns everything Elasticsearch-specific: the index
  mapping (created on startup if missing), the query building (multi-match,
  term filters, range filters, sort), chunked bulk writes (300 at a time) and
  the aggregation resolution (text fields aggregate on their `.keyword`
  sub-field, keyword/numeric/date fields on the plain name).
- `csv/csv-profile-parser.ts` — implements `CsvParserPort`. Streams the CSV,
  checks every row for alignment, and uses "sentinel" fields (birth year,
  salary, dates, connection counts…) to catch misaligned rows. One bad
  sentinel → the field is dropped and the row counted as repaired; two or
  more → the row is rejected as misaligned, with a human-readable reason and
  a preview of the row.

### presentation/ — the HTTP surface

`profile.controller.ts` is thin: it declares routes, lets the global
ValidationPipe handle the query DTO, and maps the DTO to the domain's
`SearchCriteria` before calling the application layer. `create`/`update`
accept a partial profile body; the Mongo schema is `strict: false` on
purpose, so CSV fields that aren't explicitly declared still persist.

## Why onion here

The old `profile.service.ts` was one ~900-line file that interleaved Mongo
queries, Elasticsearch query DSL, index mappings and CSV validation. It
worked, but it was hard to follow and harder to change. After the split:

- the query service is ~60 lines of orchestration you can read top to bottom;
- the Elasticsearch query DSL lives only in the search adapter;
- the CSV heuristics live only in the parser;
- the persistence details live only in the Mongo adapter.

If Elasticsearch gets replaced, only the search adapter changes. If CSV
format handling changes, only the parser changes. The application layer never
notices.

## Data flow

1. `POST /api/profiles/upload-csv` → controller → `importCsv()` →
   `CsvProfileParser.parse()` → `bulkCreate(valid)` → Mongo
   `insertMany(ordered: false)` → ES chunked `bulk` (using the Mongo `_id`).
2. `GET /api/profiles/search` → controller maps the DTO →
   `ProfileQueryService.search()` → ES query built by the adapter.
3. `GET /api/profiles/aggregations/:field` → resolves the aggregatable field
   name from the live mapping, runs a `terms` aggregation (top 50 buckets).
4. `POST /api/profiles/reindex` → clears the ES index, streams Mongo in
   chunks of 300, re-indexes everything, reports per-error counts.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | hello / health |
| `GET` | `/api/profiles/search` | search with filters, pagination, sorting |
| `GET` | `/api/profiles/aggregations/:field` | facet buckets for a field |
| `GET` | `/api/profiles/:id` | one profile (Mongo id, or legacy ES-only id) |
| `POST` | `/api/profiles/upload-csv` | import a CSV (multipart field `file`) |
| `POST` | `/api/profiles/reindex` | rebuild the ES index from MongoDB |
| `POST` | `/api/profiles` | create one profile |
| `PUT` | `/api/profiles/:id` | update one profile |
| `DELETE` | `/api/profiles/:id` | delete one profile |

Search query params: `q`, `page`, `limit`, `sort_by`, `sort_order`,
`first_name`, `last_name`, `full_name`, `job_title`, `job_company_name`,
`location_name`, `location_country`, `location_region`, `industry`, `skills`,
`min_experience`, `max_experience`, `min_salary`, `max_salary`.

## Environment variables

| Variable | Default | What it is |
| --- | --- | --- |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/cyberyan` | MongoDB connection string |
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Elasticsearch cluster |
| `ELASTICSEARCH_USERNAME` | — | optional basic auth |
| `ELASTICSEARCH_PASSWORD` | — | optional basic auth |
| `PORT` | `3000` | HTTP port |

Copy `.env.example` to `.env` and adjust. The Mongo connection fails fast
(5s timeout) instead of hanging, and the app refuses to start if
Elasticsearch isn't reachable — better a loud startup than silent breakage
later.

## Running

```bash
pnpm install
cp .env.example .env
pnpm start:dev        # watch mode, http://localhost:3000
```

Scripts: `start:dev`, `start:prod`, `build`, `lint` (oxlint), `test`
(vitest), `test:e2e`, `test:cov`, `format` (prettier).