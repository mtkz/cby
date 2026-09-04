import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfileCommandService } from '../application/profile-command.service.js';
import { ProfileQueryService } from '../application/profile-query.service.js';
import { Profile } from '../domain/profile.entity.js';
import { SearchCriteria } from '../domain/profile-search.port.js';
import { SearchProfileDto } from './dto/search-profile.dto.js';

@Controller('api/profiles')
export class ProfileController {
  constructor(
    private readonly queryService: ProfileQueryService,
    private readonly commandService: ProfileCommandService,
  ) {}

  @Get('search')
  async search(@Query() searchDto: SearchProfileDto) {
    return this.queryService.search(this.toCriteria(searchDto));
  }

  @Get('aggregations/:field')
  async getAggregations(@Param('field') field: string) {
    return this.queryService.getAggregations(field);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.queryService.findOne(id);
  }

  @Post('upload-csv')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadCSV(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Please upload a CSV file');
    }
    return this.commandService.importCsv(file.buffer);
  }

  @Post('reindex')
  @HttpCode(HttpStatus.OK)
  async reindex() {
    return this.commandService.reindexAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: Partial<Profile>) {
    return this.commandService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<Profile>) {
    return this.commandService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.commandService.remove(id);
  }

  private toCriteria(dto: SearchProfileDto): SearchCriteria {
    return {
      q: dto.q,
      page: dto.page ?? 1,
      limit: dto.limit ?? 10,
      sortBy: dto.sort_by ?? '_score',
      sortOrder: dto.sort_order ?? 'desc',
      first_name: dto.first_name,
      last_name: dto.last_name,
      full_name: dto.full_name,
      job_title: dto.job_title,
      job_company_name: dto.job_company_name,
      location_name: dto.location_name,
      location_country: dto.location_country,
      location_region: dto.location_region,
      industry: dto.industry,
      skills: dto.skills,
      min_experience: dto.min_experience,
      max_experience: dto.max_experience,
      min_salary: dto.min_salary,
      max_salary: dto.max_salary,
    };
  }
}