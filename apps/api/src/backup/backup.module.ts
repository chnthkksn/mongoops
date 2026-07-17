import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cluster, ClusterSchema } from '../clusters/cluster.schema';
import {
  StorageProvider,
  StorageProviderSchema,
} from './storage-provider.schema';
import { BackupRun, BackupRunSchema } from './backup-run.schema';
import { BackupSchedule, BackupScheduleSchema } from './backup-schedule.schema';
import {
  BackupShareLink,
  BackupShareLinkSchema,
} from './backup-share-link.schema';
import { StorageProvidersController } from './storage-providers.controller';
import { BackupRunsController } from './backup-runs.controller';
import { BackupSchedulesController } from './backup-schedules.controller';
import { BackupShareLinksController } from './backup-share-links.controller';
import { PublicBackupSharesController } from './public-backup-shares.controller';
import { StorageProvidersService } from './storage-providers.service';
import { BackupRunsService } from './backup-runs.service';
import { BackupSchedulesService } from './backup-schedules.service';
import { BackupShareLinksService } from './backup-share-links.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cluster.name, schema: ClusterSchema },
      { name: StorageProvider.name, schema: StorageProviderSchema },
      { name: BackupRun.name, schema: BackupRunSchema },
      { name: BackupSchedule.name, schema: BackupScheduleSchema },
      { name: BackupShareLink.name, schema: BackupShareLinkSchema },
    ]),
    AuditModule,
  ],
  controllers: [
    StorageProvidersController,
    BackupRunsController,
    BackupSchedulesController,
    BackupShareLinksController,
    PublicBackupSharesController,
  ],
  providers: [
    StorageProvidersService,
    BackupRunsService,
    BackupSchedulesService,
    BackupShareLinksService,
  ],
})
export class BackupModule {}
