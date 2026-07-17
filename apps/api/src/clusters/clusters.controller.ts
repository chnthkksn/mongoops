import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RequireActiveOrg, Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { ClustersService } from './clusters.service';
import { CreateClusterDto } from './dto/create-cluster.dto';

@Controller('clusters')
@RequireActiveOrg()
export class ClustersController {
  constructor(private readonly clustersService: ClustersService) {}

  @Get()
  list(@Session() session: UserSession) {
    return this.clustersService.list(session.session.activeOrganizationId!);
  }

  @Post()
  create(@Session() session: UserSession, @Body() dto: CreateClusterDto) {
    return this.clustersService.create(
      session.session.activeOrganizationId!,
      dto,
      { id: session.user.id, name: session.user.name },
    );
  }

  @Post(':id/test-connection')
  testConnection(@Session() session: UserSession, @Param('id') id: string) {
    return this.clustersService.testConnection(
      session.session.activeOrganizationId!,
      id,
    );
  }
}
