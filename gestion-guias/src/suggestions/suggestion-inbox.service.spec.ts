import { randomUUID } from 'node:crypto';
import { AcademicGuideRecord } from '../academic/entities/academic-guide-record.entity.js';
import { ModuleTeacherAssignmentRecord } from '../academic/entities/module-teacher-assignment-record.entity.js';
import { PersonalizedGuideVersionRecord } from '../academic/entities/personalized-guide-version-record.entity.js';
import { CurricularModule } from '../academic-program/entities/curricular-module.entity.js';
import { SuggestionRecord } from './entities/suggestion-record.entity.js';
import { SuggestionInboxService } from './suggestion-inbox.service.js';
import { SuggestionSubmissionService } from './suggestion-submission.service.js';
import {
  CARLOS,
  JULIAN,
  JUSTIFICATION,
  PAOLA,
  Scenario,
  createScenario,
  errorOf,
} from './suggestions.fixture-spec.js';

describe('HE-05-HU-02 · Revisar pendientes', () => {
  let scenario: Scenario;
  let inbox: SuggestionInboxService;
  let submission: SuggestionSubmissionService;

  const send = (
    teacher = JULIAN,
    fieldKey = 'criterios',
    guideId = scenario.guide.id,
  ) =>
    submission.create(
      guideId,
      {
        fieldKey,
        proposedValue:
          fieldKey === 'intensidad'
            ? '60 horas · 15 semanas'
            : `Texto nuevo de ${teacher.name} para ${fieldKey}.`,
        justification: JUSTIFICATION,
        neededBy: '2026-12-01',
      },
      teacher,
    );

  /** Marca una sugerencia como decidida directamente en la base (HU-03 y HU-04 se prueban aparte). */
  const decide = (id: string, status: 'approved' | 'rejected') => {
    const row = scenario.suggestions().find((s) => s.id === id)!;
    Object.assign(row, {
      status,
      decidedAt: scenario.clock.now(),
      decidedById: 'coord',
      decidedByName: 'Laura Muñoz',
    });
  };

  beforeEach(() => {
    scenario = createScenario();
    const { store } = scenario;
    submission = new SuggestionSubmissionService(
      store.repository(SuggestionRecord),
      store.repository(AcademicGuideRecord),
      store.repository(ModuleTeacherAssignmentRecord),
      store.dataSource,
      scenario.views,
      scenario.rules,
    );
    inbox = new SuggestionInboxService(
      store.repository(SuggestionRecord),
      store.repository(AcademicGuideRecord),
      store.repository(ModuleTeacherAssignmentRecord),
      store.repository(PersonalizedGuideVersionRecord),
      scenario.views,
    );
  });

  it('filtra por estado y ordena por fecha de envío', async () => {
    const a = await send(JULIAN);
    scenario.clock.set('2026-10-30T16:00:00Z');
    const b = await send(PAOLA);
    scenario.clock.set('2026-10-30T17:00:00Z');
    const c = await send(CARLOS);
    decide(c.id, 'rejected');

    expect(
      (await inbox.list({ status: 'pending' })).map((s) => s.code),
    ).toEqual([a.code, b.code]);
    expect(
      (await inbox.list({ status: 'pending', order: 'desc' })).map(
        (s) => s.code,
      ),
    ).toEqual([b.code, a.code]);
    expect(
      (await inbox.list({ status: 'rejected' })).map((s) => s.code),
    ).toEqual([c.code]);
    expect(await inbox.list({ status: 'all' })).toHaveLength(3);
    expect(await inbox.list()).toHaveLength(3);
  });

  it('filtra por módulo y por guía', async () => {
    const otherModule = {
      id: randomUUID(),
      name: 'Bases de Datos',
      competencyPrefix: 'BD',
    } as CurricularModule;
    scenario.store.rows<CurricularModule>(CurricularModule).push(otherModule);
    const otherGuide = scenario.addGuide({
      code: 'GB-BD-01',
      moduleId: otherModule.id,
      moduleName: otherModule.name,
    });
    scenario.assign(JULIAN.id, otherModule.id);
    await send(JULIAN);
    const inOther = await send(JULIAN, 'criterios', otherGuide.id);

    expect(
      (await inbox.list({ moduleId: otherModule.id })).map((s) => s.id),
    ).toEqual([inOther.id]);
    expect(
      (await inbox.list({ guideId: otherGuide.id })).map(
        (s) => s.competencyPrefix,
      ),
    ).toEqual(['BD']);
    expect((await inbox.guidesWithSuggestions()).map((g) => g.code)).toEqual([
      'GB-BD-01',
      'GB-POO-01',
    ]);
  });

  it('filtra por estado del plazo y cuenta por vencer y vencidas en el resumen', async () => {
    const old = await send(JULIAN); // 30 oct: vence el 12 nov
    scenario.clock.set('2026-11-06T15:00:00Z');
    const recent = await send(PAOLA); // 6 nov: vence el 19 nov
    scenario.clock.set('2026-11-11T15:00:00Z');
    const decided = await send(CARLOS);
    decide(decided.id, 'approved');

    // 11 nov: la primera está por vencer y la segunda a tiempo.
    expect(
      (await inbox.list({ deadline: 'due_soon' })).map((s) => s.id),
    ).toEqual([old.id]);
    expect(
      (await inbox.list({ deadline: 'on_time' })).map((s) => s.id),
    ).toEqual([recent.id]);
    expect(
      await inbox.list({ status: 'approved', deadline: 'overdue' }),
    ).toEqual([]);

    // 17 nov: la primera ya venció pero sigue pendiente.
    scenario.clock.set('2026-11-17T15:00:00Z');
    expect(await inbox.list({ deadline: 'overdue' })).toEqual([
      expect.objectContaining({
        id: old.id,
        status: 'pending',
        deadlineStatus: 'overdue',
        businessDaysOverdue: 2,
      }),
    ]);
    expect(await inbox.summary()).toEqual({
      pending: 2,
      approved: 1,
      rejected: 0,
      dueSoon: 1,
      overdue: 1,
    });
  });

  it('el detalle trae el valor vigente, los docentes del módulo y las versiones personalizadas', async () => {
    const suggestion = await send(JULIAN);
    scenario.addVersion(scenario.guide, PAOLA.id);
    // Otro cambio llegó a la guía después del envío.
    scenario.guideRow().content = {
      ...scenario.guideRow().content,
      criterios: 'Criterios actualizados por otra sugerencia.',
    };

    const detail = await inbox.findForReview(suggestion.id);
    expect(detail).toMatchObject({
      code: suggestion.code,
      currentValue: 'Evidencia de producto: aplicación CRUD.',
      review: {
        currentGuideValue: 'Criterios actualizados por otra sugerencia.',
        moduleTeachers: 3,
        teacherVersions: 1,
      },
    });
  });

  it('NOT_FOUND si la sugerencia no existe', async () => {
    expect(await errorOf(inbox.findForReview(randomUUID()))).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
    expect(await errorOf(inbox.findForReview('SUG-001'))).toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
