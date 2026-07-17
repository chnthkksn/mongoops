import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateDownloadUrlDto {
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(604800)
  expiresInSeconds?: number;
}
