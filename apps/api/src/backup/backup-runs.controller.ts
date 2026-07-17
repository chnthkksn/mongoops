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
import { BackupRunsService } from './backup-runs.service';
import { CreateBackupRunDto } from './dto/create-backup-run.dto';
import { CreateDownloadUrlDto } from './dto/create-download-url.dto';

@Controller('backup-runs')
@RequireActiveOrg()
export class BackupRunsController {
  constructor(private readonly backupRunsService: BackupRunsService) {}

  private actor(session: UserSession) {
    return { id: session.user.id, name: session.user.name };
  }

  @Get()
  list(
    @Session() session: UserSession,
    @Query('clusterId') clusterId?: string,
  ) {
    return this.backupRunsService.listRuns(
      session.session.activeOrganizationId!,
      clusterId,
    );
  }

  @Post()
  @OrgRoles(['owner', 'admin'])
  create(@Session() session: UserSession, @Body() dto: CreateBackupRunDto) {
    return this.backupRunsService.runBackup(
      session.session.activeOrganizationId!,
      dto.clusterId,
      dto.storageProviderId,
      'manual',
      this.actor(session),
    );
  }

  @Post(':id/restore')
  @OrgRoles(['owner', 'admin'])
  restore(@Session() session: UserSession, @Param('id') id: string) {
    return this.backupRunsService.restoreRun(
      session.session.activeOrganizationId!,
      id,
      this.actor(session),
    );
  }

  @Post(':id/download-url')
  @OrgRoles(['owner', 'admin'])
  createDownloadUrl(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() dto: CreateDownloadUrlDto,
  ) {
    return this.backupRunsService.getDownloadUrl(
      session.session.activeOrganizationId!,
      id,
      this.actor(session),
      dto.expiresInSeconds ?? 300,
    );
  }

  @Delete(':id')
  @OrgRoles(['owner', 'admin'])
  remove(@Session() session: UserSession, @Param('id') id: string) {
    return this.backupRunsService.deleteRun(
      session.session.activeOrganizationId!,
      id,
      this.actor(session),
    );
  }
}
