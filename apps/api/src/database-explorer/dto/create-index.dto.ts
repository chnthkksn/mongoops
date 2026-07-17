import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateIndexDto {
  @IsObject()
  keys: Record<string, 1 | -1>;

  @IsOptional()
  @IsBoolean()
  unique?: boolean;

  @IsOptional()
  @IsBoolean()
  sparse?: boolean;

  @IsOptional()
  @IsNumber()
  expireAfterSeconds?: number;

  @IsOptional()
  @IsString()
  name?: string;
}
