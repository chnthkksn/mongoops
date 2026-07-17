import { Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'http';
import { auth } from '../auth/auth.instance';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(private auditLogService: AuditLogService) {}

  async list(orgId: string, nodeHeaders: IncomingHttpHeaders) {
    const headers = fromNodeHeaders(nodeHeaders);
    const { apiKeys } = await auth.api.listApiKeys({ headers });
    return apiKeys
      .filter(
        (key) => (key.metadata as { orgId?: string } | null)?.orgId === orgId,
      )
      .map((key) => ({
        id: key.id,
        name: key.name,
        start: key.start,
        createdAt: key.createdAt,
      }));
  }

  async create(
    orgId: string,
    actor: { id: string; name: string },
    dto: CreateApiKeyDto,
    nodeHeaders: IncomingHttpHeaders,
  ) {
    const headers = fromNodeHeaders(nodeHeaders);
    const created = await auth.api.createApiKey({
      headers,
      body: { name: dto.name, userId: actor.id, metadata: { orgId } },
    });

    await this.auditLogService.record({
      orgId,
      actorUserId: actor.id,
      actorName: actor.name,
      action: 'apikey.created',
      targetLabel: dto.name,
    });

    return created;
  }

  async revoke(
    orgId: string,
    actor: { id: string; name: string },
    keyId: string,
    nodeHeaders: IncomingHttpHeaders,
  ) {
    const headers = fromNodeHeaders(nodeHeaders);
    await auth.api.deleteApiKey({ headers, body: { keyId } });

    await this.auditLogService.record({
      orgId,
      actorUserId: actor.id,
      actorName: actor.name,
      action: 'apikey.revoked',
      targetLabel: keyId,
    });
  }
}
