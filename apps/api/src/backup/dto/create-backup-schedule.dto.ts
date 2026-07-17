import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateBackupScheduleDto {
  @IsString()
  clusterId: string;

  @IsString()
  storageProviderId: string;

  @IsNumber()
  @Min(1)
  intervalHours: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
