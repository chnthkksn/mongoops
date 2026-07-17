import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  OrgRoles,
  RequireActiveOrg,
  Session,
} from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { BackupSchedulesService } from './backup-schedules.service';
import { CreateBackupScheduleDto } from './dto/create-backup-schedule.dto';
import { UpdateBackupScheduleDto } from './dto/update-backup-schedule.dto';

@Controller('backup-schedules')
@RequireActiveOrg()
export class BackupSchedulesController {
  constructor(
    private readonly backupSchedulesService: BackupSchedulesService,
  ) {}

  private actor(session: UserSession) {
    return { id: session.user.id, name: session.user.name };
  }

  @Get()
  list(
    @Session() session: UserSession,
    @Query('clusterId') clusterId?: string,
  ) {
    return this.backupSchedulesService.list(
      session.session.activeOrganizationId!,
      clusterId,
    );
  }

  @Post()
  @OrgRoles(['owner', 'admin'])
  create(
    @Session() session: UserSession,
    @Body() dto: CreateBackupScheduleDto,
  ) {
    return this.backupSchedulesService.create(
      session.session.activeOrganizationId!,
      dto,
      this.actor(session),
    );
  }

  @Patch(':id')
  @OrgRoles(['owner', 'admin'])
  update(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() dto: UpdateBackupScheduleDto,
  ) {
    return this.backupSchedulesService.update(
      session.session.activeOrganizationId!,
      id,
      dto,
      this.actor(session),
    );
  }

  @Delete(':id')
  @OrgRoles(['owner', 'admin'])
  remove(@Session() session: UserSession, @Param('id') id: string) {
    return this.backupSchedulesService.remove(
      session.session.activeOrganizationId!,
      id,
      this.actor(session),
    );
  }
}
