import { IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

const NOT_BLANK = /\S/;

export class UpdateCurricularModuleDto {
  @ValidateIf((_dto, value) => value !== undefined)
  @IsString({ message: 'El nombre del módulo debe ser texto' })
  @Matches(NOT_BLANK, { message: 'El nombre del módulo no puede quedar vacío' })
  @MaxLength(150, {
    message: 'El nombre del módulo admite máximo 150 caracteres',
  })
  name?: string;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsString({ message: 'La descripción debe ser texto' })
  @Matches(NOT_BLANK, { message: 'La descripción no puede quedar vacía' })
  @MaxLength(2000, { message: 'La descripción admite máximo 2000 caracteres' })
  description?: string;
}
