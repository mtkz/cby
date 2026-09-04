import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module.js';
import { ProfileCommandService } from './application/profile-command.service.js';
import { ProfileQueryService } from './application/profile-query.service.js';
import { CsvParserPort } from './domain/csv-parser.port.js';
import { ProfileRepositoryPort } from './domain/profile.repository.port.js';
import { ProfileSearchPort } from './domain/profile-search.port.js';
import { CsvProfileParser } from './infrastructure/csv/csv-profile-parser.js';
import { MongoProfileRepository } from './infrastructure/persistence/mongo-profile.repository.js';
import {
  PROFILE_MODEL_NAME,
  ProfileSchema,
} from './infrastructure/persistence/profile.schema.js';
import { ElasticsearchProfileRepository } from './infrastructure/search/elasticsearch-profile.repository.js';
import { ProfileController } from './presentation/profile.controller.js';

@Module({
  imports: [
    ElasticsearchModule,
    MongooseModule.forFeature([
      { name: PROFILE_MODEL_NAME, schema: ProfileSchema },
    ]),
  ],
  controllers: [ProfileController],
  providers: [
    ProfileCommandService,
    ProfileQueryService,
    { provide: ProfileRepositoryPort, useClass: MongoProfileRepository },
    { provide: ProfileSearchPort, useClass: ElasticsearchProfileRepository },
    { provide: CsvParserPort, useClass: CsvProfileParser },
  ],
  exports: [ProfileCommandService, ProfileQueryService],
})
export class ProfileModule {}