import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class NameAvailabilityQuery {
  @IsString({ message: 'El nombre es obligatorio' })
  @Matches(/\S/, { message: 'El nombre es obligatorio' })
  @MaxLength(150)
  name: string;

  /** Al editar, excluye el propio módulo de la comparación. */
  @IsOptional()
  @IsUUID('all', { message: 'excludeModuleId debe ser un UUID' })
  excludeModuleId?: string;
}
