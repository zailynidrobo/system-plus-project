import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const NOT_BLANK = /\S/;

export class CreateCurricularModuleDto {
  @IsString({ message: 'El nombre del módulo debe ser texto' })
  @Matches(NOT_BLANK, { message: 'El nombre del módulo es obligatorio' })
  @MaxLength(150, {
    message: 'El nombre del módulo admite máximo 150 caracteres',
  })
  name: string;

  /** Obligatoria para registrar; opcional al guardar como borrador. */
  @ValidateIf(
    (dto: CreateCurricularModuleDto) =>
      dto.draft !== true || dto.description !== undefined,
  )
  @IsString({ message: 'La descripción debe ser texto' })
  @Matches(NOT_BLANK, { message: 'La descripción es obligatoria' })
  @MaxLength(2000, { message: 'La descripción admite máximo 2000 caracteres' })
  description?: string;

  /** `true` → "Guardar borrador"; omitido o `false` → "Registrar módulo". */
  @IsOptional()
  @IsBoolean({ message: 'draft debe ser booleano' })
  draft?: boolean;
}
