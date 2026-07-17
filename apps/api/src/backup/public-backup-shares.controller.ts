import { Controller, Get, Param, Res } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { BackupShareLinksService } from './backup-share-links.service';

@Controller('public/backup-shares')
export class PublicBackupSharesController {
  constructor(
    private readonly backupShareLinksService: BackupShareLinksService,
  ) {}

  @Get(':token')
  @AllowAnonymous()
  async resolve(@Param('token') token: string, @Res() res: Response) {
    const url = await this.backupShareLinksService.resolveToken(token);
    res.redirect(302, url);
  }
}
