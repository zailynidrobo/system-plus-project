import { randomUUID } from 'node:crypto';
import { AcademicService } from '../academic/academic.service.js';
import { AcademicGuideRecord } from '../academic/entities/academic-guide-record.entity.js';
import { ModuleTeacherAssignmentRecord } from '../academic/entities/module-teacher-assignment-record.entity.js';
import { SuggestionRecord } from './entities/suggestion-record.entity.js';
import { SuggestionApprovalService } from './suggestion-approval.service.js';
import { SuggestionRules } from './suggestion-rules.js';
import { SuggestionSubmissionService } from './suggestion-submission.service.js';
import {
  CARLOS,
  JULIAN,
  JUSTIFICATION,
  LAURA,
  PAOLA,
  Scenario,
  createScenario,
  errorOf,
} from './suggestions.fixture-spec.js';

const NEW_CRITERIA =
  'Evidencia de producto: aplicación CRUD. Evidencia de desempeño: sustentación oral de 10 minutos.';

describe('HE-05-HU-03 · Aprobar sugerencia', () => {
  let scenario: Scenario;
  let submission: SuggestionSubmissionService;
  let approval: SuggestionApprovalService;

  const setUp = (rules: Partial<SuggestionRules> = {}) => {
    scenario = createScenario({ rules });
    const { store } = scenario;
    submission = new SuggestionSubmissionService(
      store.repository(SuggestionRecord),
      store.repository(AcademicGuideRecord),
      store.repository(ModuleTeacherAssignmentRecord),
      store.dataSource,
      scenario.views,
      scenario.rules,
    );
    // AcademicService solo se usa para devolver la guía actualizada.
    const academic = {
      findGuide: async (id: string) => structuredClone(scenario.guideRow(id)),
    } as unknown as AcademicService;
    approval = new SuggestionApprovalService(
      store.dataSource,
      scenario.views,
      academic,
      scenario.rules,
    );
  };

  const send = (
    teacher = JULIAN,
    proposedValue: unknown = NEW_CRITERIA,
    fieldKey = 'criterios',
  ) =>
    submission.create(
      scenario.guide.id,
      {
        fieldKey,
        proposedValue,
        justification: JUSTIFICATION,
        neededBy: '2026-12-01',
      },
      teacher,
    );

  beforeEach(() => setUp());

  it('reemplaza el campo, sube la versión menor y actualiza la auditoría de la guía', async () => {
    const suggestion = await send();
    scenario.clock.set('2026-11-03T16:00:00Z');
    const result = await approval.approve(suggestion.id, LAURA);

    const guide = scenario.guideRow();
    expect(guide.content.criterios).toBe(NEW_CRITERIA);
    expect(guide.content.recursos).toBe('Documentación oficial de Java SE.');
    expect(guide.version).toBe('v1.1');
    expect(guide.updatedAt.toISOString()).toBe('2026-11-03T16:00:00.000Z');
    expect(guide).toMatchObject({
      updatedById: LAURA.id,
      updatedByName: 'Laura Muñoz',
      status: 'published',
    });

    expect(result.suggestion).toMatchObject({
      status: 'approved',
      decidedAt: '2026-11-03T16:00:00.000Z',
      decidedById: LAURA.id,
      decidedByName: 'Laura Muñoz',
      resultingVersion: 'v1.1',
      guideVersion: 'v1.1',
      deadlineStatus: null,
    });
    expect(result.guide).toMatchObject({
      id: scenario.guide.id,
      version: 'v1.1',
    });
    expect(scenario.events()).toEqual([
      expect.objectContaining({
        guideId: scenario.guide.id,
        title: 'Sugerencia SUG-001 aprobada · Criterios de evaluación (v1.1)',
        authorName: 'Laura Muñoz',
      }),
    ]);
  });

  it('sigue la secuencia de versiones menores (v2.1 -> v2.2)', async () => {
    scenario.guideRow().version = 'v2.1';
    const suggestion = await send();
    await approval.approve(suggestion.id, LAURA);
    expect(scenario.guideRow().version).toBe('v2.2');
  });

  it('no toca las versiones personalizadas de los docentes', async () => {
    scenario.addVersion(scenario.guide, JULIAN.id);
    scenario.addVersion(scenario.guide, PAOLA.id);
    const before = structuredClone(scenario.versions());
    const suggestion = await send();
    await approval.approve(suggestion.id, LAURA);
    expect(scenario.versions()).toEqual(before);
  });

  it('una sugerencia vencida sigue pendiente y se puede aprobar', async () => {
    const suggestion = await send();
    scenario.clock.set('2026-11-20T15:00:00Z');
    const [late] = await scenario.views.toViews(scenario.suggestions());
    expect(late).toMatchObject({
      status: 'pending',
      deadlineStatus: 'overdue',
    });
    await expect(approval.approve(suggestion.id, LAURA)).resolves.toMatchObject(
      {
        suggestion: { status: 'approved', resultingVersion: 'v1.1' },
      },
    );
  });

  it('notifica al autor y a los demás docentes asignados al módulo', async () => {
    const suggestion = await send();
    const result = await approval.approve(suggestion.id, LAURA);
    expect(result.notifications).toEqual({ author: 1, newVersion: 2 });

    const byRecipient = Object.fromEntries(
      scenario.notifications().map((n) => [n.recipientId, n]),
    );
    expect(byRecipient[JULIAN.id]).toMatchObject({
      type: 'SUGGESTION_APPROVED',
      title: 'Sugerencia SUG-001 aprobada',
      message:
        'Tu cambio en «Criterios de evaluación» quedó en GB-POO-01 v1.1.',
      suggestionId: suggestion.id,
      guideId: scenario.guide.id,
      readAt: null,
    });
    for (const teacher of [PAOLA, CARLOS]) {
      expect(byRecipient[teacher.id]).toMatchObject({
        type: 'GUIDE_NEW_VERSION',
        title: 'Nueva versión v1.1 de GB-POO-01 disponible',
      });
    }
    expect(scenario.notifications()).toHaveLength(3);
  });

  it('con la regla "teachers-with-version", el aviso de nueva versión llega solo a quien tiene versión', async () => {
    setUp({ newVersionRecipients: 'teachers-with-version' });
    scenario.addVersion(scenario.guide, CARLOS.id);
    const suggestion = await send();
    await approval.approve(suggestion.id, LAURA);
    expect(
      scenario
        .notifications()
        .filter((n) => n.type === 'GUIDE_NEW_VERSION')
        .map((n) => n.recipientId),
    ).toEqual([CARLOS.id]);
  });

  describe('errores', () => {
    it('NOT_FOUND si la sugerencia no existe', async () => {
      expect(
        await errorOf(approval.approve(randomUUID(), LAURA)),
      ).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    });

    it('SUGGESTION_ALREADY_DECIDED (409) si ya se decidió', async () => {
      const suggestion = await send();
      await approval.approve(suggestion.id, LAURA);
      expect(
        await errorOf(approval.approve(suggestion.id, LAURA)),
      ).toMatchObject({
        statusCode: 409,
        code: 'SUGGESTION_ALREADY_DECIDED',
      });
      expect(scenario.guideRow().version).toBe('v1.1');
    });

    it('GUIDE_NOT_PUBLISHED (409) si la guía dejó de estar publicada', async () => {
      const suggestion = await send();
      scenario.guideRow().status = 'draft';
      expect(
        await errorOf(approval.approve(suggestion.id, LAURA)),
      ).toMatchObject({
        statusCode: 409,
        code: 'GUIDE_NOT_PUBLISHED',
      });
    });

    it('GUIDE_CHANGED (409) cuando dos docentes sugieren sobre el mismo campo y se aprueba la primera', async () => {
      const first = await send(JULIAN);
      const second = await send(
        PAOLA,
        'Otra propuesta de Paola para los criterios de evaluación.',
      );
      await approval.approve(first.id, LAURA);

      expect(await errorOf(approval.approve(second.id, LAURA))).toMatchObject({
        statusCode: 409,
        code: 'GUIDE_CHANGED',
      });
      // Nada cambió con el intento fallido: la transacción se deshace.
      expect(scenario.guideRow()).toMatchObject({
        version: 'v1.1',
        content: expect.objectContaining({ criterios: NEW_CRITERIA }),
      });
      expect(
        scenario.suggestions().find((s) => s.id === second.id)?.status,
      ).toBe('pending');
      expect(scenario.events()).toHaveLength(1);
    });
  });
});
