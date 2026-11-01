import type { GuideField } from './academic.entities.js';

/** Qué le falta a un valor para ser válido en su campo. */
export type GuideValueProblem =
  'NOT_NUMBER' | 'NOT_TEXT' | 'TOO_LONG' | 'INVALID_DATE' | 'INVALID_OPTION';

/** Un valor vacío: sin dato, `null` o texto en blanco. */
export function isEmptyGuideValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim().length === 0)
  );
}

/**
 * Revisa un valor no vacío contra la definición del campo (tipo, longitud máxima y opciones).
 * La usan las guías base (HE-03), las versiones docentes (HE-04) y las sugerencias (HE-05).
 */
export function checkGuideFieldValue(
  field: GuideField,
  value: unknown,
): GuideValueProblem | null {
  if (field.type === 'number') {
    return typeof value === 'number' && Number.isFinite(value)
      ? null
      : 'NOT_NUMBER';
  }
  if (typeof value !== 'string') return 'NOT_TEXT';
  if (field.maxLength !== undefined && value.length > field.maxLength) {
    return 'TOO_LONG';
  }
  if (field.type === 'date' && Number.isNaN(Date.parse(value))) {
    return 'INVALID_DATE';
  }
  if (field.type === 'select' && !field.options?.includes(value)) {
    return 'INVALID_OPTION';
  }
  return null;
}
