import { IsOptional, IsString, MinLength } from 'class-validator';

export class ResetDatabaseUserPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
