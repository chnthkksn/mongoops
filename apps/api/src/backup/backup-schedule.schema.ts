import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class BackupSchedule extends Document {
  @Prop({ required: true, index: true })
  orgId: string;

  @Prop({ required: true })
  clusterId: string;

  @Prop({ required: true })
  storageProviderId: string;

  @Prop({ required: true, min: 1 })
  intervalHours: number;

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ type: Date, default: null })
  lastRunAt: Date | null;
}

export const BackupScheduleSchema =
  SchemaFactory.createForClass(BackupSchedule);
