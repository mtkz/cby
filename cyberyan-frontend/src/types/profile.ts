export interface Profile {
  id: string
  full_name?: string
  first_name?: string
  last_name?: string
  gender?: string
  job_title?: string
  job_company_name?: string
  job_company_industry?: string
  location_name?: string
  location_country?: string
  linkedin_url?: string
  linkedin_connections?: number
  inferred_salary?: number
  inferred_years_experience?: number
  summary?: string
  [key: string]: unknown
}

export interface SearchResponse {
  data: Profile[]
  total: number
  page: number
  limit: number
}

export interface InvalidRow {
  row: number
  reason: string
  preview: string
}

export interface UploadResult {
  message: string
  stored: number
  indexed: number
  failed: number
  errors: { reason: string; count: number }[]
  invalidRows: InvalidRow[]
  invalidCount: number
  repairedCount: number
}

export interface AggregationBucket {
  key: string
  doc_count: number
}

export interface ProfileFilters {
  [key: string]: string | undefined
}