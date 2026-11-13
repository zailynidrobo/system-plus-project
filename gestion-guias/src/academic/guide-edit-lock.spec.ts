import { ConflictException } from '@nestjs/common';
import { AcademicService } from './academic.service.js';
import { AcademicGuideRecord } from './entities/academic-guide-record.entity.js';
import { GuideEditLockRecord } from './entities/guide-edit-lock-record.entity.js';
import { ModuleTeacherAssignmentRecord } from './entities/module-teacher-assignment-record.entity.js';
import { assertNoActiveEditLock } from './guide-edit-lock.js';
import { SuggestionRecord } from '../suggestions/entities/suggestion-record.entity.js';
import { SuggestionApprovalService } from '../suggestions/suggestion-approval.service.js';
import { SuggestionSubmissionService } from '../suggestions/suggestion-submission.service.js';
import { JULIAN, JUSTIFICATION, LAURA, createScenario, errorOf } from '../suggestions/suggestions.fixture-spec.js';

const HOUR = 3_600_000;
const lock = (startsInHours: number, endsInHours: number): GuideEditLockRecord => ({
  id: 'lock-1',
  name: 'Cierre de semestre',
  reason: 'Revisión institucional de guías.',
  startsAt: new Date(Date.now() + startsInHours * HOUR),
  endsAt: new Date(Date.now() + endsInHours * HOUR),
  createdById: 'admin-1',
  createdByName: 'Andrea Salazar',
  createdAt: new Date(),
});
const repo = (rows: GuideEditLockRecord[]) => ({ find: async () => rows });

describe('HE-09-HU-02 · Periodos de edición inhabilitada', () => {
  it('sin periodo vigente deja editar', async () => {
    await expect(assertNoActiveEditLock(repo([lock(2, 5), lock(-5, -2)]))).resolves.toBeUndefined();
  });

  it('con un periodo vigente responde 409 con su nombre, motivo y fin', async () => {
    const error = await assertNoActiveEditLock(repo([lock(-1, 1)])).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    const body = (error as ConflictException).getResponse() as { code: string; lock: { name: string; reason: string } };
    expect(body.code).toBe('GUIDE_EDITING_LOCKED');
    expect(body.lock).toMatchObject({ name: 'Cierre de semestre', reason: 'Revisión institucional de guías.' });
  });

  it('el fin del periodo ya no bloquea', async () => {
    const now = new Date();
    await expect(
      assertNoActiveEditLock(repo([{ ...lock(-2, 0), endsAt: now }]), now),
    ).resolves.toBeUndefined();
  });

  describe('sugerencias durante el bloqueo', () => {
    const setUp = () => {
      const scenario = createScenario();
      const { store } = scenario;
      const submission = new SuggestionSubmissionService(
        store.repository(SuggestionRecord),
        store.repository(AcademicGuideRecord),
        store.repository(ModuleTeacherAssignmentRecord),
        store.dataSource,
        scenario.views,
        scenario.rules,
      );
      const approval = new SuggestionApprovalService(
        store.dataSource,
        scenario.views,
        { findGuide: async (id: string) => structuredClone(scenario.guideRow(id)) } as unknown as AcademicService,
        scenario.rules,
      );
      const send = () =>
        submission.create(
          scenario.guide.id,
          { fieldKey: 'criterios', proposedValue: 'Evidencia de producto: aplicación CRUD. Evidencia de desempeño: sustentación oral de 10 minutos.', justification: JUSTIFICATION, neededBy: '2026-12-01' },
          JULIAN,
        );
      return { store, send, approval };
    };

    it('el docente no puede enviar una sugerencia', async () => {
      const { store, send } = setUp();
      store.rows<GuideEditLockRecord>(GuideEditLockRecord).push(lock(-1, 1));
      expect(await errorOf(send())).toMatchObject({ code: 'GUIDE_EDITING_LOCKED' });
    });

    it('el coordinador no puede aprobar una sugerencia', async () => {
      const { store, send, approval } = setUp();
      const sent = await send();
      store.rows<GuideEditLockRecord>(GuideEditLockRecord).push(lock(-1, 1));
      expect(await errorOf(approval.approve(sent.id, LAURA))).toMatchObject({ code: 'GUIDE_EDITING_LOCKED' });
    });
  });
});
