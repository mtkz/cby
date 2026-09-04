import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Profile } from '../../domain/profile.entity.js';
import { ProfileRepositoryPort } from '../../domain/profile.repository.port.js';
import {
  PROFILE_MODEL_NAME,
  ProfileDocument,
} from './profile.schema.js';

@Injectable()
export class MongoProfileRepository implements ProfileRepositoryPort {
  constructor(
    @InjectModel(PROFILE_MODEL_NAME)
    private readonly model: Model<ProfileDocument>,
  ) {}

  isValidId(id: string): boolean {
    return Types.ObjectId.isValid(id);
  }

  async create(data: Partial<Profile>): Promise<Profile> {
    const [doc] = (await this.model.insertMany([data], {
      lean: true,
    })) as Record<string, any>[];
    return this.toDomain(doc);
  }

  async bulkCreate(profiles: Partial<Profile>[]): Promise<Profile[]> {
    const docs = (await this.model.insertMany(profiles, {
      ordered: false,
      lean: true,
    })) as Record<string, any>[];
    return docs.map((doc) => this.toDomain(doc));
  }

  async findById(id: string): Promise<Profile | null> {
    const doc = await this.model.findById(id).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findAll(skip: number, limit: number): Promise<Profile[]> {
    const docs = await this.model.find().skip(skip).limit(limit).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async count(): Promise<number> {
    return this.model.countDocuments();
  }

  async update(id: string, data: Partial<Profile>): Promise<Profile | null> {
    const doc = await this.model.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: false,
      lean: true,
    });
    return doc ? this.toDomain(doc) : null;
  }

  async delete(id: string): Promise<Profile | null> {
    const doc = await this.model.findByIdAndDelete(id).lean();
    return doc ? this.toDomain(doc) : null;
  }

  private toDomain(doc: Record<string, any>): Profile {
    const { _id, __v, createdAt, updatedAt, ...rest } = doc;
    return { id: String(_id), ...rest } as Profile;
  }
}