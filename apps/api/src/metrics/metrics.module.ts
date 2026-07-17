import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cluster, ClusterSchema } from '../clusters/cluster.schema';
import { MetricSample, MetricSampleSchema } from './metric-sample.schema';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cluster.name, schema: ClusterSchema },
      { name: MetricSample.name, schema: MetricSampleSchema },
    ]),
  ],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
