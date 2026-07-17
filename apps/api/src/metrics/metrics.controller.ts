import { Controller, Get, Param } from '@nestjs/common';
import { RequireActiveOrg, Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { MetricsService } from './metrics.service';

@Controller('clusters/:id/metrics')
@RequireActiveOrg()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  getRecentSamples(@Session() session: UserSession, @Param('id') id: string) {
    return this.metricsService.getRecentSamples(
      session.session.activeOrganizationId!,
      id,
    );
  }
}
