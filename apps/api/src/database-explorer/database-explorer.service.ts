import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoClient, ObjectId, Document as MongoDocument } from 'mongodb';
import { EJSON } from 'bson';
import { Cluster } from '../clusters/cluster.schema';
import { decryptSecret } from '../common/crypto.util';
import { AuditLogService } from '../audit/audit-log.service';

const DEFAULT_PAGE_LIMIT = 25;
const PREVIEW_LENGTH = 180;

interface CollStatsResult {
  count?: number;
  avgObjSize?: number;
  storageSize?: number;
  nindexes?: number;
  totalIndexSize?: number;
  indexSizes?: Record<string, number>;
}

type Actor = { id: string; name: string };

@Injectable()
export class DatabaseExplorerService {
  constructor(
    @InjectModel(Cluster.name) private clusterModel: Model<Cluster>,
    private auditLogService: AuditLogService,
  ) {}

  private async connect(orgId: string, clusterId: string) {
    const cluster = await this.clusterModel
      .findOne({ _id: clusterId, orgId })
      .exec();
    if (!cluster) {
      throw new NotFoundException('Cluster not found');
    }
    const connectionString = decryptSecret(cluster.encryptedConnectionString);
    const client = new MongoClient(connectionString, {
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    return { client, cluster };
  }

  async listDatabases(orgId: string, clusterId: string) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      const { databases } = await client.db().admin().listDatabases();
      return databases
        .filter((db) => !['admin', 'local', 'config'].includes(db.name))
        .map((db) => ({
          name: db.name,
          sizeOnDisk: db.sizeOnDisk ?? 0,
          empty: db.empty ?? false,
        }));
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  // MongoDB has no explicit "create empty database" command — a database
  // only exists once it has at least one collection, so creating one here
  // means creating its first collection (matches the behavior of
  // MongoDB Compass/Atlas, which ask for a first collection name too).
  async createDatabase(
    orgId: string,
    clusterId: string,
    options: { name: string; collectionName: string },
    actor: Actor,
  ) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      await client.db(options.name).createCollection(options.collectionName);

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'database.created',
        targetLabel: options.name,
        metadata: { firstCollection: options.collectionName },
      });

      return { ok: true };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async dropDatabase(
    orgId: string,
    clusterId: string,
    dbName: string,
    actor: Actor,
  ) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      await client.db(dbName).dropDatabase();

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'database.dropped',
        targetLabel: dbName,
      });

      return { ok: true };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async listCollections(orgId: string, clusterId: string, dbName: string) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      const db = client.db(dbName);
      const collections = await db
        .listCollections({}, { nameOnly: false })
        .toArray();
      const withStats = await Promise.all(
        collections.map(async (coll) => {
          try {
            const stats = (await db.command({
              collStats: coll.name,
            })) as CollStatsResult;
            return {
              name: coll.name,
              count: stats.count ?? 0,
              avgObjSize: stats.avgObjSize ?? 0,
              storageSize: stats.storageSize ?? 0,
              nindexes: stats.nindexes ?? 0,
              totalIndexSize: stats.totalIndexSize ?? 0,
              capped: coll.options?.capped === true,
            };
          } catch {
            return {
              name: coll.name,
              count: 0,
              avgObjSize: 0,
              storageSize: 0,
              nindexes: 0,
              totalIndexSize: 0,
              capped: coll.options?.capped === true,
            };
          }
        }),
      );
      return withStats;
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async listDocuments(
    orgId: string,
    clusterId: string,
    dbName: string,
    collName: string,
    page: number,
    limit: number = DEFAULT_PAGE_LIMIT,
    filter?: string,
    sort?: string,
  ) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      const collection = client.db(dbName).collection(collName);
      const skip = Math.max(0, (page - 1) * limit);

      let filterDoc: MongoDocument = {};
      if (filter && filter.trim().length > 0) {
        filterDoc = EJSON.parse(filter) as MongoDocument;
      }

      let sortDoc: Record<string, 1 | -1> = { _id: 1 };
      if (sort && sort.includes(':')) {
        const [field, dir] = sort.split(':');
        sortDoc = { [field]: dir === '-1' ? -1 : 1 };
      }

      const [docs, total] = await Promise.all([
        collection
          .find(filterDoc)
          .sort(sortDoc)
          .skip(skip)
          .limit(limit)
          .toArray(),
        collection.countDocuments(filterDoc),
      ]);

      const documents = docs.map((doc) => {
        const raw = EJSON.stringify(doc, undefined, 2, { relaxed: false });
        const relaxed = EJSON.stringify(doc, undefined, undefined, {
          relaxed: true,
        });
        return {
          id: String(doc._id),
          raw,
          preview:
            relaxed.length > PREVIEW_LENGTH
              ? `${relaxed.slice(0, PREVIEW_LENGTH)}...`
              : relaxed,
          parsed: JSON.parse(relaxed) as unknown,
        };
      });

      return { documents, total, page, limit };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async insertDocument(
    orgId: string,
    clusterId: string,
    dbName: string,
    collName: string,
    raw: string,
    actor: Actor,
  ) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      const doc: MongoDocument = EJSON.parse(raw) as MongoDocument;
      const result = await client
        .db(dbName)
        .collection(collName)
        .insertOne(doc);

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'database.document_inserted',
        targetLabel: `${dbName}.${collName}`,
        metadata: { documentId: String(result.insertedId) },
      });

      return { ok: true, id: String(result.insertedId) };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async deleteDocument(
    orgId: string,
    clusterId: string,
    dbName: string,
    collName: string,
    docId: string,
    actor: Actor,
  ) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      const idFilter: MongoDocument = {
        _id: ObjectId.isValid(docId) ? new ObjectId(docId) : docId,
      };
      const result = await client
        .db(dbName)
        .collection(collName)
        .deleteOne(idFilter);
      if (result.deletedCount === 0) {
        throw new NotFoundException('Document not found');
      }

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'database.document_deleted',
        targetLabel: `${dbName}.${collName}`,
        metadata: { documentId: docId },
      });

      return { ok: true };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async listIndexes(
    orgId: string,
    clusterId: string,
    dbName: string,
    collName: string,
  ) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      const db = client.db(dbName);
      const [indexes, stats] = await Promise.all([
        db.collection(collName).indexes(),
        db.command({ collStats: collName }).catch(() => ({})),
      ]);
      const indexSizes = (stats as CollStatsResult).indexSizes ?? {};
      return indexes.map((index) => ({
        name: index.name ?? 'unnamed',
        key: index.key,
        size: indexSizes[index.name ?? ''] ?? null,
        unique: index.unique === true,
        sparse: index.sparse === true,
        expireAfterSeconds: index.expireAfterSeconds ?? null,
      }));
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async createIndex(
    orgId: string,
    clusterId: string,
    dbName: string,
    collName: string,
    keys: Record<string, 1 | -1>,
    options: {
      unique?: boolean;
      sparse?: boolean;
      expireAfterSeconds?: number;
      name?: string;
    },
    actor: Actor,
  ) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      const cleanOptions = Object.fromEntries(
        Object.entries(options).filter(([, value]) => value !== undefined),
      );
      const indexName = await client
        .db(dbName)
        .collection(collName)
        .createIndex(keys, cleanOptions);

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'database.index_created',
        targetLabel: `${dbName}.${collName}`,
        metadata: { indexName, keys },
      });

      return { ok: true, name: indexName };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async dropIndex(
    orgId: string,
    clusterId: string,
    dbName: string,
    collName: string,
    indexName: string,
    actor: Actor,
  ) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      await client.db(dbName).collection(collName).dropIndex(indexName);

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'database.index_dropped',
        targetLabel: `${dbName}.${collName}`,
        metadata: { indexName },
      });

      return { ok: true };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async updateIndexTtl(
    orgId: string,
    clusterId: string,
    dbName: string,
    collName: string,
    indexName: string,
    expireAfterSeconds: number,
    actor: Actor,
  ) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      await client.db(dbName).command({
        collMod: collName,
        index: { name: indexName, expireAfterSeconds },
      });

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'database.index_ttl_updated',
        targetLabel: `${dbName}.${collName}`,
        metadata: { indexName, expireAfterSeconds },
      });

      return { ok: true };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async createCollection(
    orgId: string,
    clusterId: string,
    dbName: string,
    options: {
      name: string;
      capped?: boolean;
      size?: number;
      max?: number;
      validator?: Record<string, unknown>;
    },
    actor: Actor,
  ) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      const { name, ...createOptions } = options;
      const cleanOptions = Object.fromEntries(
        Object.entries(createOptions).filter(
          ([, value]) => value !== undefined,
        ),
      );
      await client.db(dbName).createCollection(name, cleanOptions);

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'database.collection_created',
        targetLabel: `${dbName}.${name}`,
      });

      return { ok: true };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async renameCollection(
    orgId: string,
    clusterId: string,
    dbName: string,
    collName: string,
    newName: string,
    actor: Actor,
  ) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      await client.db(dbName).renameCollection(collName, newName);

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'database.collection_renamed',
        targetLabel: `${dbName}.${collName}`,
        metadata: { newName },
      });

      return { ok: true };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async dropCollection(
    orgId: string,
    clusterId: string,
    dbName: string,
    collName: string,
    actor: Actor,
  ) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      await client.db(dbName).dropCollection(collName);

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'database.collection_dropped',
        targetLabel: `${dbName}.${collName}`,
      });

      return { ok: true };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async getValidator(
    orgId: string,
    clusterId: string,
    dbName: string,
    collName: string,
  ) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      const collections = await client
        .db(dbName)
        .listCollections({ name: collName }, { nameOnly: false })
        .toArray();
      const validator =
        (collections[0]?.options?.validator as
          Record<string, unknown> | undefined) ?? null;
      return { validator };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async setValidator(
    orgId: string,
    clusterId: string,
    dbName: string,
    collName: string,
    validator: Record<string, unknown>,
    actor: Actor,
  ) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      await client.db(dbName).command({ collMod: collName, validator });

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'database.validation_updated',
        targetLabel: `${dbName}.${collName}`,
      });

      return { ok: true };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async updateDocument(
    orgId: string,
    clusterId: string,
    dbName: string,
    collName: string,
    raw: string,
    actor: Actor,
  ) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      // BSON documents are inherently dynamically typed (bson's `Document`
      // is `Record<string, any>`), so `_id` can't be typed more precisely
      // than `any` here without knowing the collection's schema.
      const { _id, ...rest }: MongoDocument = EJSON.parse(raw) as MongoDocument;
      if (_id === undefined) {
        throw new NotFoundException('Document is missing an _id field');
      }

      const collection = client.db(dbName).collection(collName);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await collection.replaceOne({ _id }, rest);
      if (result.matchedCount === 0) {
        throw new NotFoundException('Document not found');
      }

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'database.document_updated',
        targetLabel: `${dbName}.${collName}`,
        metadata: { documentId: String(_id) },
      });

      return { ok: true };
    } finally {
      await client.close().catch(() => undefined);
    }
  }
}
