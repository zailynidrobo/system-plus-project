// Vistas calculadas a partir de MockDb, como las arma el backend
// (academic-program.views.ts: toModuleView / toCompetencyView).
import { AcademicModule, ModuleView, Persona } from '../../shared/models/academic-module';
import { Competency, CompetencyView } from '../../shared/models/competency';
import { Guide, GuideView } from '../../shared/models/guide';
import { GuideValue } from '../../shared/models/guide-field';
import { TeacherVersion, TeacherVersionView } from '../../shared/models/teacher-version';
import { Suggestion, SuggestionView } from '../../shared/models/suggestion';
import { estadoDelPlazo, resumenCambio } from '../../shared/utils/sugerencias';
import { Auth } from '../auth/auth';
import { MockDb } from './mock-db';

export function vistaModulo(db: MockDb, m: AcademicModule): ModuleView {
  const competenciesCount = db.competencias.filter((c) => c.moduleId === m.id && !c.deletedAt).length;
  const guias = db.guias.filter((g) => g.moduleId === m.id);
  return {
    ...m,
    competenciesCount,
    guidesCount: guias.length,
    publishedGuidesCount: guias.filter((g) => g.status === 'Publicada').length,
    availableForGuides: m.status === 'active' && competenciesCount > 0,
  };
}

export function vistaCompetencia(db: MockDb, c: Competency): CompetencyView {
  return {
    ...c,
    status: c.deletedAt ? 'deleted' : 'active',
    publishedGuidesCount: db.guias.filter((g) => g.competencyId === c.id && g.status === 'Publicada').length,
  };
}

export function vistaGuia(db: MockDb, g: Guide): GuideView {
  const modulo = db.modulos.find((m) => m.id === g.moduleId);
  const competencia = db.competencias.find((c) => c.id === g.competencyId);
  return {
    ...g,
    moduleName: modulo?.name ?? '',
    moduleCode: modulo?.code ?? '',
    competencyPrefix: modulo?.competencyPrefix ?? '',
    competencyCode: competencia?.code ?? null,
    competencyText: competencia?.text ?? null,
    competencyDeleted: !!competencia?.deletedAt,
  };
}

const comparable = (v: GuideValue | undefined) => (v === null || v === undefined ? '' : String(v).trim());

export function vistaVersion(db: MockDb, v: TeacherVersion): TeacherVersionView {
  const guia = db.guias.find((g) => g.id === v.guideId);
  const modulo = db.modulos.find((m) => m.id === guia?.moduleId);
  return {
    ...v,
    guideCode: guia?.code ?? '',
    guideTitle: guia?.title ?? '',
    guidePublishedBy: guia?.publishedBy?.name ?? null,
    guidePublishedAt: guia?.publishedAt ?? null,
    guideUpdatedAt: guia?.updatedAt ?? '',
    guideVersion: guia?.version ?? '',
    moduleId: modulo?.id ?? 0,
    moduleName: modulo?.name ?? '',
    competencyPrefix: modulo?.competencyPrefix ?? '',
    adaptedKeys: v.fields
      .filter((f) => comparable(v.content[f.key]) !== comparable(v.baseContent[f.key]))
      .map((f) => f.key),
    editableCount: v.fields.filter((f) => f.teacherEditable !== false).length,
  };
}

export function vistaSugerencia(db: MockDb, s: Suggestion, ahora = new Date()): SuggestionView {
  const guia = db.guias.find((g) => g.id === s.guideId);
  const modulo = db.modulos.find((m) => m.id === guia?.moduleId);
  return {
    ...s,
    guideCode: guia?.code ?? '',
    guideTitle: guia?.title ?? '',
    guideVersion: guia?.version ?? '',
    moduleId: modulo?.id ?? 0,
    moduleName: modulo?.name ?? '',
    competencyPrefix: modulo?.competencyPrefix ?? '',
    summary: resumenCambio(s.currentValue, s.proposedValue),
    ...estadoDelPlazo(s, ahora),
  };
}

/** Quién hace la acción, para la auditoría (createdBy, updatedBy, ...). */
export function personaActual(auth: Auth): Persona | null {
  const u = auth.user();
  return u ? { id: u.id, name: u.nombre } : null;
}
