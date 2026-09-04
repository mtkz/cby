import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const PROFILE_MODEL_NAME = 'Profile';

@Schema({
  collection: 'profiles',
  timestamps: true,
  strict: false,
  minimize: false,
})
export class ProfileDocument {
  @Prop({ index: true })
  full_name?: string;

  @Prop({ index: true })
  first_name?: string;

  @Prop({ index: true })
  last_name?: string;

  @Prop()
  linkedin_url?: string;

  @Prop()
  job_title?: string;

  @Prop()
  job_company_name?: string;

  @Prop({ index: true })
  location_country?: string;

  @Prop()
  industry?: string;
}

export type ProfileDocumentType = HydratedDocument<ProfileDocument>;

export const ProfileSchema = SchemaFactory.createForClass(ProfileDocument);

ProfileSchema.index({ full_name: 1 });
ProfileSchema.index({ job_company_name: 1 });