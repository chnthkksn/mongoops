import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export class CreateStorageProviderDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsUrl({ require_tld: false })
  endpoint: string;

  @IsString()
  @MinLength(1)
  region: string;

  @IsString()
  @MinLength(1)
  bucket: string;

  @IsString()
  @MinLength(1)
  accessKeyId: string;

  @IsString()
  @MinLength(1)
  secretAccessKey: string;

  @IsOptional()
  @IsBoolean()
  forcePathStyle?: boolean;
}
