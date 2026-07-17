import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoClient, Document as MongoDocument } from 'mongodb';
import { EJSON } from 'bson';
import { PassThrough, Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';
import { once } from 'events';
import * as readline from 'readline';
import * as tarStream from 'tar-stream';
import { Upload } from '@aws-sdk/lib-storage';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Cluster } from '../clusters/cluster.schema';
import { StorageProvider } from './storage-provider.schema';
import { BackupRun, BackupRunTrigger } from './backup-run.schema';
import { decryptSecret } from '../common/crypto.util';
import { AuditLogService } from '../audit/audit-log.service';
import { buildS3Client } from './s3-client.util';

type Actor = { id: string; name: string } | null;

interface ManifestCollectionEntry {
  dbName: string;
  collName: string;
  documentCount: number;
  key: string;
}

interface Manifest {
  runId: string;
  clusterId: string;
  clusterName: string;
  orgId: string;
  createdAt: string;
  collections: ManifestCollectionEntry[];
}

const SYSTEM_DBS = ['admin', 'local', 'config'];
const INSERT_CHUNK_SIZE = 500;
const DELETE_CHUNK_SIZE = 1000;

function actorFields(actor: Actor) {
  return {
    actorUserId: actor?.id ?? 'system',
    actorName: actor?.name ?? 'Scheduled Backup',
  };
}

@Injectable()
export class BackupRunsService {
  private readonly logger = new Logger(BackupRunsService.name);

  constructor(
    @InjectModel(Cluster.name) private clusterModel: Model<Cluster>,
    @InjectModel(StorageProvider.name)
    private storageProviderModel: Model<StorageProvider>,
    @InjectModel(BackupRun.name) private backupRunModel: Model<BackupRun>,
    private auditLogService: AuditLogService,
  ) {}

  async listRuns(orgId: string, clusterId?: string) {
    const filter: Record<string, unknown> = { orgId };
    if (clusterId) filter.clusterId = clusterId;
    return this.backupRunModel.find(filter).sort({ startedAt: -1 }).exec();
  }

  async getRun(orgId: string, runId: string) {
    const run = await this.backupRunModel.findOne({ _id: runId, orgId }).exec();
    if (!run) {
      throw new NotFoundException('Backup run not found');
    }
    return run;
  }

  async runBackup(
    orgId: string,
    clusterId: string,
    storageProviderId: string,
    trigger: BackupRunTrigger,
    actor: Actor,
  ) {
    const cluster = await this.clusterModel
      .findOne({ _id: clusterId, orgId })
      .exec();
    if (!cluster) {
      throw new NotFoundException('Cluster not found');
    }
    const provider = await this.storageProviderModel
      .findOne({ _id: storageProviderId, orgId })
      .exec();
    if (!provider) {
      throw new NotFoundException('Storage provider not found');
    }

    const run = await this.backupRunModel.create({
      orgId,
      clusterId,
      storageProviderId,
      status: 'running',
      trigger,
      startedAt: new Date(),
    });
    run.objectKeyPrefix = `backups/${orgId}/${clusterId}/${String(run._id)}`;
    await run.save();

    await this.auditLogService.record({
      orgId,
      ...actorFields(actor),
      action: 'backup.started',
      targetLabel: cluster.name,
      metadata: { storageProvider: provider.name, trigger },
    });

    const s3 = buildS3Client(provider);
    const connectionString = decryptSecret(cluster.encryptedConnectionString);
    const client = new MongoClient(connectionString, {
      serverSelectionTimeoutMS: 5000,
    });

    try {
      await client.connect();
      const { databases } = await client.db().admin().listDatabases();

      const manifest: Manifest = {
        runId: String(run._id),
        clusterId,
        clusterName: cluster.name,
        orgId,
        createdAt: new Date().toISOString(),
        collections: [],
      };
      const collectionStats: {
        dbName: string;
        collName: string;
        documentCount: number;
      }[] = [];
      let totalSizeBytes = 0;

      for (const dbInfo of databases) {
        if (SYSTEM_DBS.includes(dbInfo.name)) continue;
        const db = client.db(dbInfo.name);
        const collections = await db
          .listCollections({}, { nameOnly: true })
          .toArray();

        for (const collInfo of collections) {
          if (collInfo.name.startsWith('system.')) continue;
          const coll = db.collection(collInfo.name);
          const key = `${run.objectKeyPrefix}/${dbInfo.name}/${collInfo.name}.ndjson.gz`;

          let documentCount = 0;
          const ndjson = new PassThrough();
          const gzip = createGzip();

          const writePromise = (async () => {
            try {
              for await (const doc of coll.find()) {
                const line =
                  EJSON.stringify(doc, undefined, undefined, {
                    relaxed: false,
                  }) + '\n';
                documentCount++;
                if (!ndjson.write(line)) {
                  await once(ndjson, 'drain');
                }
              }
            } finally {
              ndjson.end();
            }
          })();

          const upload = new Upload({
            client: s3,
            params: {
              Bucket: provider.bucket,
              Key: key,
              Body: ndjson.pipe(gzip),
              ContentType: 'application/gzip',
            },
          });

          await Promise.all([writePromise, upload.done()]);

          const head = await s3.send(
            new HeadObjectCommand({ Bucket: provider.bucket, Key: key }),
          );
          totalSizeBytes += head.ContentLength ?? 0;

          collectionStats.push({
            dbName: dbInfo.name,
            collName: collInfo.name,
            documentCount,
          });
          manifest.collections.push({
            dbName: dbInfo.name,
            collName: collInfo.name,
            documentCount,
            key,
          });
        }
      }

      const manifestKey = `${run.objectKeyPrefix}/manifest.json`;
      await new Upload({
        client: s3,
        params: {
          Bucket: provider.bucket,
          Key: manifestKey,
          Body: JSON.stringify(manifest, null, 2),
          ContentType: 'application/json',
        },
      }).done();

      run.status = 'completed';
      run.completedAt = new Date();
      run.durationMs = run.completedAt.getTime() - run.startedAt.getTime();
      run.totalSizeBytes = totalSizeBytes;
      run.collections = collectionStats;
      await run.save();

      await this.auditLogService.record({
        orgId,
        ...actorFields(actor),
        action: 'backup.completed',
        targetLabel: cluster.name,
        metadata: {
          runId: String(run._id),
          collections: collectionStats.length,
          totalSizeBytes,
        },
      });

      return run;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backup failed';
      run.status = 'failed';
      run.completedAt = new Date();
      run.durationMs = run.completedAt.getTime() - run.startedAt.getTime();
      run.errorMessage = message;
      await run.save();

      await this.auditLogService.record({
        orgId,
        ...actorFields(actor),
        action: 'backup.failed',
        targetLabel: cluster.name,
        metadata: { runId: String(run._id), error: message },
      });

      this.logger.warn(`Backup run ${String(run._id)} failed: ${message}`);
      return run;
    } finally {
      await client.close().catch(() => undefined);
      s3.destroy();
    }
  }

  async restoreRun(orgId: string, runId: string, actor: NonNullable<Actor>) {
    const run = await this.getRun(orgId, runId);
    if (run.status !== 'completed') {
      throw new BadRequestException(
        'Only completed backup runs can be restored',
      );
    }
    const cluster = await this.clusterModel
      .findOne({ _id: run.clusterId, orgId })
      .exec();
    if (!cluster) {
      throw new NotFoundException('Cluster not found');
    }
    const provider = await this.storageProviderModel
      .findOne({ _id: run.storageProviderId, orgId })
      .exec();
    if (!provider) {
      throw new NotFoundException('Storage provider not found');
    }

    const s3 = buildS3Client(provider);
    const connectionString = decryptSecret(cluster.encryptedConnectionString);
    const client = new MongoClient(connectionString, {
      serverSelectionTimeoutMS: 5000,
    });

    try {
      const manifestKey = `${run.objectKeyPrefix}/manifest.json`;
      const manifestObj = await s3.send(
        new GetObjectCommand({ Bucket: provider.bucket, Key: manifestKey }),
      );
      const manifestBody = await manifestObj.Body!.transformToString();
      const manifest = JSON.parse(manifestBody) as Manifest;

      await client.connect();
      let restoredDocuments = 0;

      for (const entry of manifest.collections) {
        const db = client.db(entry.dbName);
        await db
          .collection(entry.collName)
          .drop()
          .catch(() => undefined);
        const target = db.collection(entry.collName);

        const obj = await s3.send(
          new GetObjectCommand({ Bucket: provider.bucket, Key: entry.key }),
        );
        const gunzip = (obj.Body as Readable).pipe(createGunzip());
        const rl = readline.createInterface({
          input: gunzip,
          crlfDelay: Infinity,
        });

        let batch: MongoDocument[] = [];
        for await (const line of rl) {
          if (!line.trim()) continue;
          batch.push(EJSON.parse(line) as MongoDocument);
          if (batch.length >= INSERT_CHUNK_SIZE) {
            await target.insertMany(batch);
            restoredDocuments += batch.length;
            batch = [];
          }
        }
        if (batch.length > 0) {
          await target.insertMany(batch);
          restoredDocuments += batch.length;
        }
      }

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'backup.restored',
        targetLabel: cluster.name,
        metadata: {
          runId: String(run._id),
          restoredCollections: manifest.collections.length,
          restoredDocuments,
        },
      });

      return {
        ok: true,
        restoredCollections: manifest.collections.length,
        restoredDocuments,
      };
    } finally {
      await client.close().catch(() => undefined);
      s3.destroy();
    }
  }

  async getOrCreateBundle(orgId: string, runId: string) {
    const run = await this.getRun(orgId, runId);
    if (run.status !== 'completed') {
      throw new BadRequestException(
        'Only completed backup runs can be downloaded',
      );
    }
    const provider = await this.storageProviderModel
      .findOne({ _id: run.storageProviderId, orgId })
      .exec();
    if (!provider) {
      throw new NotFoundException('Storage provider not found');
    }

    if (run.bundleKey) {
      return { run, provider, bucket: provider.bucket, key: run.bundleKey };
    }

    const s3 = buildS3Client(provider);
    try {
      const manifestKey = `${run.objectKeyPrefix}/manifest.json`;
      const manifestObj = await s3.send(
        new GetObjectCommand({ Bucket: provider.bucket, Key: manifestKey }),
      );
      const manifestBody = await manifestObj.Body!.transformToString();
      const manifest = JSON.parse(manifestBody) as Manifest;

      const pack = tarStream.pack();
      const bundleKey = `${run.objectKeyPrefix}/bundle.tar`;

      // tar-stream's Pack is a streamx-based Readable, not a Node core
      // stream.Readable — @aws-sdk/lib-storage's Upload rejects it directly,
      // so pipe it into a real Node PassThrough first.
      const tarOut = new PassThrough();
      pack.on('error', (err) => tarOut.destroy(err));
      pack.pipe(tarOut);

      const upload = new Upload({
        client: s3,
        params: {
          Bucket: provider.bucket,
          Key: bundleKey,
          Body: tarOut,
          ContentType: 'application/x-tar',
        },
      });
      const uploadPromise = upload.done();

      pack.entry({ name: 'manifest.json' }, manifestBody);

      for (const entry of manifest.collections) {
        const [obj, head] = await Promise.all([
          s3.send(
            new GetObjectCommand({ Bucket: provider.bucket, Key: entry.key }),
          ),
          s3.send(
            new HeadObjectCommand({ Bucket: provider.bucket, Key: entry.key }),
          ),
        ]);
        const tarEntry = pack.entry({
          name: `${entry.dbName}/${entry.collName}.ndjson.gz`,
          size: head.ContentLength ?? 0,
        });
        await pipeline(obj.Body as Readable, tarEntry);
      }

      pack.finalize();
      await uploadPromise;

      run.bundleKey = bundleKey;
      await run.save();

      return { run, provider, bucket: provider.bucket, key: bundleKey };
    } finally {
      s3.destroy();
    }
  }

  async getDownloadUrl(
    orgId: string,
    runId: string,
    actor: NonNullable<Actor>,
    expiresInSeconds: number,
  ) {
    const { run, provider, bucket, key } = await this.getOrCreateBundle(
      orgId,
      runId,
    );
    const cluster = await this.clusterModel
      .findOne({ _id: run.clusterId, orgId })
      .exec();

    const s3 = buildS3Client(provider);
    try {
      const filename = `${cluster?.name ?? 'backup'}-${runId}.tar`.replace(
        /[^a-zA-Z0-9._-]/g,
        '_',
      );
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseContentDisposition: `attachment; filename="${filename}"`,
        }),
        { expiresIn: expiresInSeconds },
      );
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'backup.download_link_created',
        targetLabel: cluster?.name ?? runId,
        metadata: { runId, expiresInSeconds },
      });

      return { url, expiresAt: expiresAt.toISOString() };
    } finally {
      s3.destroy();
    }
  }

  async deleteRun(orgId: string, runId: string, actor: NonNullable<Actor>) {
    const run = await this.getRun(orgId, runId);
    const cluster = await this.clusterModel
      .findOne({ _id: run.clusterId, orgId })
      .exec();
    const provider = await this.storageProviderModel
      .findOne({ _id: run.storageProviderId, orgId })
      .exec();

    if (provider && run.objectKeyPrefix) {
      const s3 = buildS3Client(provider);
      try {
        const manifestKey = `${run.objectKeyPrefix}/manifest.json`;
        const manifestObj = await s3.send(
          new GetObjectCommand({ Bucket: provider.bucket, Key: manifestKey }),
        );
        const manifestBody = await manifestObj.Body!.transformToString();
        const manifest = JSON.parse(manifestBody) as Manifest;
        const keys = [
          ...manifest.collections.map((c) => c.key),
          manifestKey,
          ...(run.bundleKey ? [run.bundleKey] : []),
        ];

        for (let i = 0; i < keys.length; i += DELETE_CHUNK_SIZE) {
          const chunk = keys.slice(i, i + DELETE_CHUNK_SIZE);
          await s3.send(
            new DeleteObjectsCommand({
              Bucket: provider.bucket,
              Delete: { Objects: chunk.map((Key) => ({ Key })) },
            }),
          );
        }
      } catch (error) {
        this.logger.warn(
          `Could not delete S3 objects for backup run ${runId}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      } finally {
        s3.destroy();
      }
    }

    await this.backupRunModel.deleteOne({ _id: runId, orgId });

    await this.auditLogService.record({
      orgId,
      actorUserId: actor.id,
      actorName: actor.name,
      action: 'backup.deleted',
      targetLabel: cluster?.name ?? runId,
      metadata: { runId },
    });

    return { ok: true };
  }
}
