import {
  IsHexColor,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateClusterDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  connectionString?: string;

  @IsOptional()
  @IsIn(['standalone', 'replicaSet'])
  topology?: 'standalone' | 'replicaSet';

  @IsOptional()
  @IsHexColor()
  color?: string;
}
