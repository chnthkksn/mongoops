import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoClient } from 'mongodb';
import { Cluster } from './cluster.schema';
import { CreateClusterDto } from './dto/create-cluster.dto';
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
