import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BackupShareLink } from './backup-share-link.schema';
import { AuditLogService } from '../audit/audit-log.service';
import { BackupRunsService } from './backup-runs.service';
import { buildS3Client } from './s3-client.util';

type Actor = { id: string; name: string };
type LinkStatus = 'active' | 'expired' | 'revoked';

const RESOLVE_URL_TTL_SECONDS = 60;

function computeStatus(link: BackupShareLink): LinkStatus {
  if (link.revoked) return 'revoked';
  if (Date.now() > link.expiresAt.getTime()) return 'expired';
  return 'active';
}

function buildPublicUrl(token: string): string {
  const base = process.env.AUTH_BASE_URL ?? 'http://localhost:3001';
  return `${base}/public/backup-shares/${token}`;
}

@Injectable()
export class BackupShareLinksService {
  constructor(
    @InjectModel(BackupShareLink.name)
    private backupShareLinkModel: Model<BackupShareLink>,
    private auditLogService: AuditLogService,
    private backupRunsService: BackupRunsService,
  ) {}

  async createLink(
    orgId: string,
    runId: string,
    actor: Actor,
    expiresInSeconds: number,
  ) {
    const { run } = await this.backupRunsService.getOrCreateBundle(
      orgId,
      runId,
    );

    const token = randomBytes(24).toString('hex');
    const link = await this.backupShareLinkModel.create({
      orgId,
      runId,
      clusterId: run.clusterId,
      token,
      actorUserId: actor.id,
      actorName: actor.name,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    });

    await this.auditLogService.record({
      orgId,
      actorUserId: actor.id,
      actorName: actor.name,
      action: 'backup.share_link_created',
      targetLabel: run.clusterId,
      metadata: { runId, expiresInSeconds },
    });

    return {
      ...link.toObject(),
      url: buildPublicUrl(token),
      status: computeStatus(link),
    };
  }

  async listLinks(orgId: string, clusterId?: string) {
    const filter: Record<string, unknown> = { orgId };
    if (clusterId) filter.clusterId = clusterId;
    const links = await this.backupShareLinkModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();
    return links.map((link) => ({
      ...link.toObject(),
      url: buildPublicUrl(link.token),
      status: computeStatus(link),
    }));
  }

  async revokeLink(orgId: string, linkId: string, actor: Actor) {
    const link = await this.backupShareLinkModel
      .findOne({ _id: linkId, orgId })
      .exec();
    if (!link) {
      throw new NotFoundException('Share link not found');
    }
    link.revoked = true;
    link.revokedAt = new Date();
    await link.save();

    await this.auditLogService.record({
      orgId,
      actorUserId: actor.id,
      actorName: actor.name,
      action: 'backup.share_link_revoked',
      targetLabel: link.clusterId,
      metadata: { runId: link.runId, linkId },
    });

    return { ok: true };
  }

  async resolveToken(token: string): Promise<string> {
    const link = await this.backupShareLinkModel.findOne({ token }).exec();
    if (!link) {
      throw new NotFoundException('Link not found');
    }
    if (link.revoked) {
      throw new GoneException('This link has been revoked');
    }
    if (Date.now() > link.expiresAt.getTime()) {
      throw new GoneException('This link has expired');
    }

    const { provider, bucket, key } =
      await this.backupRunsService.getOrCreateBundle(link.orgId, link.runId);
    const s3 = buildS3Client(provider);
    try {
      return await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: RESOLVE_URL_TTL_SECONDS },
      );
    } finally {
      s3.destroy();
    }
  }
}
