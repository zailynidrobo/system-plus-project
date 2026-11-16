import type { GuideField } from './academic.entities.js';

/**
 * Regla del docente autorizado en su versión: el texto de la guía base se conserva y él solo
 * agrega su complemento después. Las listas, números y fechas (por ejemplo, el tipo de evaluación
 * o las evidencias) sí los puede cambiar.
 */
export function conservaTextoBase(
  field: Pick<GuideField, 'type'>,
  base: unknown,
  value: unknown,
): boolean {
  if (field.type !== 'text' && field.type !== 'textarea') return true;
  const textoBase = typeof base === 'string' ? base.trim() : '';
  if (!textoBase) return true;
  return typeof value === 'string' && value.trim().startsWith(textoBase);
}
