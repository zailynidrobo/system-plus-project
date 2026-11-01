import { QueryFailedError } from 'typeorm';

const STOPWORDS = new Set([
  'a',
  'al',
  'con',
  'de',
  'del',
  'e',
  'el',
  'en',
  'la',
  'las',
  'lo',
  'los',
  'o',
  'para',
  'por',
  'u',
  'un',
  'una',
  'y',
]);

const MAX_PREFIX_LENGTH = 6;

/** Colapsa espacios internos y elimina los de los extremos. */
export function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Clave de comparación: sin distinguir mayúsculas, minúsculas ni espacios sobrantes. */
export function normalizeForComparison(value: string): string {
  return cleanText(value).toLocaleLowerCase('es');
}

/** TS + 6 -> TS-MOD-06 */
export function formatModuleCode(
  programCode: string,
  sequence: number,
): string {
  return `${programCode}-MOD-${String(sequence).padStart(2, '0')}`;
}

/** POO + 5 -> COMP-POO-05 */
export function formatCompetencyCode(prefix: string, sequence: number): string {
  return `COMP-${prefix}-${String(sequence).padStart(2, '0')}`;
}

/**
 * Sigla del módulo a partir de las iniciales de sus palabras significativas:
 * "Programación Orientada a Objetos" -> POO, "Bases de Datos" -> BD, "Redes" -> RED.
 */
export function buildCompetencyPrefix(moduleName: string): string {
  const words = moduleName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((word) => word.length > 0);
  const significant = words.filter(
    (word) => !STOPWORDS.has(word.toLowerCase()),
  );
  const source = significant.length > 0 ? significant : words;

  if (source.length === 0) return 'MOD';
  if (source.length === 1) return source[0].slice(0, 3);
  return source
    .map((word) => word[0])
    .join('')
    .slice(0, MAX_PREFIX_LENGTH);
}

/** Devuelve `base` o, si ya está en uso, `base2`, `base3`, ... */
export function ensureUniquePrefix(
  base: string,
  takenPrefixes: Iterable<string>,
): string {
  const taken = new Set(takenPrefixes);
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix++) {
    const candidate = `${base}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Violación de restricción UNIQUE en PostgreSQL (código 23505). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code === '23505'
  );
}
