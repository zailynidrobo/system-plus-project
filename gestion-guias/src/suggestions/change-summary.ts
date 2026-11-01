/** Valor de un campo como texto comparable (sin espacios al inicio ni al final). */
export const comparableValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return JSON.stringify(value);
};

const shorten = (text: string, max = 70) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}...` : text;

/**
 * Resumen corto del cambio para las tablas. Misma lógica que `resumenCambio` del front
 * (frontend/src/app/shared/utils/sugerencias.ts): si el docente agregó texto al final,
 * muestra lo agregado; si no, el valor nuevo.
 */
export function changeSummary(current: unknown, proposed: unknown): string {
  const before = comparableValue(current);
  const after = comparableValue(proposed);
  if (before && after.startsWith(before) && after.length > before.length) {
    return `Agrega «${shorten(after.slice(before.length).trim())}»`;
  }
  if (!after) return 'Deja el campo vacío';
  return `Cambia a «${shorten(after)}»`;
}

/** Al aprobar una sugerencia la guía sube una versión menor: v1.0 -> v1.1, v2.1 -> v2.2. */
export function nextMinorVersion(version: string): string {
  const match = /^v(\d+)\.(\d+)$/.exec(version);
  return match ? `v${match[1]}.${Number(match[2]) + 1}` : 'v1.1';
}

/** "SUG-014" */
export function formatSuggestionCode(sequence: number): string {
  return `SUG-${String(sequence).padStart(3, '0')}`;
}

/** "Julián Andrés Ospina" -> "Julián Ospina" (como el front en las alertas). */
export function shortName(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : name;
}
