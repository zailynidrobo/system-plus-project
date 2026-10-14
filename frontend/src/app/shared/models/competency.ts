// Competencia de un módulo. Imita el contrato del backend (HE-02):
// gestion-guias/src/academic-program/entities/competency.entity.ts
import { Persona } from './academic-module';

export interface Competency {
  id: number;
  moduleId: number;
  /** Código inmutable: COMP-POO-05. Nunca se reutiliza, aunque la competencia se elimine. */
  code: string;
  sequence: number;
  text: string;
  /** Sube en cada edición del texto. */
  version: number;
  createdBy: Persona | null;
  createdAt: string;
  updatedBy: Persona | null;
  updatedAt: string;
  deletedBy: Persona | null;
  /** Borrado lógico: las guías publicadas siguen resolviendo la competencia. */
  deletedAt: string | null;
}

export interface CompetencyView extends Competency {
  status: 'active' | 'deleted';
  publishedGuidesCount: number;
}

export interface CompetencyRevision {
  competencyId: number;
  version: number;
  text: string;
  editedBy: Persona | null;
  editedAt: string;
}
