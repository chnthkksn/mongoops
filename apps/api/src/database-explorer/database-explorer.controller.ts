import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Patch,
  Query,
} from '@nestjs/common';
import {
  OrgRoles,
  RequireActiveOrg,
  Session,
} from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { DatabaseExplorerService } from './database-explorer.service';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { InsertDocumentDto } from './dto/insert-document.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { RenameCollectionDto } from './dto/rename-collection.dto';
import { SetValidatorDto } from './dto/set-validator.dto';
import { CreateIndexDto } from './dto/create-index.dto';
import { UpdateTtlDto } from './dto/update-ttl.dto';

@Controller('clusters/:id/databases')
@RequireActiveOrg()
export class DatabaseExplorerController {
  constructor(
    private readonly databaseExplorerService: DatabaseExplorerService,
  ) {}

  private actor(session: UserSession) {
    return { id: session.user.id, name: session.user.name };
  }

  @Get()
  listDatabases(@Session() session: UserSession, @Param('id') id: string) {
    return this.databaseExplorerService.listDatabases(
      session.session.activeOrganizationId!,
      id,
    );
  }

  @Get(':db/collections')
  listCollections(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('db') db: string,
  ) {
    return this.databaseExplorerService.listCollections(
      session.session.activeOrganizationId!,
      id,
      db,
    );
  }

  @Post(':db/collections')
  @OrgRoles(['owner', 'admin'])
  createCollection(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('db') db: string,
    @Body() dto: CreateCollectionDto,
  ) {
    return this.databaseExplorerService.createCollection(
      session.session.activeOrganizationId!,
      id,
      db,
      dto,
      this.actor(session),
    );
  }

  @Put(':db/collections/:coll/rename')
  @OrgRoles(['owner', 'admin'])
  renameCollection(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('db') db: string,
    @Param('coll') coll: string,
    @Body() dto: RenameCollectionDto,
  ) {
    return this.databaseExplorerService.renameCollection(
      session.session.activeOrganizationId!,
      id,
      db,
      coll,
      dto.newName,
      this.actor(session),
    );
  }

  @Delete(':db/collections/:coll')
  @OrgRoles(['owner', 'admin'])
  dropCollection(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('db') db: string,
    @Param('coll') coll: string,
  ) {
    return this.databaseExplorerService.dropCollection(
      session.session.activeOrganizationId!,
      id,
      db,
      coll,
      this.actor(session),
    );
  }

  @Get(':db/collections/:coll/validator')
  getValidator(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('db') db: string,
    @Param('coll') coll: string,
  ) {
    return this.databaseExplorerService.getValidator(
      session.session.activeOrganizationId!,
      id,
      db,
      coll,
    );
  }

  @Put(':db/collections/:coll/validator')
  @OrgRoles(['owner', 'admin'])
  setValidator(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('db') db: string,
    @Param('coll') coll: string,
    @Body() dto: SetValidatorDto,
  ) {
    return this.databaseExplorerService.setValidator(
      session.session.activeOrganizationId!,
      id,
      db,
      coll,
      dto.validator,
      this.actor(session),
    );
  }

  @Get(':db/collections/:coll/documents')
  listDocuments(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('db') db: string,
    @Param('coll') coll: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('filter') filter?: string,
    @Query('sort') sort?: string,
  ) {
    return this.databaseExplorerService.listDocuments(
      session.session.activeOrganizationId!,
      id,
      db,
      coll,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : undefined,
      filter,
      sort,
    );
  }

  @Post(':db/collections/:coll/documents')
  @OrgRoles(['owner', 'admin'])
  insertDocument(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('db') db: string,
    @Param('coll') coll: string,
    @Body() dto: InsertDocumentDto,
  ) {
    return this.databaseExplorerService.insertDocument(
      session.session.activeOrganizationId!,
      id,
      db,
      coll,
      dto.raw,
      this.actor(session),
    );
  }

  @Put(':db/collections/:coll/documents')
  @OrgRoles(['owner', 'admin'])
  updateDocument(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('db') db: string,
    @Param('coll') coll: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.databaseExplorerService.updateDocument(
      session.session.activeOrganizationId!,
      id,
      db,
      coll,
      dto.raw,
      this.actor(session),
    );
  }

  @Delete(':db/collections/:coll/documents/:docId')
  @OrgRoles(['owner', 'admin'])
  deleteDocument(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('db') db: string,
    @Param('coll') coll: string,
    @Param('docId') docId: string,
  ) {
    return this.databaseExplorerService.deleteDocument(
      session.session.activeOrganizationId!,
      id,
      db,
      coll,
      docId,
      this.actor(session),
    );
  }

  @Get(':db/collections/:coll/indexes')
  listIndexes(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('db') db: string,
    @Param('coll') coll: string,
  ) {
    return this.databaseExplorerService.listIndexes(
      session.session.activeOrganizationId!,
      id,
      db,
      coll,
    );
  }

  @Post(':db/collections/:coll/indexes')
  @OrgRoles(['owner', 'admin'])
  createIndex(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('db') db: string,
    @Param('coll') coll: string,
    @Body() dto: CreateIndexDto,
  ) {
    const { keys, ...options } = dto;
    return this.databaseExplorerService.createIndex(
      session.session.activeOrganizationId!,
      id,
      db,
      coll,
      keys,
      options,
      this.actor(session),
    );
  }

  @Delete(':db/collections/:coll/indexes/:name')
  @OrgRoles(['owner', 'admin'])
  dropIndex(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('db') db: string,
    @Param('coll') coll: string,
    @Param('name') name: string,
  ) {
    return this.databaseExplorerService.dropIndex(
      session.session.activeOrganizationId!,
      id,
      db,
      coll,
      name,
      this.actor(session),
    );
  }

  @Patch(':db/collections/:coll/indexes/:name/ttl')
  @OrgRoles(['owner', 'admin'])
  updateIndexTtl(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('db') db: string,
    @Param('coll') coll: string,
    @Param('name') name: string,
    @Body() dto: UpdateTtlDto,
  ) {
    return this.databaseExplorerService.updateIndexTtl(
      session.session.activeOrganizationId!,
      id,
      db,
      coll,
      name,
      dto.expireAfterSeconds,
      this.actor(session),
    );
  }
}
