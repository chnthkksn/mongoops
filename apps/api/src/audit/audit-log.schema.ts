import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class AuditLog extends Document {
  @Prop({ required: true, index: true })
  orgId: string;

  @Prop({ required: true })
  actorUserId: string;

  @Prop({ required: true })
  actorName: string;

  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  targetLabel: string;

  @Prop({ type: Object, default: null })
  metadata: Record<string, unknown> | null;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
