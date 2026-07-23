import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoClient } from 'mongodb';
import { randomBytes } from 'crypto';
import { Cluster } from '../clusters/cluster.schema';
import { decryptSecret } from '../common/crypto.util';
import { AuditLogService } from '../audit/audit-log.service';
import { RoleAssignmentDto } from './dto/create-database-user.dto';

type Actor = { id: string; name: string };

interface MongoUserInfoEntry {
  user: string;
  roles: { role: string; db: string }[];
}

function generatePassword() {
  return randomBytes(18).toString('base64url');
}

@Injectable()
export class DatabaseUsersService {
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

  // Real MongoDB users are always authenticated against the `admin`
  // database regardless of which databases their roles target — matches
  // how Atlas's own Database Access users work, and lets a single
  // connection string list every user on the deployment via forAllDBs.
  async listUsers(orgId: string, clusterId: string) {
    const { client } = await this.connect(orgId, clusterId);
    try {
      const result = await client
        .db('admin')
        .command({ usersInfo: { forAllDBs: true } });
      const users = (result.users ?? []) as MongoUserInfoEntry[];
      return users.map((u) => ({ username: u.user, roles: u.roles }));
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async createUser(
    orgId: string,
    clusterId: string,
    dto: { username: string; password?: string; roles: RoleAssignmentDto[] },
    actor: Actor,
  ) {
    const { client, cluster } = await this.connect(orgId, clusterId);
    try {
      const password = dto.password ?? generatePassword();
      await client.db('admin').command({
        createUser: dto.username,
        pwd: password,
        roles: dto.roles,
      });

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'database_user.created',
        targetLabel: `${cluster.name}: ${dto.username}`,
        metadata: { username: dto.username, roles: dto.roles },
      });

      return { username: dto.username, password, roles: dto.roles };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async updateRoles(
    orgId: string,
    clusterId: string,
    username: string,
    roles: RoleAssignmentDto[],
    actor: Actor,
  ) {
    const { client, cluster } = await this.connect(orgId, clusterId);
    try {
      await client.db('admin').command({ updateUser: username, roles });

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'database_user.roles_updated',
        targetLabel: `${cluster.name}: ${username}`,
        metadata: { username, roles },
      });

      return { username, roles };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async resetPassword(
    orgId: string,
    clusterId: string,
    username: string,
    actor: Actor,
    requestedPassword?: string,
  ) {
    const { client, cluster } = await this.connect(orgId, clusterId);
    try {
      const password = requestedPassword ?? generatePassword();
      await client.db('admin').command({ updateUser: username, pwd: password });

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'database_user.password_reset',
        targetLabel: `${cluster.name}: ${username}`,
      });

      return { username, password };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async deleteUser(
    orgId: string,
    clusterId: string,
    username: string,
    actor: Actor,
  ) {
    const { client, cluster } = await this.connect(orgId, clusterId);
    try {
      await client.db('admin').command({ dropUser: username });

      await this.auditLogService.record({
        orgId,
        actorUserId: actor.id,
        actorName: actor.name,
        action: 'database_user.deleted',
        targetLabel: `${cluster.name}: ${username}`,
      });

      return { ok: true };
    } finally {
      await client.close().catch(() => undefined);
    }
  }
}
