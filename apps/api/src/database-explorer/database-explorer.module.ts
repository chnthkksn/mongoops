import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cluster, ClusterSchema } from '../clusters/cluster.schema';
import { AuditModule } from '../audit/audit.module';
import { DatabaseExplorerController } from './database-explorer.controller';
import { DatabaseExplorerService } from './database-explorer.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cluster.name, schema: ClusterSchema }]),
    AuditModule,
  ],
  controllers: [DatabaseExplorerController],
  providers: [DatabaseExplorerService],
})
export class DatabaseExplorerModule {}
