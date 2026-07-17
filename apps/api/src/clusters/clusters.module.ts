import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cluster, ClusterSchema } from './cluster.schema';
import { ClustersController } from './clusters.controller';
import { ClustersService } from './clusters.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cluster.name, schema: ClusterSchema }]),
    AuditModule,
  ],
  controllers: [ClustersController],
  providers: [ClustersService],
})
export class ClustersModule {}
