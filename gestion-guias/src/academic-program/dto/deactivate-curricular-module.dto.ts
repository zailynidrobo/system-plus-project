import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeactivateCurricularModuleDto {
  @IsOptional()
  @IsString({ message: 'El motivo debe ser texto' })
  @MaxLength(500, { message: 'El motivo admite máximo 500 caracteres' })
  reason?: string;
}
