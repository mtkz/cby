import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getErrorMessage } from '../../../common/error.util.js';
import { Profile } from '../domain/profile.entity.js';
import { ProfileRepositoryPort } from '../domain/profile.repository.port.js';
import {
  ProfileSearchPort,
  SearchCriteria,
  SearchResult,
} from '../domain/profile-search.port.js';

export interface SearchResponse {
  data: Profile[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ProfileQueryService {
  constructor(
    private readonly repository: ProfileRepositoryPort,
    private readonly search: ProfileSearchPort,
  ) {}

  async search(criteria: SearchCriteria): Promise<SearchResponse> {
    try {
      const result: SearchResult = await this.search.search(criteria);
      return { ...result, page: criteria.page, limit: criteria.limit };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to search profiles: ${getErrorMessage(error)}`,
      );
    }
  }

  async findOne(id: string): Promise<Profile> {
    if (this.repository.isValidId(id)) {
      const doc = await this.repository.findById(id);
      if (doc) return doc;
      throw new NotFoundException(`Profile with id ${id} not found`);
    }

    try {
      const doc = await this.search.findById(id);
      if (!doc) throw new NotFoundException(`Profile with id ${id} not found`);
      return doc;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(
        `Failed to get profile: ${getErrorMessage(error)}`,
      );
    }
  }

  async getAggregations(field: string) {
    try {
      return await this.search.aggregate(field);
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to get aggregations: ${getErrorMessage(error)}`,
      );
    }
  }
}