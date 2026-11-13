import { IsInt, Max, Min } from 'class-validator';

/** HE-09-HU-01 · Días hábiles para responder una sugerencia y para avisar que está por vencer. */
export class UpdateSuggestionSettingsDto {
  @IsInt({ message: 'El plazo de respuesta debe ser un número entero de días hábiles' })
  @Min(1, { message: 'El plazo de respuesta debe ser de al menos 1 día hábil' })
  @Max(60, { message: 'El plazo de respuesta no puede superar 60 días hábiles' })
  dueBusinessDays: number;

  @IsInt({ message: 'El aviso de vencimiento debe ser un número entero de días hábiles' })
  @Min(1, { message: 'El aviso de vencimiento debe ser de al menos 1 día hábil' })
  @Max(60, { message: 'El aviso de vencimiento no puede superar 60 días hábiles' })
  dueSoonBusinessDays: number;
}
