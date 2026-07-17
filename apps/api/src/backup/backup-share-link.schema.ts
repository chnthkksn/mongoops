import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class BackupShareLink extends Document {
  @Prop({ required: true, index: true })
  orgId: string;

  @Prop({ required: true, index: true })
  runId: string;

  @Prop({ required: true })
  clusterId: string;

  @Prop({ required: true, unique: true, index: true })
  token: string;

  @Prop({ required: true })
  actorUserId: string;

  @Prop({ required: true })
  actorName: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  revoked: boolean;

  @Prop({ type: Date, default: null })
  revokedAt: Date | null;
}

export const BackupShareLinkSchema =
  SchemaFactory.createForClass(BackupShareLink);
