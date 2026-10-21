import { Persona } from './academic-module';
import { GuideContent, GuideField } from './guide-field';

export type GuideStatus = 'Borrador' | 'Publicada';

/** Guía base institucional (HE-03). */
export interface Guide {
  id: number;
  /** GB-<SIGLA>-NN */
  code: string;
  moduleId: number;
  competencyId: number | null;
  title: string;
  status: GuideStatus;
  /** Valores por campo. */
  content: GuideContent;
  /** Copia de la estructura usada: cambiar la configuración no altera las guías publicadas. */
  fields: GuideField[];
  /** Versión de la estructura con la que se diligenció ("Estructura v3"). */
  structureVersion: number;
  /** Versión vigente del contenido, p. ej. "v1.0"; sube al aprobar sugerencias. */
  version: string;
  createdAt: string;
  createdBy: Persona | null;
  updatedAt: string;
  updatedBy: Persona | null;
  publishedAt: string | null;
  publishedBy: Persona | null;
}

/** Guía con los datos de su módulo y competencia para mostrar. */
export interface GuideView extends Guide {
  moduleName: string;
  moduleCode: string;
  competencyPrefix: string;
  competencyCode: string | null;
  competencyText: string | null;
  competencyDeleted: boolean;
}

/** Evento del historial de una guía ("Criterios de evaluación editados · Hoy, 9:24 a. m. · Laura Muñoz"). */
export interface GuideEvent {
  guideId: number;
  titulo: string;
  autor: string;
  fecha: string;
}
