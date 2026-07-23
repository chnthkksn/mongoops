import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { AuditLog } from './audit-log.schema';

export interface RecordAuditLogInput {
  orgId: string;
  actorUserId: string;
  actorName: string;
  action: string;
  targetLabel: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLog>,
  ) {}

  async record(input: RecordAuditLogInput) {
    await this.auditLogModel.create({
      ...input,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
    });
  }

  async listRecent(
    orgId: string,
    opts: { limit?: number; skip?: number; from?: Date; to?: Date } = {},
  ) {
    const { limit = 50, skip = 0, from, to } = opts;
    const filter: QueryFilter<AuditLog> = { orgId };
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) filter.createdAt.$lte = to;
    }

    const [logs, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditLogModel.countDocuments(filter).exec(),
    ]);

    return { logs, total };
  }
}
