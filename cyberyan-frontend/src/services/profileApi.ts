import type {
  AggregationBucket,
  ProfileFilters,
  SearchResponse,
  UploadResult,
} from '../types/profile'

const BASE: string = import.meta.env.VITE_API_BASE_URL ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { message?: string | string[] }
      | null
    const detail =
      typeof body?.message === 'string'
        ? body.message
        : Array.isArray(body?.message)
          ? body.message.join('; ')
          : res.statusText
    throw new Error(`${res.status} — ${detail}`)
  }
  return (await res.json()) as T
}

export function getAggregation(field: string): Promise<AggregationBucket[]> {
  return request<AggregationBucket[]>(
    `/api/profiles/aggregations/${encodeURIComponent(field)}`,
  )
}

export function searchProfiles(params: {
  q?: string
  page?: number
  limit?: number
  filters?: ProfileFilters
}): Promise<SearchResponse> {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  query.set('page', String(params.page ?? 1))
  query.set('limit', String(params.limit ?? 10))
  for (const [key, value] of Object.entries(params.filters ?? {})) {
    if (value) query.set(key, value)
  }
  return request<SearchResponse>(`/api/profiles/search?${query}`)
}

export function uploadCsv(file: File): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  return request<UploadResult>('/api/profiles/upload-csv', {
    method: 'POST',
    body: form,
  })
}