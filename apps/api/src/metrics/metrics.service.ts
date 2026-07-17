import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { MongoClient } from 'mongodb';
import { Cluster } from '../clusters/cluster.schema';
import { MetricSample } from './metric-sample.schema';
import { decryptSecret } from '../common/crypto.util';

const LONG_RUNNING_THRESHOLD_SECONDS = 5;

interface ServerStatusResult {
  connections?: { current?: number; available?: number };
  opcounters?: {
    insert?: number;
    query?: number;
    update?: number;
    delete?: number;
    command?: number;
  };
  mem?: { resident?: number; virtual?: number };
}

interface ReplSetMember {
  stateStr?: string;
  optimeDate?: Date;
}

interface ReplSetStatusResult {
  members?: ReplSetMember[];
}

interface CurrentOpResult {
  inprog?: unknown[];
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @InjectModel(Cluster.name) private clusterModel: Model<Cluster>,
    @InjectModel(MetricSample.name)
    private metricSampleModel: Model<MetricSample>,
  ) {}

  @Interval(30_000)
  async collectAll() {
    const clusters = await this.clusterModel.find().exec();
    const results = await Promise.allSettled(
      clusters.map((cluster) => this.sampleCluster(cluster)),
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.warn(`Metric collection failed: ${String(result.reason)}`);
      }
    }
  }

  async sampleCluster(cluster: Cluster): Promise<MetricSample | null> {
    const connectionString = decryptSecret(cluster.encryptedConnectionString);
    const client = new MongoClient(connectionString, {
      serverSelectionTimeoutMS: 5000,
    });

    try {
      await client.connect();
      const admin = client.db().admin();
      const serverStatus = (await admin.serverStatus()) as ServerStatusResult;

      const replicationLagSeconds =
        cluster.topology === 'replicaSet'
          ? await this.computeReplicationLag(client)
          : null;
      const longRunningOps = await this.countLongRunningOps(client);
      const nodeCount =
        cluster.topology === 'replicaSet'
          ? await this.countReplicaSetMembers(client)
          : 1;

      const sample = await this.metricSampleModel.create({
        clusterId: String(cluster._id),
        orgId: cluster.orgId,
        timestamp: new Date(),
        connections: {
          current: serverStatus.connections?.current ?? 0,
          available: serverStatus.connections?.available ?? 0,
        },
        opCounters: {
          insert: serverStatus.opcounters?.insert ?? 0,
          query: serverStatus.opcounters?.query ?? 0,
          update: serverStatus.opcounters?.update ?? 0,
          delete: serverStatus.opcounters?.delete ?? 0,
          command: serverStatus.opcounters?.command ?? 0,
        },
        memoryMB: {
          resident: serverStatus.mem?.resident ?? 0,
          virtual: serverStatus.mem?.virtual ?? 0,
        },
        replicationLagSeconds,
        longRunningOps,
      });

      cluster.status = 'healthy';
      cluster.lastCheckedAt = new Date();
      cluster.nodeCount = nodeCount;
      await cluster.save();

      return sample;
    } catch (error) {
      cluster.status = 'critical';
      cluster.lastCheckedAt = new Date();
      await cluster.save();
      this.logger.warn(
        `Failed to sample cluster ${String(cluster._id)}: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async getRecentSamples(orgId: string, clusterId: string, limit = 60) {
    const cluster = await this.clusterModel
      .findOne({ _id: clusterId, orgId })
      .exec();
    if (!cluster) {
      throw new NotFoundException('Cluster not found');
    }

    const samples = await this.metricSampleModel
      .find({ clusterId, orgId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
    samples.reverse();

    return samples.map((sample, index) => {
      const previous = index > 0 ? samples[index - 1] : null;
      const intervalSeconds = previous
        ? Math.max(
            1,
            (sample.timestamp.getTime() - previous.timestamp.getTime()) / 1000,
          )
        : null;

      const throughput =
        previous && intervalSeconds
          ? {
              insertsPerSec: rate(
                sample.opCounters.insert,
                previous.opCounters.insert,
                intervalSeconds,
              ),
              queriesPerSec: rate(
                sample.opCounters.query,
                previous.opCounters.query,
                intervalSeconds,
              ),
              updatesPerSec: rate(
                sample.opCounters.update,
                previous.opCounters.update,
                intervalSeconds,
              ),
              deletesPerSec: rate(
                sample.opCounters.delete,
                previous.opCounters.delete,
                intervalSeconds,
              ),
            }
          : null;

      return {
        timestamp: sample.timestamp,
        connections: sample.connections,
        memoryMB: sample.memoryMB,
        replicationLagSeconds: sample.replicationLagSeconds,
        longRunningOps: sample.longRunningOps,
        throughput,
      };
    });
  }

  private async computeReplicationLag(
    client: MongoClient,
  ): Promise<number | null> {
    try {
      const status = (await client
        .db()
        .admin()
        .command({ replSetGetStatus: 1 })) as ReplSetStatusResult;
      const members = status.members ?? [];
      const primary = members.find((m) => m.stateStr === 'PRIMARY');
      if (!primary?.optimeDate) {
        return null;
      }
      const secondaries = members.filter(
        (m): m is ReplSetMember & { optimeDate: Date } =>
          m.stateStr === 'SECONDARY' && m.optimeDate !== undefined,
      );
      if (secondaries.length === 0) {
        return 0;
      }
      const primaryOptimeMs = primary.optimeDate.getTime();
      const lags = secondaries.map(
        (m) => (primaryOptimeMs - m.optimeDate.getTime()) / 1000,
      );
      return Math.max(0, Math.max(...lags));
    } catch {
      return null;
    }
  }

  private async countReplicaSetMembers(client: MongoClient): Promise<number> {
    try {
      const status = (await client
        .db()
        .admin()
        .command({ replSetGetStatus: 1 })) as ReplSetStatusResult;
      return status.members?.length ?? 1;
    } catch {
      return 1;
    }
  }

  private async countLongRunningOps(client: MongoClient): Promise<number> {
    try {
      const result = (await client
        .db()
        .admin()
        .command({
          currentOp: 1,
          secs_running: { $gt: LONG_RUNNING_THRESHOLD_SECONDS },
        })) as CurrentOpResult;
      return result.inprog?.length ?? 0;
    } catch {
      return 0;
    }
  }
}

function rate(
  current: number,
  previous: number,
  intervalSeconds: number,
): number {
  const delta = current - previous;
  if (delta < 0) return 0;
  return Math.round((delta / intervalSeconds) * 100) / 100;
}
