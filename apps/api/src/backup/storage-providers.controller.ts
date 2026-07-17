import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  OrgRoles,
  RequireActiveOrg,
  Session,
} from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { StorageProvidersService } from './storage-providers.service';
import { CreateStorageProviderDto } from './dto/create-storage-provider.dto';

@Controller('storage-providers')
@RequireActiveOrg()
export class StorageProvidersController {
  constructor(
    private readonly storageProvidersService: StorageProvidersService,
  ) {}

  private actor(session: UserSession) {
    return { id: session.user.id, name: session.user.name };
  }

  @Get()
  list(@Session() session: UserSession) {
    return this.storageProvidersService.list(
      session.session.activeOrganizationId!,
    );
  }

  @Post()
  @OrgRoles(['owner'])
  create(
    @Session() session: UserSession,
    @Body() dto: CreateStorageProviderDto,
  ) {
    return this.storageProvidersService.create(
      session.session.activeOrganizationId!,
      dto,
      this.actor(session),
    );
  }

  @Delete(':id')
  @OrgRoles(['owner'])
  remove(@Session() session: UserSession, @Param('id') id: string) {
    return this.storageProvidersService.remove(
      session.session.activeOrganizationId!,
      id,
      this.actor(session),
    );
  }

  @Post(':id/test-connection')
  @OrgRoles(['owner'])
  testConnection(@Session() session: UserSession, @Param('id') id: string) {
    return this.storageProvidersService.testConnection(
      session.session.activeOrganizationId!,
      id,
    );
  }
}
