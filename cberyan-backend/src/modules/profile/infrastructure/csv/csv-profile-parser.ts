import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import csv from 'csv-parser';
import { Profile } from '../../domain/profile.entity.js';
import {
  CsvParserPort,
  InvalidRow,
  ParsedCsv,
  RepairedRow,
} from '../../domain/csv-parser.port.js';

@Injectable()
export class CsvProfileParser implements CsvParserPort {
  private static readonly SENTINEL_FIELDS = [
    'birth_year',
    'job_company_founded',
    'linkedin_connections',
    'inferred_years_experience',
    'inferred_salary',
    'job_last_updated',
    'job_start_date',
    'location_last_updated',
    'birth_date',
  ] as const;

  private static readonly CURRENT_YEAR = new Date().getFullYear();

  parse(buffer: Buffer): Promise<ParsedCsv> {
    return new Promise((resolve, reject) => {
      const valid: Profile[] = [];
      const invalid: InvalidRow[] = [];
      const repaired: RepairedRow[] = [];
      let headerCount = 0;
      let rowNumber = 1;

      const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
      const stream = Readable.from(text);

      stream
        .pipe(
          csv({
            columns: true,
            trim: true,
            skip_empty_lines: true,
          } as any),
        )
        .on('headers', (headers: string[]) => {
          headerCount = headers.length;
        })
        .on('data', (data: any) => {
          rowNumber++;
          const preview = String(data.full_name ?? '').slice(0, 80);

          const keys = Object.keys(data);
          const hasExtraKeys = keys.some((k) => /^_\d+$/.test(k));
          if (
            headerCount > 0 &&
            (hasExtraKeys || keys.length !== headerCount)
          ) {
            invalid.push({
              row: rowNumber,
              reason: `expected ${headerCount} columns, got ${keys.length}${
                hasExtraKeys ? ' (extra unnamed columns)' : ''
              }`,
              preview,
            });
            return;
          }

          const bad = CsvProfileParser.SENTINEL_FIELDS.filter((field) =>
            this.isImplausible(field, data[field]),
          );
          if (bad.length >= 2) {
            invalid.push({
              row: rowNumber,
              reason: `misaligned row: implausible values in [${bad.join(', ')}]`,
              preview,
            });
            return;
          }
          if (bad.length === 1) {
            data[bad[0]] = '';
            repaired.push({ row: rowNumber, field: bad[0] });
          }

          valid.push(this.transformRow(data));
        })
        .on('end', () => {
          resolve({ valid, invalid, repaired });
        })
        .on('error', reject);
    });
  }

  private isImplausible(field: string, raw: unknown): boolean {
    let value = String(raw ?? '').trim();
    if (!value) return false;
    if (/^\d+\.0$/.test(value)) value = value.slice(0, -2);

    switch (field) {
      case 'birth_year': {
        if (!/^\d{1,4}$/.test(value)) return true;
        const n = parseInt(value, 10);
        return n < 1900 || n > CsvProfileParser.CURRENT_YEAR;
      }
      case 'job_company_founded': {
        if (!/^\d{1,4}$/.test(value)) return true;
        const n = parseInt(value, 10);
        return n < 1600 || n > CsvProfileParser.CURRENT_YEAR;
      }
      case 'linkedin_connections': {
        if (!/^\d+$/.test(value)) return true;
        return value.replace(/^0+/, '').length > 9;
      }
      case 'inferred_years_experience': {
        if (!/^\d+$/.test(value)) return true;
        return parseInt(value, 10) > 60;
      }
      case 'inferred_salary': {
        const cleaned = value.replace(/[,\s]/g, '');
        if (!/^\d+(-\d+)?$/.test(cleaned)) return true;
        const max = Math.max(
          ...cleaned.split('-').map((part) => parseInt(part, 10) || 0),
        );
        return max > 100_000_000;
      }
      case 'job_last_updated':
      case 'job_start_date':
      case 'location_last_updated':
      case 'birth_date': {
        const d = new Date(value);
        if (isNaN(d.getTime())) return true;
        const year = d.getUTCFullYear();
        return year < 1900 || year > CsvProfileParser.CURRENT_YEAR + 2;
      }
      default:
        return false;
    }
  }

  private transformRow(row: any): Profile {
    return {
      full_name: row.full_name || row.fullname || row.name || '',
      first_name: row.first_name || row.firstname || row.first || '',
      last_name: row.last_name || row.lastname || row.last || '',
      gender: row.gender || row.sex || '',
      linkedin_url: row.linkedin_url || row.linkedin || '',
      linkedin_username: row.linkedin_username || '',
      linkedin_id: row.linkedin_id || '',
      facebook_url: row.facebook_url || row.facebook || '',
      facebook_username: row.facebook_username || '',
      facebook_id: row.facebook_id || '',
      industry: row.industry || '',
      job_title: row.job_title || row.jobtitle || row.title || '',
      job_title_role: row.job_title_role || row.role || '',
      job_title_levels: row.job_title_levels || row.level || '',
      job_company_id: row.job_company_id || '',
      job_company_name:
        row.job_company_name || row.company || row.company_name || '',
      job_company_website: row.job_company_website || row.website || '',
      job_company_size: row.job_company_size || row.company_size || '',
      job_company_founded: parseInt(row.job_company_founded) || undefined,
      job_company_industry:
        row.job_company_industry || row.company_industry || '',
      job_company_linkedin_url: row.job_company_linkedin_url || '',
      job_company_linkedin_id: row.job_company_linkedin_id || '',
      job_company_facebook_url: row.job_company_facebook_url || '',
      job_company_twitter_url: row.job_company_twitter_url || '',
      job_company_location_name: row.job_company_location_name || '',
      job_company_location_locality: row.job_company_location_locality || '',
      job_company_location_metro: row.job_company_location_metro || '',
      job_company_location_region:
        row.job_company_location_region || row.region || '',
      job_company_location_geo: row.job_company_location_geo || '',
      job_company_location_country:
        row.job_company_location_country || row.country || '',
      job_company_location_continent:
        row.job_company_location_continent || row.continent || '',
      job_last_updated: row.job_last_updated
        ? new Date(row.job_last_updated)
        : undefined,
      job_start_date: row.job_start_date
        ? new Date(row.job_start_date)
        : undefined,
      location_name: row.location_name || row.location || '',
      location_locality: row.location_locality || '',
      location_metro: row.location_metro || '',
      location_region: row.location_region || '',
      location_country: row.location_country || '',
      location_continent: row.location_continent || '',
      location_geo: row.location_geo || '',
      location_last_updated: row.location_last_updated
        ? new Date(row.location_last_updated)
        : undefined,
      linkedin_connections: parseInt(row.linkedin_connections) || undefined,
      inferred_salary:
        parseInt(row.inferred_salary) || parseInt(row.salary) || undefined,
      inferred_years_experience:
        parseInt(row.inferred_years_experience) ||
        parseInt(row.experience) ||
        parseInt(row.years_experience) ||
        undefined,
      summary: row.summary || row.bio || '',
      phone_numbers: row.phone_numbers
        ? row.phone_numbers.split(',').map((s: string) => s.trim())
        : undefined,
      emails:
        row.emails || row.email
          ? (row.emails || row.email).split(',').map((s: string) => s.trim())
          : undefined,
      interests: row.interests
        ? row.interests.split(',').map((s: string) => s.trim())
        : undefined,
      skills: row.skills
        ? row.skills.split(',').map((s: string) => s.trim())
        : undefined,
      location_names: row.location_names
        ? row.location_names.split(',').map((s: string) => s.trim())
        : undefined,
      regions: row.regions
        ? row.regions.split(',').map((s: string) => s.trim())
        : undefined,
      countries: row.countries
        ? row.countries.split(',').map((s: string) => s.trim())
        : undefined,
      street_addresses: row.street_addresses
        ? row.street_addresses.split(',').map((s: string) => s.trim())
        : undefined,
      languages: row.languages
        ? row.languages.split(',').map((s: string) => s.trim())
        : undefined,
      version_status: row.version_status || '',
      work_email: row.work_email || row.email || '',
      job_company_location_street_address:
        row.job_company_location_street_address || '',
      job_company_location_postal_code:
        row.job_company_location_postal_code || '',
      job_summary: row.job_summary || '',
      location_street_address: row.location_street_address || '',
      location_postal_code: row.location_postal_code || '',
      middle_initial: row.middle_initial || '',
      middle_name: row.middle_name || '',
      birth_year: parseInt(row.birth_year) || undefined,
      birth_date: row.birth_date ? new Date(row.birth_date) : undefined,
      twitter_url: row.twitter_url || row.twitter || '',
      twitter_username: row.twitter_username || '',
      github_url: row.github_url || row.github || '',
      github_username: row.github_username || '',
      mobile_phone: row.mobile_phone || row.phone || '',
      location_address_line_2: row.location_address_line_2 || '',
      job_title_sub_role: row.job_title_sub_role || '',
      job_company_location_address_line_2:
        row.job_company_location_address_line_2 || '',
    };
  }
}