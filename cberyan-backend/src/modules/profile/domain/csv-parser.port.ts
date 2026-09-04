import { Profile } from './profile.entity.js';

export interface InvalidRow {
  row: number;
  reason: string;
  preview: string;
}

export interface RepairedRow {
  row: number;
  field: string;
}

export interface ParsedCsv {
  valid: Profile[];
  invalid: InvalidRow[];
  repaired: RepairedRow[];
}

export abstract class CsvParserPort {
  abstract parse(buffer: Buffer): Promise<ParsedCsv>;
}