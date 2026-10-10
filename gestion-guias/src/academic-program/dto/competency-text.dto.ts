import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Cuerpo para asociar (HU-04) y editar (HU-05) una competencia: solo el texto es editable. */
export class CompetencyTextDto {
  @IsString({ message: 'El texto de la competencia debe ser texto' })
  @Matches(/\S/, { message: 'El texto de la competencia es obligatorio' })
  @MinLength(10, {
    message: 'El texto de la competencia debe tener al menos 10 caracteres',
  })
  @MaxLength(1000, {
    message: 'El texto de la competencia admite máximo 1000 caracteres',
  })
  text: string;
}
