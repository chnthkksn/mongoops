import { IsObject } from 'class-validator';

export class SetValidatorDto {
  @IsObject()
  validator: Record<string, unknown>;
}
