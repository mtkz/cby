import { Profile } from './profile.entity.js';

export abstract class ProfileRepositoryPort {
  abstract isValidId(id: string): boolean;
  abstract create(data: Partial<Profile>): Promise<Profile>;
  abstract bulkCreate(profiles: Partial<Profile>[]): Promise<Profile[]>;
  abstract findById(id: string): Promise<Profile | null>;
  abstract findAll(skip: number, limit: number): Promise<Profile[]>;
  abstract count(): Promise<number>;
  abstract update(id: string, data: Partial<Profile>): Promise<Profile | null>;
  abstract delete(id: string): Promise<Profile | null>;
}