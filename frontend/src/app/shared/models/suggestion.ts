import { Persona } from './academic-module';
import { GuideValue } from './guide-field';

export type SuggestionStatus = 'Pendiente' | 'Aprobada' | 'Rechazada';

/** Estado del plazo de una pendiente: a tiempo, por vencer (desde el día hábil 5) o vencida (después del 8). */
export type EstadoPlazo = 'on_time' | 'due_soon' | 'overdue';

/** Sugerencia de cambio de un docente sobre un campo de una guía base publicada (HE-05). */
export interface Suggestion {
  id: number;
  /** SUG-014 */
  code: string;
  guideId: number;
  fieldKey: string;
  fieldLabel: string;
  teacherId: number;
  teacherName: string;
  /** Valor del campo en la guía cuando se envió: permite detectar si la guía cambió después. */
  currentValue: GuideValue;
  /** Contenido completo que tendría el campo si se aprueba. */
  proposedValue: GuideValue;
  justification: string;
  /** Fecha (AAAA-MM-DD) en que el docente necesita el cambio aplicado. */
  neededBy: string | null;
  /** Versión de la guía cuando se envió ("v1.0"). */
  baseVersion: string;
  status: SuggestionStatus;
  createdAt: string;
  /** Fin del día hábil 5 en Bogotá: desde aquí queda "por vencer". */
  dueSoonAt: string;
  /** Fin del día hábil 8: tiempo límite. Después queda vencida, pero sigue pendiente. */
  dueAt: string;
  decidedAt: string | null;
  decidedBy: Persona | null;
  rejectReason: string | null;
  feedback: string | null;
  /** Versión de la guía que resultó al aprobarla ("v1.1"). */
  resultingVersion: string | null;
}

/** Sugerencia con los datos de la guía y del módulo para mostrar. */
export interface SuggestionView extends Suggestion {
  guideCode: string;
  guideTitle: string;
  guideVersion: string;
  moduleId: number;
  moduleName: string;
  competencyPrefix: string;
  /** "Agrega «...»" o "Cambia a «...»": resumen corto para las tablas. */
  summary: string;
  /** Solo en pendientes; null en las decididas. */
  deadlineStatus: EstadoPlazo | null;
  businessDaysLeft: number | null;
  businessDaysOverdue: number | null;
}

/**
 * Motivos de rechazo (Figma HE-05-HU-04). La lista oficial está en el backend
 * (gestion-guias/src/suggestions/suggestion-rules.ts, REJECT_REASONS): esta debe ser idéntica.
 */
export const MOTIVOS_RECHAZO = [
  'No se ajusta a la intensidad horaria del módulo',
  'No está alineada con la competencia',
  'Requiere más sustento pedagógico',
  'Duplica contenido existente en la guía',
  'Otro motivo',
] as const;

export const RETROALIMENTACION_MIN = 30;
export const RETROALIMENTACION_MAX = 500;
export const JUSTIFICACION_MIN = 20;

/** Plazo de respuesta: aviso al día hábil 5 y límite al día hábil 8 (mismos valores que el backend). */
export const PLAZO_AVISO_DIAS_HABILES = 5;
export const PLAZO_LIMITE_DIAS_HABILES = 8;
/** La fecha requerida debe ser al menos 14 días de calendario después del envío. */
export const ANTICIPACION_MINIMA_DIAS = 14;
