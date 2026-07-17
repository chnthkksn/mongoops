import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  OrgRoles,
  RequireActiveOrg,
  Session,
} from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Controller('api-keys')
@RequireActiveOrg()
@OrgRoles(['owner'])
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  list(@Session() session: UserSession, @Req() req: Request) {
    return this.apiKeysService.list(
      session.session.activeOrganizationId!,
      req.headers,
    );
  }

  @Post()
  create(
    @Session() session: UserSession,
    @Body() dto: CreateApiKeyDto,
    @Req() req: Request,
  ) {
    return this.apiKeysService.create(
      session.session.activeOrganizationId!,
      { id: session.user.id, name: session.user.name },
      dto,
      req.headers,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  revoke(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.apiKeysService.revoke(
      session.session.activeOrganizationId!,
      { id: session.user.id, name: session.user.name },
      id,
      req.headers,
    );
  }
}
