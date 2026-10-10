import { IsObject, ValidateIf } from 'class-validator';

export class UpdatePersonalizedGuideVersionDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  content?: Record<string, unknown>;
}
