import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Interval } from '@nestjs/schedule';
import { BackupSchedule } from './backup-schedule.schema';
import { CreateBackupScheduleDto } from './dto/create-backup-schedule.dto';
import { UpdateBackupScheduleDto } from './dto/update-backup-schedule.dto';
import { AuditLogService } from '../audit/audit-log.service';
import { BackupRunsService } from './backup-runs.service';

type Actor = { id: string; name: string };

const POLL_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class BackupSchedulesService {
  private readonly logger = new Logger(BackupSchedulesService.name);

  constructor(
    @InjectModel(BackupSchedule.name)
    private backupScheduleModel: Model<BackupSchedule>,
    private auditLogService: AuditLogService,
    private backupRunsService: BackupRunsService,
  ) {}

  async list(orgId: string, clusterId?: string) {
    const filter: Record<string, unknown> = { orgId };
    if (clusterId) filter.clusterId = clusterId;
    return this.backupScheduleModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOne(orgId: string, id: string) {
    const schedule = await this.backupScheduleModel
      .findOne({ _id: id, orgId })
      .exec();
    if (!schedule) {
      throw new NotFoundException('Backup schedule not found');
    }
    return schedule;
  }

  async create(orgId: string, dto: CreateBackupScheduleDto, actor: Actor) {
    const schedule = await this.backupScheduleModel.create({
      orgId,
      clusterId: dto.clusterId,
      storageProviderId: dto.storageProviderId,
      intervalHours: dto.intervalHours,
      enabled: dto.enabled ?? true,
    });

    await this.auditLogService.record({
      orgId,
      actorUserId: actor.id,
      actorName: actor.name,
      action: 'backup_schedule.created',
      targetLabel: `every ${schedule.intervalHours}h`,
      metadata: {
        clusterId: dto.clusterId,
        storageProviderId: dto.storageProviderId,
      },
    });

    return schedule;
  }

  async update(
    orgId: string,
    id: string,
    dto: UpdateBackupScheduleDto,
    actor: Actor,
  ) {
    const schedule = await this.findOne(orgId, id);
    if (dto.intervalHours !== undefined)
      schedule.intervalHours = dto.intervalHours;
    if (dto.enabled !== undefined) schedule.enabled = dto.enabled;
    await schedule.save();

    await this.auditLogService.record({
      orgId,
      actorUserId: actor.id,
      actorName: actor.name,
      action: 'backup_schedule.updated',
      targetLabel: `every ${schedule.intervalHours}h`,
      metadata: { enabled: schedule.enabled },
    });

    return schedule;
  }

  async remove(orgId: string, id: string, actor: Actor) {
    const schedule = await this.findOne(orgId, id);
    await this.backupScheduleModel.deleteOne({ _id: id, orgId });

    await this.auditLogService.record({
      orgId,
      actorUserId: actor.id,
      actorName: actor.name,
      action: 'backup_schedule.deleted',
      targetLabel: `every ${schedule.intervalHours}h`,
    });

    return { ok: true };
  }

  @Interval(POLL_INTERVAL_MS)
  async checkDueSchedules() {
    const schedules = await this.backupScheduleModel
      .find({ enabled: true })
      .exec();
    const now = Date.now();
    const due = schedules.filter((s) => {
      if (!s.lastRunAt) return true;
      return now >= s.lastRunAt.getTime() + s.intervalHours * 3600_000;
    });

    const results = await Promise.allSettled(
      due.map(async (schedule) => {
        const run = await this.backupRunsService.runBackup(
          schedule.orgId,
          schedule.clusterId,
          schedule.storageProviderId,
          'scheduled',
          null,
        );
        schedule.lastRunAt = new Date();
        await schedule.save();
        return run;
      }),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.warn(`Scheduled backup failed: ${String(result.reason)}`);
      }
    }
  }
}
