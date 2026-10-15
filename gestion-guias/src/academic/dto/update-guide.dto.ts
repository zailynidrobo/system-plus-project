import { IsNotEmpty, IsObject, IsString, ValidateIf } from 'class-validator';

export class UpdateGuideDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  content?: Record<string, unknown>;
}
