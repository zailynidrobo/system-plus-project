import { ApiError } from '../../shared/models/api-error';
import { FieldConfig } from '../../shared/models/guide-field';
import { ahoraIso } from '../../shared/utils/fechas';
import { MockDb } from './mock-db';
import { camposPorDefecto } from './seed-guides';

export type OrigenEstructura = 'competencia' | 'modulo' | 'predeterminada';

export interface EstructuraVigente {
  config: FieldConfig;
  origen: OrigenEstructura;
}

/** La estructura de la competencia si existe; si no, la del módulo; si no, la institucional. */
export function estructuraVigente(db: MockDb, moduleId: number, competencyId: number | null): EstructuraVigente {
  if (!db.modulos.some((m) => m.id === moduleId)) throw new ApiError('NOT_FOUND');
  const deCompetencia = competencyId
    ? db.estructuras.find((e) => e.moduleId === moduleId && e.competencyId === competencyId)
    : undefined;
  if (deCompetencia) return { config: deCompetencia, origen: 'competencia' };
  const delModulo = db.estructuras.find((e) => e.moduleId === moduleId && e.competencyId === null);
  if (delModulo) return { config: delModulo, origen: 'modulo' };
  return {
    config: { moduleId, competencyId: null, fields: camposPorDefecto(), version: 1, updatedAt: ahoraIso(), updatedBy: 'Sistema' },
    origen: 'predeterminada',
  };
}
