import { IsNotEmpty, IsObject, IsString, IsUUID } from 'class-validator';

export class CreateGuideDto {
  @IsString()
  @IsNotEmpty()
  moduleId: string;

  @IsUUID()
  competencyId: string;

  @IsObject()
  content: Record<string, unknown>;
}
