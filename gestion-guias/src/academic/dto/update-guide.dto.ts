import { IsISO8601, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export class UpdateGuideDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  competencyId?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  content?: Record<string, unknown>;

  /**
   * DEF-05: fecha de última modificación que tenía la guía cuando se abrió para editar.
   * Si otra persona guardó después, la API responde 409 GUIDE_MODIFIED en lugar de sobrescribir.
   */
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}
