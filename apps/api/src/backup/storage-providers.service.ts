import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { StorageProvider } from './storage-provider.schema';
import { BackupRun } from './backup-run.schema';
import { BackupSchedule } from './backup-schedule.schema';
import { CreateStorageProviderDto } from './dto/create-storage-provider.dto';
import { encryptSecret } from '../common/crypto.util';
import { AuditLogService } from '../audit/audit-log.service';
import { buildS3Client } from './s3-client.util';

type Actor = { id: string; name: string };

@Injectable()
export class StorageProvidersService {
  constructor(
    @InjectModel(StorageProvider.name)
    private storageProviderModel: Model<StorageProvider>,
    @InjectModel(BackupRun.name) private backupRunModel: Model<BackupRun>,
    @InjectModel(BackupSchedule.name)
    private backupScheduleModel: Model<BackupSchedule>,
    private auditLogService: AuditLogService,
  ) {}

  async list(orgId: string) {
    await this.ensureDefaultProvider(orgId);
    return this.storageProviderModel
      .find({ orgId })
      .select('-encryptedSecretAccessKey')
      .sort({ createdAt: -1 })
      .exec();
  }

  // Seeds a MinIO/S3 provider from env vars the first time an org has none
  // configured yet, so a self-hosted MinIO instance doesn't need to be
  // re-added through the UI for every org. No-op if the env vars aren't
  // set, or the org already has at least one provider (manually added or
  // previously seeded) — deleting all providers re-triggers seeding.
  private async ensureDefaultProvider(orgId: string) {
    const endpoint = process.env.DEFAULT_STORAGE_ENDPOINT;
    const accessKeyId = process.env.DEFAULT_STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.DEFAULT_STORAGE_SECRET_ACCESS_KEY;
    if (!endpoint || !accessKeyId || !secretAccessKey) return;

    const hasAny = await this.storageProviderModel.exists({ orgId });
    if (hasAny) return;

    try {
      const provider = await this.storageProviderModel.create({
        orgId,
        name: 'Default MinIO',
        endpoint,
        region: process.env.DEFAULT_STORAGE_REGION ?? 'us-east-1',
        bucket: process.env.DEFAULT_STORAGE_BUCKET ?? 'mongoops-backups',
        accessKeyId,
        encryptedSecretAccessKey: encryptSecret(secretAccessKey),
        forcePathStyle:
          process.env.DEFAULT_STORAGE_FORCE_PATH_STYLE !== 'false',
        status: 'unknown',
      });
      await this.auditLogService.record({
        orgId,
        actorUserId: 'system',
        actorName: 'System',
        action: 'storage_provider.created',
        targetLabel: provider.name,
        metadata: { endpoint: provider.endpoint, bucket: provider.bucket },
      });
    } catch {
      // Duplicate-key race between concurrent requests seeding the same
      // org at once — harmless, the other request's insert already won.
    }
  }

  async findOne(orgId: string, id: string) {
    const provider = await this.storageProviderModel
      .findOne({ _id: id, orgId })
      .exec();
    if (!provider) {
      throw new NotFoundException('Storage provider not found');
    }
    return provider;
  }

  async create(orgId: string, dto: CreateStorageProviderDto, actor: Actor) {
    const provider = await this.storageProviderModel.create({
      orgId,
      name: dto.name,
      endpoint: dto.endpoint,
      region: dto.region,
      bucket: dto.bucket,
      accessKeyId: dto.accessKeyId,
      encryptedSecretAccessKey: encryptSecret(dto.secretAccessKey),
      forcePathStyle: dto.forcePathStyle ?? false,
      status: 'unknown',
    });

    await this.auditLogService.record({
      orgId,
      actorUserId: actor.id,
      actorName: actor.name,
      action: 'storage_provider.created',
      targetLabel: provider.name,
      metadata: { endpoint: provider.endpoint, bucket: provider.bucket },
    });

    const obj = provider.toObject() as unknown as Record<string, unknown>;
    delete obj.encryptedSecretAccessKey;
    return obj;
  }

  async remove(orgId: string, id: string, actor: Actor) {
    const provider = await this.findOne(orgId, id);

    const [runCount, scheduleCount] = await Promise.all([
      this.backupRunModel.countDocuments({ orgId, storageProviderId: id }),
      this.backupScheduleModel.countDocuments({
        orgId,
        storageProviderId: id,
      }),
    ]);
    if (runCount > 0 || scheduleCount > 0) {
      throw new BadRequestException(
        'Cannot delete a storage provider that has backup runs or schedules referencing it',
      );
    }

    await this.storageProviderModel.deleteOne({ _id: id, orgId });

    await this.auditLogService.record({
      orgId,
      actorUserId: actor.id,
      actorName: actor.name,
      action: 'storage_provider.deleted',
      targetLabel: provider.name,
    });

    return { ok: true };
  }

  async testConnection(orgId: string, id: string) {
    const provider = await this.findOne(orgId, id);
    const client = buildS3Client(provider);
    try {
      await client.send(new HeadBucketCommand({ Bucket: provider.bucket }));
      provider.status = 'healthy';
      provider.lastCheckedAt = new Date();
      await provider.save();
      return { ok: true, status: provider.status };
    } catch (error) {
      provider.status = 'critical';
      provider.lastCheckedAt = new Date();
      await provider.save();
      return {
        ok: false,
        status: provider.status,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    } finally {
      client.destroy();
    }
  }
}
