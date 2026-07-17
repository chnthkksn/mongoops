import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  OrgRoles,
  RequireActiveOrg,
  Session,
} from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { BackupShareLinksService } from './backup-share-links.service';
import { CreateBackupShareLinkDto } from './dto/create-backup-share-link.dto';

@Controller('backup-share-links')
@RequireActiveOrg()
export class BackupShareLinksController {
  constructor(
    private readonly backupShareLinksService: BackupShareLinksService,
  ) {}

  private actor(session: UserSession) {
    return { id: session.user.id, name: session.user.name };
  }

  @Get()
  list(
    @Session() session: UserSession,
    @Query('clusterId') clusterId?: string,
  ) {
    return this.backupShareLinksService.listLinks(
      session.session.activeOrganizationId!,
      clusterId,
    );
  }

  @Post()
  @OrgRoles(['owner', 'admin'])
  create(
    @Session() session: UserSession,
    @Body() dto: CreateBackupShareLinkDto,
  ) {
    return this.backupShareLinksService.createLink(
      session.session.activeOrganizationId!,
      dto.runId,
      this.actor(session),
      dto.expiresInSeconds,
    );
  }

  @Delete(':id')
  @OrgRoles(['owner', 'admin'])
  revoke(@Session() session: UserSession, @Param('id') id: string) {
    return this.backupShareLinksService.revokeLink(
      session.session.activeOrganizationId!,
      id,
      this.actor(session),
    );
  }
}
