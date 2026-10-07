import { IsNotEmpty, IsObject, IsString, ValidateIf } from 'class-validator';

export class CreateGuideDto {
  @IsString()
  @IsNotEmpty()
  moduleId: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  competencyId?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsObject()
  content: Record<string, unknown>;
}
