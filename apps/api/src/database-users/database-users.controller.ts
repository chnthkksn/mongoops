import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  OrgRoles,
  RequireActiveOrg,
  Session,
} from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { DatabaseUsersService } from './database-users.service';
import { CreateDatabaseUserDto } from './dto/create-database-user.dto';
import { UpdateDatabaseUserRolesDto } from './dto/update-database-user-roles.dto';
import { ResetDatabaseUserPasswordDto } from './dto/reset-database-user-password.dto';

// Database users are real MongoDB credentials with real cluster access —
// as sensitive as API keys, so this whole controller is owner-only rather
// than following the read-any-member/mutate-owner-admin convention used
// elsewhere.
@Controller('clusters/:id/database-users')
@RequireActiveOrg()
@OrgRoles(['owner'])
export class DatabaseUsersController {
  constructor(private readonly databaseUsersService: DatabaseUsersService) {}

  private actor(session: UserSession) {
    return { id: session.user.id, name: session.user.name };
  }

  @Get()
  list(@Session() session: UserSession, @Param('id') id: string) {
    return this.databaseUsersService.listUsers(
      session.session.activeOrganizationId!,
      id,
    );
  }

  @Post()
  create(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() dto: CreateDatabaseUserDto,
  ) {
    return this.databaseUsersService.createUser(
      session.session.activeOrganizationId!,
      id,
      dto,
      this.actor(session),
    );
  }

  @Put(':username/roles')
  updateRoles(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('username') username: string,
    @Body() dto: UpdateDatabaseUserRolesDto,
  ) {
    return this.databaseUsersService.updateRoles(
      session.session.activeOrganizationId!,
      id,
      username,
      dto.roles,
      this.actor(session),
    );
  }

  @Post(':username/reset-password')
  resetPassword(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('username') username: string,
    @Body() dto: ResetDatabaseUserPasswordDto,
  ) {
    return this.databaseUsersService.resetPassword(
      session.session.activeOrganizationId!,
      id,
      username,
      this.actor(session),
      dto.password,
    );
  }

  @Delete(':username')
  remove(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('username') username: string,
  ) {
    return this.databaseUsersService.deleteUser(
      session.session.activeOrganizationId!,
      id,
      username,
      this.actor(session),
    );
  }
}
