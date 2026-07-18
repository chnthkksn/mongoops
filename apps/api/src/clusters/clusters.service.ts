import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoClient } from 'mongodb';
import { Cluster } from './cluster.schema';
import { CreateClusterDto } from './dto/create-cluster.dto';
import { UpdateClusterDto } from './dto/update-cluster.dto';
import { encryptSecret, decryptSecret } from '../common/crypto.util';
import { AuditLogService } from '../audit/audit-log.service';

@Injectable()
export class ClustersService {
  constructor(
    @InjectModel(Cluster.name) private clusterModel: Model<Cluster>,
    private auditLogService: AuditLogService,
  ) {}

  async list(orgId: string) {
    return this.clusterModel.find({ orgId }).sort({ createdAt: -1 }).exec();
  }

  async create(
    orgId: string,
    dto: CreateClusterDto,
    actor: { id: string; name: string },
  ) {
    const cluster = await this.clusterModel.create({
      orgId,
      name: dto.name,
      topology: dto.topology,
      encryptedConnectionString: encryptSecret(dto.connectionString),
      status: 'unknown',
    });

    await this.auditLogService.record({
      orgId,
      actorUserId: actor.id,
      actorName: actor.name,
      action: 'cluster.connected',
      targetLabel: cluster.name,
      metadata: { topology: cluster.topology },
    });

    return cluster;
  }

  async findOne(orgId: string, id: string) {
    const cluster = await this.clusterModel.findOne({ _id: id, orgId }).exec();
    if (!cluster) {
      throw new NotFoundException('Cluster not found');
    }
    return cluster;
  }

  async update(
    orgId: string,
    id: string,
    dto: UpdateClusterDto,
    actor: { id: string; name: string },
  ) {
    const cluster = await this.findOne(orgId, id);

    if (dto.name !== undefined) cluster.name = dto.name;
    if (dto.topology !== undefined) cluster.topology = dto.topology;
    if (dto.connectionString !== undefined) {
      cluster.encryptedConnectionString = encryptSecret(dto.connectionString);
      // A changed connection string points at a potentially different
      // target, so the last-known status/node count can't be trusted
      // until the next test-connection or scheduled metrics poll.
      cluster.status = 'unknown';
      cluster.lastCheckedAt = null;
      cluster.nodeCount = null;
    }
    await cluster.save();

    await this.auditLogService.record({
      orgId,
      actorUserId: actor.id,
      actorName: actor.name,
      action: 'cluster.updated',
      targetLabel: cluster.name,
      metadata: { connectionStringChanged: dto.connectionString !== undefined },
    });

    return cluster;
  }

  async remove(orgId: string, id: string, actor: { id: string; name: string }) {
    const cluster = await this.findOne(orgId, id);
    await this.clusterModel.deleteOne({ _id: id, orgId });

    await this.auditLogService.record({
      orgId,
      actorUserId: actor.id,
      actorName: actor.name,
      action: 'cluster.deleted',
      targetLabel: cluster.name,
    });

    return { ok: true };
  }

  async testConnection(orgId: string, id: string) {
    const cluster = await this.findOne(orgId, id);
    const connectionString = decryptSecret(cluster.encryptedConnectionString);
    const client = new MongoClient(connectionString, {
      serverSelectionTimeoutMS: 5000,
    });

    try {
      await client.connect();
      const admin = client.db().admin();
      const result = await admin.ping();
      const nodeCount = await this.countNodes(client, cluster.topology);

      cluster.status = result.ok === 1 ? 'healthy' : 'warning';
      cluster.lastCheckedAt = new Date();
      cluster.nodeCount = nodeCount;
      await cluster.save();

      return { ok: true, message: 'Connection successful', nodeCount };
    } catch (error) {
      cluster.status = 'critical';
      cluster.lastCheckedAt = new Date();
      await cluster.save();

      const message =
        error instanceof Error ? error.message : 'Connection failed';
      return { ok: false, message };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  private async countNodes(
    client: MongoClient,
    topology: 'standalone' | 'replicaSet',
  ) {
    if (topology === 'standalone') {
      return 1;
    }
    try {
      const status = await client.db().admin().command({ replSetGetStatus: 1 });
      return Array.isArray(status.members) ? status.members.length : 1;
    } catch {
      return 1;
    }
  }
}
