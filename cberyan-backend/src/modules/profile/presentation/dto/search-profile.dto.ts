import { IsOptional, IsString, IsNumber, IsArray, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchProfileDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  job_title?: string;

  @IsOptional()
  @IsString()
  job_company_name?: string;

  @IsOptional()
  @IsString()
  location_name?: string;

  @IsOptional()
  @IsString()
  location_country?: string;

  @IsOptional()
  @IsString()
  location_region?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_experience?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(100)
  max_experience?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_salary?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(1000000)
  max_salary?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @IsOptional()
  @IsString()
  @IsIn(['_score', 'full_name', 'job_title', 'job_company_name', 'inferred_salary', 'inferred_years_experience'])
  sort_by: string = '_score';

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sort_order: 'asc' | 'desc' = 'desc';
}