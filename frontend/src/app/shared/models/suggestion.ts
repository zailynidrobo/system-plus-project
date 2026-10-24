import { Persona } from './academic-module';
import { GuideValue } from './guide-field';

export type SuggestionStatus = 'Pendiente' | 'Aprobada' | 'Rechazada';

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
  /** Versión de la guía cuando se envió ("v1.0"). */
  baseVersion: string;
  status: SuggestionStatus;
  createdAt: string;
  /** Plazo de respuesta: 5 días hábiles. */
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
}

/** Motivos de rechazo (Figma HE-05-HU-04). */
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
