import { Controller, Get, Query } from '@nestjs/common';
import { RequireActiveOrg, Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { AuditLogService } from './audit-log.service';

@Controller('audit-logs')
@RequireActiveOrg()
export class AuditController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(
    @Session() session: UserSession,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditLogService.listRecent(
      session.session.activeOrganizationId!,
      {
        limit: limit ? parseInt(limit, 10) : undefined,
        skip: skip ? parseInt(skip, 10) : undefined,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      },
    );
  }
}
