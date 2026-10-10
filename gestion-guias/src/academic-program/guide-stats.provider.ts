import { Injectable } from '@nestjs/common';

export interface ModuleGuideStats {
  /** Guías existentes del módulo (cualquier estado). */
  total: number;
  /** Guías publicadas del módulo. */
  published: number;
}

/**
 * Punto de integración con el componente "Guías base" (HE-03).
 * Los prototipos de HE-02 muestran cuántas guías tiene cada módulo y competencia,
 * pero esos datos pertenecen a otro componente. Cuando exista la persistencia de guías,
 * basta con registrar otra implementación en `AcademicProgramModule`.
 */
export abstract class GuideStatsProvider {
  abstract getModuleStats(
    moduleIds: string[],
  ): Promise<Map<string, ModuleGuideStats>>;
  abstract getPublishedCountByCompetency(
    competencyIds: string[],
  ): Promise<Map<string, number>>;
}

/** Implementación por defecto mientras el módulo de guías no esté persistido: no hay guías. */
@Injectable()
export class EmptyGuideStatsProvider extends GuideStatsProvider {
  getModuleStats(): Promise<Map<string, ModuleGuideStats>> {
    return Promise.resolve(new Map());
  }

  getPublishedCountByCompetency(): Promise<Map<string, number>> {
    return Promise.resolve(new Map());
  }
}
