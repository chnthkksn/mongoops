import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BackupRunStatus = 'running' | 'completed' | 'failed';
export type BackupRunTrigger = 'manual' | 'scheduled';

export class BackupRunCollectionStat {
  @Prop({ required: true })
  dbName: string;

  @Prop({ required: true })
  collName: string;

  @Prop({ required: true })
  documentCount: number;
}

@Schema({ timestamps: true })
export class BackupRun extends Document {
  @Prop({ required: true, index: true })
  orgId: string;

  @Prop({ required: true, index: true })
  clusterId: string;

  @Prop({ required: true })
  storageProviderId: string;

  @Prop({
    required: true,
    enum: ['running', 'completed', 'failed'],
    default: 'running',
  })
  status: BackupRunStatus;

  @Prop({ required: true, enum: ['manual', 'scheduled'], default: 'manual' })
  trigger: BackupRunTrigger;

  @Prop({ required: true })
  startedAt: Date;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  @Prop({ type: Number, default: null })
  durationMs: number | null;

  @Prop({ type: Number, default: null })
  totalSizeBytes: number | null;

  @Prop({ type: [Object], default: [] })
  collections: BackupRunCollectionStat[];

  @Prop({ type: String, default: null })
  objectKeyPrefix: string | null;

  @Prop({ type: String, default: null })
  errorMessage: string | null;

  @Prop({ type: String, default: null })
  bundleKey: string | null;
}

export const BackupRunSchema = SchemaFactory.createForClass(BackupRun);
