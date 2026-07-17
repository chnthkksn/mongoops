import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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

  async listRecent(orgId: string, limit = 50) {
    return this.auditLogModel
      .find({ orgId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}
