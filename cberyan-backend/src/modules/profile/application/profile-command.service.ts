import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getErrorMessage } from '../../../common/error.util.js';
import { Profile } from '../domain/profile.entity.js';
import { CsvParserPort } from '../domain/csv-parser.port.js';
import { ProfileRepositoryPort } from '../domain/profile.repository.port.js';
import { ProfileSearchPort } from '../domain/profile-search.port.js';

export interface BulkCreateResponse {
  message: string;
  stored: number;
  indexed: number;
  failed: number;
  errors: { reason: string; count: number }[];
}

export interface ImportCsvResponse extends BulkCreateResponse {
  invalidRows: { row: number; reason: string; preview: string }[];
  invalidCount: number;
  repairedCount: number;
}

export interface ReindexResponse {
  message: string;
  total: number;
  indexed: number;
  failed: number;
  errors: { reason: string; count: number }[];
}

@Injectable()
export class ProfileCommandService {
  constructor(
    private readonly repository: ProfileRepositoryPort,
    private readonly search: ProfileSearchPort,
    private readonly csvParser: CsvParserPort,
  ) {}

  async create(data: Partial<Profile>): Promise<Profile> {
    try {
      const saved = await this.repository.create(data);
      await this.search.indexDocument(saved.id!, this.withoutId(saved));
      return saved;
    } catch (error) {
      throw new BadRequestException(
        `Failed to create profile: ${getErrorMessage(error)}`,
      );
    }
  }

  async importCsv(buffer: Buffer): Promise<ImportCsvResponse> {
    const { valid, invalid, repaired } = await this.csvParser.parse(buffer);
    const result = await this.bulkCreate(valid);
    return {
      ...result,
      invalidRows: invalid,
      invalidCount: invalid.length,
      repairedCount: repaired.length,
    };
  }

  async bulkCreate(profiles: Profile[]): Promise<BulkCreateResponse> {
    let stored: Profile[] = [];
    try {
      stored = await this.repository.bulkCreate(profiles);
    } catch (error) {
      throw new BadRequestException(
        `Failed to store profiles in MongoDB: ${getErrorMessage(error)}`,
      );
    }

    let indexed = 0;
    let errors: { reason: string; count: number }[] = [];
    try {
      const result = await this.search.bulkWrite(
        stored.map((doc) => ({ id: doc.id!, doc: this.withoutId(doc) })),
      );
      indexed = result.indexed;
      errors = result.errors;
    } catch (error) {
      throw new BadRequestException(
        `Failed to index profiles into Elasticsearch (MongoDB data is safe, use POST /api/profiles/reindex): ${getErrorMessage(error)}`,
      );
    }

    const failed = stored.length - indexed;
    return {
      message:
        failed > 0
          ? `Stored ${stored.length} profiles in MongoDB; indexed ${indexed} into Elasticsearch; ${failed} failed (see "errors")`
          : `Successfully stored ${stored.length} profiles in MongoDB and indexed ${indexed} into Elasticsearch`,
      stored: stored.length,
      indexed,
      failed,
      errors: this.formatErrors(errors),
    };
  }

  async reindexAll(): Promise<ReindexResponse> {
    const total = await this.repository.count();
    await this.search.clear();

    const CHUNK = 300;
    let indexed = 0;
    const errorCounts: Record<string, number> = {};
    for (let skip = 0; skip < total; skip += CHUNK) {
      const docs = await this.repository.findAll(skip, CHUNK);
      if (docs.length === 0) break;

      const result = await this.search.bulkWrite(
        docs.map((doc) => ({ id: doc.id!, doc: this.withoutId(doc) })),
      );
      indexed += result.indexed;
      for (const err of result.errors) {
        errorCounts[err.reason] = (errorCounts[err.reason] || 0) + err.count;
      }
    }

    const failed = total - indexed;
    return {
      message: `Reindexed ${indexed} of ${total} MongoDB profiles into Elasticsearch`,
      total,
      indexed,
      failed,
      errors: this.formatErrors(
        Object.entries(errorCounts).map(([reason, count]) => ({
          reason,
          count,
        })),
      ),
    };
  }

  async update(id: string, data: Partial<Profile>): Promise<Profile> {
    if (!this.repository.isValidId(id)) {
      throw new BadRequestException(
        'id is not a MongoDB ObjectId; legacy ES-only profiles cannot be updated',
      );
    }

    const updated = await this.repository.update(id, data);
    if (!updated) {
      throw new NotFoundException(`Profile with id ${id} not found`);
    }

    await this.search
      .indexDocument(id, this.withoutId(updated))
      .catch(() => undefined);

    return updated;
  }

  async remove(id: string): Promise<{ deleted: true; id: string }> {
    if (!this.repository.isValidId(id)) {
      throw new BadRequestException(
        'id is not a MongoDB ObjectId; legacy ES-only profiles cannot be deleted',
      );
    }

    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Profile with id ${id} not found`);
    }

    await this.search.deleteById(id).catch(() => undefined);

    return { deleted: true, id };
  }

  private withoutId(profile: Profile): Profile {
    const { id: _id, ...rest } = profile;
    return rest as Profile;
  }

  private formatErrors(
    errors: { reason: string; count: number }[],
  ): { reason: string; count: number }[] {
    return errors.sort((a, b) => b.count - a.count).slice(0, 20);
  }
}