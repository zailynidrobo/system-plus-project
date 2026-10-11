import { Competency } from './entities/competency.entity.js';
import {
  CurricularModule,
  CurricularModuleStatus,
} from './entities/curricular-module.entity.js';
import { ModuleGuideStats } from './guide-stats.provider.js';

const NO_GUIDES: ModuleGuideStats = { total: 0, published: 0 };

function person(id: string | null, name: string | null) {
  return id === null ? null : { id, name };
}

/** Fila del listado "Programa académico". */
export function toModuleView(
  module: CurricularModule,
  competenciesCount: number,
  guides: ModuleGuideStats = NO_GUIDES,
) {
  return {
    id: module.id,
    programId: module.programId,
    code: module.code,
    name: module.name,
    description: module.description,
    status: module.status,
    competenciesCount,
    guidesCount: guides.total,
    publishedGuidesCount: guides.published,
    /** Las nuevas guías solo pueden crearse sobre módulos activos con al menos una competencia. */
    availableForGuides:
      module.status === CurricularModuleStatus.ACTIVE && competenciesCount > 0,
    createdAt: module.createdAt,
    updatedAt: module.updatedAt,
  };
}

export function toModuleAudit(module: CurricularModule) {
  return {
    createdBy: person(module.createdById, module.createdByName),
    createdAt: module.createdAt,
    updatedBy: person(module.updatedById, module.updatedByName),
    updatedAt: module.updatedAt,
    inactivatedBy: person(module.inactivatedById, module.inactivatedByName),
    inactivatedAt: module.inactivatedAt,
    inactivationReason: module.inactivationReason,
  };
}

export function toCompetencyView(
  competency: Competency,
  publishedGuidesCount = 0,
) {
  return {
    id: competency.id,
    moduleId: competency.moduleId,
    code: competency.code,
    text: competency.text,
    version: competency.version,
    status: competency.deletedAt ? ('deleted' as const) : ('active' as const),
    publishedGuidesCount,
    createdBy: person(competency.createdById, competency.createdByName),
    createdAt: competency.createdAt,
    updatedBy: person(competency.updatedById, competency.updatedByName),
    updatedAt: competency.updatedAt,
    deletedBy: person(competency.deletedById, competency.deletedByName),
    deletedAt: competency.deletedAt,
  };
}
