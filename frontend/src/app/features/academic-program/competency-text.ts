import { AbstractControl, ValidationErrors } from '@angular/forms';
import { cleanText } from '../../shared/utils/curricular';

/** Límites del texto de una competencia (los mismos que valida el backend). */
export const COMPETENCIA_MIN = 10;
export const COMPETENCIA_MAX = 1000;

/**
 * Valida la longitud del texto ya limpio (sin espacios sobrantes). Un texto vacío lo cubre
 * `Validators.required`, así cada caso muestra su propio aviso.
 */
export function longitudCompetencia(control: AbstractControl<string>): ValidationErrors | null {
  const largo = cleanText(control.value ?? '').length;
  if (largo === 0) return null;
  if (largo < COMPETENCIA_MIN) return { corto: true };
  if (largo > COMPETENCIA_MAX) return { largo: true };
  return null;
}
