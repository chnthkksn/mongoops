import { IsString } from 'class-validator';

export class CreateBackupRunDto {
  @IsString()
  clusterId: string;

  @IsString()
  storageProviderId: string;
}
