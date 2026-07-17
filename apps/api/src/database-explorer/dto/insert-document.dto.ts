import { IsString, MinLength } from 'class-validator';

export class InsertDocumentDto {
  @IsString()
  @MinLength(1)
  raw: string;
}
