import {
  DETAILS_MAX_ITEMS,
  DETAILS_MAX_LENGTH,
  DETAILS_MAX_TEXT,
  RESULT_KEYS,
  SENSITIVE_KEYS,
} from './audit-rules.js';

const MAX_DEPTH = 4;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isSensitiveKey = (key: string) => {
  const normalized = key.toLowerCase().replace(/[^a-z]/g, '');
  return SENSITIVE_KEYS.some((word) => normalized.includes(word));
};

function clean(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return value.slice(0, DETAILS_MAX_TEXT);
  if (value === null || typeof value !== 'object') {
    return typeof value === 'number' || typeof value === 'boolean'
      ? value
      : undefined;
  }
  if (depth >= MAX_DEPTH) return undefined;
  if (Array.isArray(value)) {
    return value
      .slice(0, DETAILS_MAX_ITEMS)
      .map((item) => clean(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (isSensitiveKey(key)) continue;
    const cleaned = clean(item, depth + 1);
    if (cleaned !== undefined) result[key] = cleaned;
  }
  return result;
}

/**
 * Deja `details` listo para guardar: sin contraseñas, tokens ni secretos (aunque vengan
 * anidados), con textos y listas recortados y sin pasar de DETAILS_MAX_LENGTH.
 */
export function sanitizeDetails(
  details: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!details) return null;
  const cleaned = clean(details, 0) as Record<string, unknown>;
  if (Object.keys(cleaned).length === 0) return null;
  if (JSON.stringify(cleaned).length <= DETAILS_MAX_LENGTH) return cleaned;
  // Demasiado grande: solo los nombres de las llaves, para saber qué había.
  return {
    truncated: true,
    keys: Object.keys(cleaned).slice(0, DETAILS_MAX_ITEMS),
  };
}

/**
 * Resumen de una acción exitosa: los campos que se enviaron y el estado resultante (versión,
 * estado, rol...). No copia valores del cuerpo para no guardar el contenido de las guías.
 */
export function summarizeChange(
  body: unknown,
  response: unknown,
): Record<string, unknown> | null {
  const summary: Record<string, unknown> = {};
  if (isObject(body)) {
    const fields = Object.keys(body).filter((key) => !isSensitiveKey(key));
    if (fields.length) summary.fields = fields;
  }
  if (isObject(response)) {
    for (const key of RESULT_KEYS) {
      const value = response[key];
      if (['string', 'number', 'boolean'].includes(typeof value)) {
        summary[key] = value;
      }
    }
  }
  return sanitizeDetails(summary);
}
