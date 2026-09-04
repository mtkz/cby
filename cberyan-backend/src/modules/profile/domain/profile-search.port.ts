import { Profile } from './profile.entity.js';

export interface SearchCriteria {
  q?: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  first_name?: string;
  last_name?: string;
  full_name?: string;
  job_title?: string;
  job_company_name?: string;
  location_name?: string;
  location_country?: string;
  location_region?: string;
  industry?: string;
  skills?: string[];
  min_experience?: number;
  max_experience?: number;
  min_salary?: number;
  max_salary?: number;
}

export interface SearchResult {
  data: Array<Profile & { score?: number }>;
  total: number;
}

export interface BulkWriteResult {
  indexed: number;
  errors: { reason: string; count: number }[];
}

export interface AggregationBucket {
  key: string;
  doc_count: number;
}

export abstract class ProfileSearchPort {
  abstract ensureIndex(): Promise<void>;
  abstract indexDocument(id: string, doc: Profile): Promise<void>;
  abstract bulkWrite(
    docs: Array<{ id: string; doc: Profile }>,
  ): Promise<BulkWriteResult>;
  abstract search(criteria: SearchCriteria): Promise<SearchResult>;
  abstract aggregate(field: string): Promise<AggregationBucket[]>;
  abstract clear(): Promise<void>;
  abstract findById(id: string): Promise<Profile | null>;
  abstract deleteById(id: string): Promise<void>;
}