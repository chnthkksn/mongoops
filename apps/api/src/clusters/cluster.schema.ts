import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { randomClusterColor } from './cluster-colors';

export type ClusterTopology = 'standalone' | 'replicaSet';
export type ClusterStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

@Schema({ timestamps: true })
export class Cluster extends Document {
  @Prop({ required: true, index: true })
  orgId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: ['standalone', 'replicaSet'] })
  topology: ClusterTopology;

  @Prop({ required: true })
  encryptedConnectionString: string;

  @Prop({
    required: true,
    enum: ['healthy', 'warning', 'critical', 'unknown'],
    default: 'unknown',
  })
  status: ClusterStatus;

  @Prop({ type: Date, default: null })
  lastCheckedAt: Date | null;

  @Prop({ type: Number, default: null })
  nodeCount: number | null;

  // default backfills a color for documents created before this field
  // existed, via Mongoose's read-time default application — not just new
  // creates (those explicitly set a color in ClustersService.create).
  @Prop({ required: true, default: randomClusterColor })
  color: string;
}

export const ClusterSchema = SchemaFactory.createForClass(Cluster);
