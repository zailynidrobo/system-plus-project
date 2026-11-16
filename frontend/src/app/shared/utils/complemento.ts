import { GuideFieldType } from '../models/guide-field';

/**
 * Versión del docente autorizado: el texto de la guía base se conserva y él agrega su complemento
 * después, separado por una línea en blanco. Las listas, números y fechas sí los puede cambiar.
 */
export const SEPARADOR_COMPLEMENTO = '\n\n';

export function esCampoDeTexto(tipo: GuideFieldType): boolean {
  return tipo === 'text' || tipo === 'textarea';
}

/** Lo que el docente escribió después del texto base. Si no empieza por la base, todo es complemento. */
export function complementoDe(valor: string, base: string): string {
  const v = valor.trim();
  const b = base.trim();
  if (!b) return v;
  return v.startsWith(b) ? v.slice(b.length).trim() : v;
}

export function unirComplemento(base: string, complemento: string): string {
  const b = base.trim();
  const c = complemento.trim();
  if (!b) return c;
  return c ? `${b}${SEPARADOR_COMPLEMENTO}${c}` : b;
}

/** Misma regla que valida la API (BASE_TEXT_REQUIRED). */
export function conservaTextoBase(tipo: GuideFieldType, base: unknown, valor: unknown): boolean {
  if (!esCampoDeTexto(tipo)) return true;
  const b = typeof base === 'string' ? base.trim() : '';
  if (!b) return true;
  return typeof valor === 'string' && valor.trim().startsWith(b);
}
