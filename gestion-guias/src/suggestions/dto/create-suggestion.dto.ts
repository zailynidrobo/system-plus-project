import { Allow, IsOptional, IsString } from 'class-validator';

/**
 * Los datos obligatorios se revisan en el servicio para responder con su código de HE-05
 * (FIELD_NOT_FOUND, JUSTIFICATION_REQUIRED, NEEDED_BY_REQUIRED...), no con el error genérico.
 */
export class CreateSuggestionDto {
  @IsOptional()
  @IsString()
  fieldKey?: string;

  /** Contenido completo que tendrá el campo: texto, número o null. Se valida contra el campo. */
  @Allow()
  proposedValue?: unknown;

  @IsOptional()
  @IsString()
  justification?: string;

  /** YYYY-MM-DD */
  @IsOptional()
  @IsString()
  neededBy?: string;
}
