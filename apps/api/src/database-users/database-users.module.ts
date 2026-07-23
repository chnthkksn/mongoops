import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cluster, ClusterSchema } from '../clusters/cluster.schema';
import { AuditModule } from '../audit/audit.module';
import { DatabaseUsersController } from './database-users.controller';
import { DatabaseUsersService } from './database-users.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cluster.name, schema: ClusterSchema }]),
    AuditModule,
  ],
  controllers: [DatabaseUsersController],
  providers: [DatabaseUsersService],
})
export class DatabaseUsersModule {}
