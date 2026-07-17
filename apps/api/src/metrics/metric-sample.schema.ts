import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

class Connections {
  @Prop({ type: Number, required: true })
  current: number;

  @Prop({ type: Number, required: true })
  available: number;
}

class OpCounters {
  @Prop({ type: Number, required: true })
  insert: number;

  @Prop({ type: Number, required: true })
  query: number;

  @Prop({ type: Number, required: true })
  update: number;

  @Prop({ type: Number, required: true })
  delete: number;

  @Prop({ type: Number, required: true })
  command: number;
}

class MemoryMB {
  @Prop({ type: Number, required: true })
  resident: number;

  @Prop({ type: Number, required: true })
  virtual: number;
}

@Schema()
export class MetricSample extends Document {
  @Prop({ required: true, index: true })
  clusterId: string;

  @Prop({ required: true, index: true })
  orgId: string;

  @Prop({ type: Date, default: Date.now, expires: 86400 })
  timestamp: Date;

  @Prop({ type: Connections, required: true })
  connections: Connections;

  @Prop({ type: OpCounters, required: true })
  opCounters: OpCounters;

  @Prop({ type: MemoryMB, required: true })
  memoryMB: MemoryMB;

  @Prop({ type: Number, default: null })
  replicationLagSeconds: number | null;

  @Prop({ type: Number, default: 0 })
  longRunningOps: number;
}

export const MetricSampleSchema = SchemaFactory.createForClass(MetricSample);
