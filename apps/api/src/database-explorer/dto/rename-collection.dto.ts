import { IsString, MinLength } from 'class-validator';

export class RenameCollectionDto {
  @IsString()
  @MinLength(1)
  newName: string;
}
