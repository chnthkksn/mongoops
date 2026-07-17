import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StorageProviderStatus = 'unknown' | 'healthy' | 'critical';

@Schema({ timestamps: true })
export class StorageProvider extends Document {
  @Prop({ required: true, index: true })
  orgId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  endpoint: string;

  @Prop({ required: true })
  region: string;

  @Prop({ required: true })
  bucket: string;

  @Prop({ required: true })
  accessKeyId: string;

  @Prop({ required: true })
  encryptedSecretAccessKey: string;

  @Prop({ default: false })
  forcePathStyle: boolean;

  @Prop({
    required: true,
    enum: ['unknown', 'healthy', 'critical'],
    default: 'unknown',
  })
  status: StorageProviderStatus;

  @Prop({ type: Date, default: null })
  lastCheckedAt: Date | null;
}

export const StorageProviderSchema =
  SchemaFactory.createForClass(StorageProvider);
