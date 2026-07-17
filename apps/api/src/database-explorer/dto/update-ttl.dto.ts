import { IsNumber, Min } from 'class-validator';

export class UpdateTtlDto {
  @IsNumber()
  @Min(0)
  expireAfterSeconds: number;
}
