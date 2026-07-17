import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateBackupScheduleDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  intervalHours?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
