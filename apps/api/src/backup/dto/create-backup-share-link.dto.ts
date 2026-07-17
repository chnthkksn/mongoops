import { IsNumber, IsString, Max, Min } from 'class-validator';

export class CreateBackupShareLinkDto {
  @IsString()
  runId: string;

  @IsNumber()
  @Min(60)
  @Max(604800)
  expiresInSeconds: number;
}
