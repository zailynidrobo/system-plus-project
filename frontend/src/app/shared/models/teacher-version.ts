import { GuideContent, GuideField } from './guide-field';

/** Versión personalizada de una guía base en el espacio de un docente (HE-04). */
export interface TeacherVersion {
  id: number;
  guideId: number;
  teacherId: number;
  /** "POO · Grupo 2026-2 · Jornada tarde". Único entre las versiones del mismo docente. */
  name: string;
  /** Copia profunda: nunca comparte referencias con la guía base ni con otra versión. */
  content: GuideContent;
  fields: GuideField[];
  /** Contenido de la guía base en el momento de la copia: permite marcar los campos "Adaptado". */
  baseContent: GuideContent;
  /** Versión de la guía base de la que se copió ("v1.0"). */
  baseVersion: string;
  structureVersion: number;
  /** Última vez que se guardó cada campo (para "Progreso de adaptación"). */
  fieldUpdatedAt: Record<string, string>;
  /** Último campo guardado ("Último cambio: Metodología"). */
  lastField: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Versión con los datos de la guía de origen para mostrar. */
export interface TeacherVersionView extends TeacherVersion {
  guideCode: string;
  guideTitle: string;
  moduleId: number;
  moduleName: string;
  competencyPrefix: string;
  /** Datos actuales de la guía base (pueden cambiar si coordinación aprueba sugerencias). */
  guidePublishedBy: string | null;
  guidePublishedAt: string | null;
  guideUpdatedAt: string;
  guideVersion: string;
  /** Claves de los campos que difieren de la guía base. */
  adaptedKeys: string[];
  /** Campos que el docente puede cambiar (teacherEditable !== false). */
  editableCount: number;
}

/** Datos de la tarjeta "Versiones de otros docentes" (HE-04-HU-02 CA-03). */
export interface AislamientoVersion {
  otrasVersiones: number;
  docentes: string[];
  moduleName: string;
}
