import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequireActiveOrg, Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { MetricsService } from './metrics.service';

// Samples are collected every 30s and retained 24h (MetricSample's TTL
// index), so 2880 is the most raw samples that could ever exist for a
// cluster — the natural upper bound for a client-requested time range.
const MAX_SAMPLE_LIMIT = 2880;

@Controller('clusters/:id/metrics')
@RequireActiveOrg()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  getRecentSamples(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : 60;
    const clamped = Math.min(
      MAX_SAMPLE_LIMIT,
      Math.max(10, Number.isFinite(parsed) ? parsed : 60),
    );
    return this.metricsService.getRecentSamples(
      session.session.activeOrganizationId!,
      id,
      clamped,
    );
  }
}
