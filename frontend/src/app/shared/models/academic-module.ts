// Módulo del plan curricular. Imita el contrato del backend (HE-02):
// gestion-guias/src/academic-program/entities/curricular-module.entity.ts

/** draft: borrador · active: admite competencias y guías nuevas · inactive: inhabilitado (HU-03). */
export type ModuleStatus = 'draft' | 'active' | 'inactive';

export const MODULE_STATUS_LABELS: Record<ModuleStatus, string> = {
  draft: 'Borrador',
  active: 'Activo',
  inactive: 'Inhabilitado',
};

export interface Persona {
  id: number;
  name: string;
}

export interface AcademicModule {
  id: number;
  programId: number;
  /** Código legible e inmutable: TS-MOD-06. */
  code: string;
  sequence: number;
  name: string;
  description: string | null;
  status: ModuleStatus;
  /** Sigla usada en los códigos de competencia: POO → COMP-POO-01. */
  competencyPrefix: string;
  createdBy: Persona | null;
  createdAt: string;
  updatedBy: Persona | null;
  updatedAt: string;
  inactivatedBy: Persona | null;
  inactivatedAt: string | null;
  inactivationReason: string | null;
}

export interface Program {
  id: number;
  code: string;
  name: string;
  campus: string;
}
