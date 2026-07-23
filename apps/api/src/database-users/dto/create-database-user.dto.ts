import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RoleAssignmentDto {
  @IsString()
  role: string;

  @IsString()
  db: string;
}

export class CreateDatabaseUserDto {
  @IsString()
  @MinLength(1)
  username: string;

  // Optional — when omitted, the service generates a random password and
  // returns it once in the create response, same UX as API key creation.
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleAssignmentDto)
  roles: RoleAssignmentDto[];
}
