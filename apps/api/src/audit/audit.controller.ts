import { Controller, Get } from '@nestjs/common';
import { RequireActiveOrg, Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { AuditLogService } from './audit-log.service';

@Controller('audit-logs')
@RequireActiveOrg()
export class AuditController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(@Session() session: UserSession) {
    return this.auditLogService.listRecent(
      session.session.activeOrganizationId!,
    );
  }
}
