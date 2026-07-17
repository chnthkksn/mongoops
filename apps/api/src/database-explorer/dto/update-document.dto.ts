import { IsString, MinLength } from 'class-validator';

export class UpdateDocumentDto {
  @IsString()
  @MinLength(1)
  raw: string;
}
