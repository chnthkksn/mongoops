import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { RoleAssignmentDto } from './create-database-user.dto';

export class UpdateDatabaseUserRolesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleAssignmentDto)
  roles: RoleAssignmentDto[];
}
