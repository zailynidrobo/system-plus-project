import { IsNotEmpty, IsString, ValidateIf } from 'class-validator';

export class CreateAcademicModuleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  description?: string;
}
