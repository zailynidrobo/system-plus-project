/**
 * Reglas de negocio de HE-05 (sugerencias de cambio). Es el único lugar donde viven los
 * números y las decisiones pendientes de confirmar con el cliente (ver docs/he05-sugerencias.md).
 *
 * Los plazos y la anticipación se pueden cambiar con variables de entorno. Más adelante
 * HE-09-HU-01 los moverá a la base para que el administrador los configure.
 */

/**
 * Motivos de rechazo (Figma HE-05-HU-04). La misma lista, en el mismo orden, está en el front:
 * `frontend/src/app/shared/models/suggestion.ts` (MOTIVOS_RECHAZO).
 */
export const REJECT_REASONS = [
  'No se ajusta a la intensidad horaria del módulo',
  'No está alineada con la competencia',
  'Requiere más sustento pedagógico',
  'Duplica contenido existente en la guía',
  'Otro motivo',
] as const;

export interface SuggestionRules {
  /** Día hábil desde el que la sugerencia pasa a "por vencer" (fin de ese día). */
  dueSoonBusinessDays: number;
  /** Día hábil límite de respuesta (fin de ese día). Después queda "vencida", pero sigue pendiente. */
  dueBusinessDays: number;
  /** Días de calendario mínimos entre el envío y la fecha en que el docente necesita el cambio. */
  minNoticeDays: number;
  /** Zona horaria para los límites de día. */
  timeZone: string;
  justificationMinLength: number;
  feedbackMinLength: number;
  feedbackMaxLength: number;
  rejectReasons: readonly string[];
  /**
   * Pendiente por confirmar: si la fecha requerida (`neededBy`) es obligatoria siempre.
   * Por defecto, sí.
   */
  neededByRequired: boolean;
  /**
   * El docente autorizado también necesita tener asignado el módulo para sugerir cambios
   * (HE-05-HU-01: "solo sobre una guía de un módulo asignado").
   */
  authorizedTeacherNeedsAssignment: boolean;
  /**
   * Pendiente por confirmar: quién recibe el aviso "Nueva versión" al aprobar.
   *  · 'module-teachers': todos los docentes asignados al módulo, menos el autor (por defecto).
   *  · 'teachers-with-version': solo los que tienen una versión personalizada de esa guía.
   */
  newVersionRecipients: 'module-teachers' | 'teachers-with-version';
}

export const DEFAULT_SUGGESTION_RULES: SuggestionRules = {
  dueSoonBusinessDays: 5,
  dueBusinessDays: 8,
  minNoticeDays: 14,
  timeZone: 'America/Bogota',
  justificationMinLength: 20,
  feedbackMinLength: 30,
  feedbackMaxLength: 500,
  rejectReasons: REJECT_REASONS,
  neededByRequired: true,
  authorizedTeacherNeedsAssignment: true,
  newVersionRecipients: 'module-teachers',
};

/** Token de inyección de las reglas (ver SuggestionsModule). */
export const SUGGESTION_RULES = Symbol('SUGGESTION_RULES');

/**
 * Reglas con los valores de las variables de entorno, si están:
 *  · SUGGESTION_DUE_SOON_BUSINESS_DAYS (por defecto 5)
 *  · SUGGESTION_DUE_BUSINESS_DAYS (por defecto 8)
 *  · SUGGESTION_MIN_NOTICE_DAYS (por defecto 14)
 * Un valor inválido detiene el arranque con un mensaje claro.
 */
export function loadSuggestionRules(
  read: (name: string) => string | undefined,
): SuggestionRules {
  const integer = (name: string, fallback: number) => {
    const raw = read(name)?.trim();
    if (!raw) return fallback;
    if (!/^\d+$/.test(raw) || Number(raw) < 1) {
      throw new Error(
        `${name} debe ser un entero mayor que 0 (recibido: "${raw}")`,
      );
    }
    return Number(raw);
  };
  const rules: SuggestionRules = {
    ...DEFAULT_SUGGESTION_RULES,
    dueSoonBusinessDays: integer(
      'SUGGESTION_DUE_SOON_BUSINESS_DAYS',
      DEFAULT_SUGGESTION_RULES.dueSoonBusinessDays,
    ),
    dueBusinessDays: integer(
      'SUGGESTION_DUE_BUSINESS_DAYS',
      DEFAULT_SUGGESTION_RULES.dueBusinessDays,
    ),
    minNoticeDays: integer(
      'SUGGESTION_MIN_NOTICE_DAYS',
      DEFAULT_SUGGESTION_RULES.minNoticeDays,
    ),
  };
  if (rules.dueSoonBusinessDays > rules.dueBusinessDays) {
    throw new Error(
      'SUGGESTION_DUE_SOON_BUSINESS_DAYS no puede ser mayor que SUGGESTION_DUE_BUSINESS_DAYS',
    );
  }
  return rules;
}
