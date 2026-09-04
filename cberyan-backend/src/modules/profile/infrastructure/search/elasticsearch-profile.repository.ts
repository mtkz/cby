import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { getErrorMessage } from '../../../../common/error.util.js';
import { ElasticsearchService } from '../../../elasticsearch/elasticsearch.service.js';
import { Profile } from '../../domain/profile.entity.js';
import {
  AggregationBucket,
  BulkWriteResult,
  ProfileSearchPort,
  SearchCriteria,
  SearchResult,
} from '../../domain/profile-search.port.js';

const BULK_CHUNK_SIZE = 300;

@Injectable()
export class ElasticsearchProfileRepository
  implements ProfileSearchPort, OnModuleInit
{
  private readonly logger = new Logger(ElasticsearchProfileRepository.name);
  private readonly index = 'profiles';

  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  private get client(): Client {
    return this.elasticsearchService.getClient();
  }

  async onModuleInit(): Promise<void> {
    await this.ensureIndex();
  }

  async ensureIndex(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ index: this.index });
      if (exists) {
        this.logger.log(`Index '${this.index}' already exists`);
        return;
      }

      await this.client.indices.create({
        index: this.index,
        mappings: { properties: this.mappings },
      });
      this.logger.log(`Index '${this.index}' created successfully`);
    } catch (error) {
      throw new Error(`Failed to create index: ${getErrorMessage(error)}`);
    }
  }

  async indexDocument(id: string, doc: Profile): Promise<void> {
    await this.client.index({
      index: this.index,
      id,
      document: this.toEsPayload(doc),
      refresh: true,
    });
  }

  async bulkWrite(
    docs: Array<{ id: string; doc: Profile }>,
  ): Promise<BulkWriteResult> {
    let indexed = 0;
    const errorCounts: Record<string, number> = {};

    for (let i = 0; i < docs.length; i += BULK_CHUNK_SIZE) {
      const chunk = docs.slice(i, i + BULK_CHUNK_SIZE);
      const operations = chunk.flatMap(({ id, doc }) => [
        { index: { _index: this.index, _id: id } },
        this.toEsPayload(doc),
      ]);

      const result = await this.client.bulk({ operations });

      if (result.errors) {
        for (const item of result.items) {
          const res: any = item.index ?? item.create;
          if (res?.error) {
            const reason = `${res.error.type}: ${String(res.error.reason)
              .replace(/in document.*$/s, '')
              .trim()}`;
            errorCounts[reason] = (errorCounts[reason] || 0) + 1;
          } else {
            indexed++;
          }
        }
      } else {
        indexed += chunk.length;
      }
    }

    if (indexed > 0) {
      await this.client.indices.refresh({ index: this.index });
    }

    return {
      indexed,
      errors: Object.entries(errorCounts).map(([reason, count]) => ({
        reason,
        count,
      })),
    };
  }

  async search(criteria: SearchCriteria): Promise<SearchResult> {
    const {
      q = '',
      page = 1,
      limit = 10,
      sortBy = '_score',
      sortOrder = 'desc',
    } = criteria;

    const mustQueries: any[] = [];

    if (q) {
      mustQueries.push({
        multi_match: {
          query: q,
          fields: [
            'full_name^3',
            'first_name^2',
            'last_name^2',
            'job_title^3',
            'job_company_name^2',
            'summary',
            'skills',
            'industry',
            'location_name',
          ],
          fuzziness: 'AUTO',
        },
      });
    }

    if (criteria.first_name) {
      mustQueries.push({ match: { first_name: criteria.first_name } });
    }
    if (criteria.last_name) {
      mustQueries.push({ match: { last_name: criteria.last_name } });
    }
    if (criteria.full_name) {
      mustQueries.push({ match: { full_name: criteria.full_name } });
    }
    if (criteria.job_title) {
      mustQueries.push({ match: { job_title: criteria.job_title } });
    }
    if (criteria.job_company_name) {
      mustQueries.push({
        match: { job_company_name: criteria.job_company_name },
      });
    }
    if (criteria.location_name) {
      mustQueries.push({ match: { location_name: criteria.location_name } });
    }
    if (criteria.location_country) {
      mustQueries.push({ term: { location_country: criteria.location_country } });
    }
    if (criteria.location_region) {
      mustQueries.push({ term: { location_region: criteria.location_region } });
    }
    if (criteria.industry) {
      mustQueries.push({ match: { industry: criteria.industry } });
    }
    if (criteria.skills && criteria.skills.length > 0) {
      mustQueries.push({ terms: { skills: criteria.skills } });
    }

    const filterQueries: any[] = [];
    if (
      criteria.min_experience !== undefined ||
      criteria.max_experience !== undefined
    ) {
      const range: Record<string, number> = {};
      if (criteria.min_experience !== undefined) {
        range.gte = criteria.min_experience;
      }
      if (criteria.max_experience !== undefined) {
        range.lte = criteria.max_experience;
      }
      filterQueries.push({ range: { inferred_years_experience: range } });
    }

    if (criteria.min_salary !== undefined || criteria.max_salary !== undefined) {
      const range: Record<string, number> = {};
      if (criteria.min_salary !== undefined) {
        range.gte = criteria.min_salary;
      }
      if (criteria.max_salary !== undefined) {
        range.lte = criteria.max_salary;
      }
      filterQueries.push({ range: { inferred_salary: range } });
    }

    const finalQuery =
      mustQueries.length === 0 && filterQueries.length === 0
        ? { match_all: {} }
        : {
            bool: {
              must: mustQueries.length > 0 ? mustQueries : undefined,
              filter: filterQueries.length > 0 ? filterQueries : undefined,
            },
          };

    const sort: any[] = [];
    if (sortBy === '_score') {
      sort.push({ _score: { order: sortOrder } });
    } else {
      sort.push({ [`${sortBy}.keyword`]: { order: sortOrder } });
    }

    const result = await this.client.search({
      index: this.index,
      from: (page - 1) * limit,
      size: limit,
      query: finalQuery,
      sort,
    });

    const hits = result.hits;
    const data: Array<Profile & { score?: number }> =
      hits?.hits?.map((hit: any) => {
        const source =
          hit._source && typeof hit._source === 'object' ? hit._source : {};
        const profile: Profile & { score?: number } = { id: hit._id };
        if (hit._score !== undefined) {
          profile.score = hit._score;
        }
        Object.assign(profile, source);
        return profile;
      }) ?? [];

    return { data, total: this.totalFromHits(hits) };
  }

  async aggregate(field: string): Promise<AggregationBucket[]> {
    const aggField = await this.resolveAggField(field);
    if (!aggField) return [];

    const result = await this.client.search({
      index: this.index,
      size: 0,
      aggs: {
        aggregations: {
          terms: { field: aggField, size: 50 },
        },
      },
    });

    const aggregations = result.aggregations as any;
    if (aggregations?.aggregations?.buckets) {
      return aggregations.aggregations.buckets as AggregationBucket[];
    }
    return [];
  }

  async clear(): Promise<void> {
    await this.client.deleteByQuery({
      index: this.index,
      query: { match_all: {} },
      conflicts: 'proceed',
      refresh: true,
    });
  }

  async findById(id: string): Promise<Profile | null> {
    try {
      const result = await this.client.get({ index: this.index, id });
      const source =
        result._source && typeof result._source === 'object'
          ? result._source
          : {};
      return { id: result._id, ...source } as Profile;
    } catch (error) {
      const meta = this.errorMeta(error);
      if (meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async deleteById(id: string): Promise<void> {
    await this.client.delete({ index: this.index, id, refresh: true });
  }

  private toEsPayload(doc: Profile): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(doc).filter(([key]) => key !== 'id'),
    );
  }

  private totalFromHits(hits: any): number {
    if (!hits || !hits.total) return 0;
    if (typeof hits.total === 'number') return hits.total;
    if (typeof hits.total === 'object' && hits.total !== null) {
      return hits.total.value || 0;
    }
    return 0;
  }

  private errorMeta(error: unknown): any {
    if (error && typeof error === 'object' && 'meta' in error) {
      return (error as any).meta;
    }
    return null;
  }

  private async resolveAggField(field: string): Promise<string | null> {
    const mapping = (await this.client.indices.getMapping({
      index: this.index,
    })) as any;
    const props =
      mapping?.[this.index]?.mappings?.properties ??
      mapping?.mappings?.properties ??
      {};
    const def = props[field];
    if (!def) return null;
    if (def.type && def.type !== 'text') return field;
    return def.fields?.keyword ? `${field}.keyword` : null;
  }

  private readonly mappings: Record<string, any> = {
    properties: {
      full_name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      first_name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      last_name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      gender: { type: 'keyword' },
      industry: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      job_title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      job_title_role: {
        type: 'text',
        fields: { keyword: { type: 'keyword' } },
      },
      job_title_levels: { type: 'text' },
      job_company_name: {
        type: 'text',
        fields: { keyword: { type: 'keyword' } },
      },
      job_company_industry: {
        type: 'text',
        fields: { keyword: { type: 'keyword' } },
      },
      job_company_location_country: { type: 'keyword' },
      job_company_location_region: { type: 'keyword' },
      location_name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      location_country: { type: 'keyword' },
      location_region: { type: 'keyword' },
      linkedin_connections: { type: 'integer' },
      inferred_salary: { type: 'integer' },
      inferred_years_experience: { type: 'integer' },
      summary: { type: 'text' },
      skills: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      emails: { type: 'keyword' },
      phone_numbers: { type: 'keyword' },
      work_email: { type: 'keyword' },
      languages: { type: 'keyword' },
      version_status: { type: 'keyword' },
      birth_year: { type: 'integer' },
      birth_date: { type: 'date' },
      job_start_date: { type: 'date' },
      job_last_updated: { type: 'date' },
      location_last_updated: { type: 'date' },
      twitter_username: { type: 'keyword' },
      github_username: { type: 'keyword' },
    },
  };
}