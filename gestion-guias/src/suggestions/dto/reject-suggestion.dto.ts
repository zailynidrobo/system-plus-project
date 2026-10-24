import { IsOptional, IsString } from 'class-validator';

/** Motivo y retroalimentación se revisan en el servicio (REASON_REQUIRED, FEEDBACK_TOO_SHORT...). */
export class RejectSuggestionDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  feedback?: string;
}
