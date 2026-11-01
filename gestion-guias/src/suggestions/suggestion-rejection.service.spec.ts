import { randomUUID } from 'node:crypto';
import { AcademicGuideRecord } from '../academic/entities/academic-guide-record.entity.js';
import { ModuleTeacherAssignmentRecord } from '../academic/entities/module-teacher-assignment-record.entity.js';
import { SuggestionRecord } from './entities/suggestion-record.entity.js';
import { SuggestionRejectionService } from './suggestion-rejection.service.js';
import { REJECT_REASONS } from './suggestion-rules.js';
import { SuggestionSubmissionService } from './suggestion-submission.service.js';
import {
  JULIAN,
  JUSTIFICATION,
  LAURA,
  Scenario,
  createScenario,
  errorOf,
} from './suggestions.fixture-spec.js';

const FEEDBACK =
  'Gracias por la propuesta. El plan de estudios fija la intensidad horaria del módulo.';

describe('HE-05-HU-04 · Rechazar con retroalimentación', () => {
  let scenario: Scenario;
  let submission: SuggestionSubmissionService;
  let rejection: SuggestionRejectionService;

  const send = () =>
    submission.create(
      scenario.guide.id,
      {
        fieldKey: 'intensidad',
        proposedValue: '60 horas · 15 semanas',
        justification: JUSTIFICATION,
        neededBy: '2026-12-01',
      },
      JULIAN,
    );

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
    rejection = new SuggestionRejectionService(
      store.dataSource,
      scenario.views,
      scenario.rules,
    );
  });

  it('marca la sugerencia como rechazada con motivo y retroalimentación, sin cambiar la guía', async () => {
    const suggestion = await send();
    const before = structuredClone(scenario.guideRow());
    scenario.clock.set('2026-11-02T20:00:00Z');

    const view = await rejection.reject(
      suggestion.id,
      { reason: REJECT_REASONS[0], feedback: `  ${FEEDBACK}  ` },
      LAURA,
    );

    expect(view).toMatchObject({
      status: 'rejected',
      rejectReason: 'No se ajusta a la intensidad horaria del módulo',
      feedback: FEEDBACK,
      decidedAt: '2026-11-02T20:00:00.000Z',
      decidedByName: 'Laura Muñoz',
      resultingVersion: null,
      deadlineStatus: null,
    });
    expect(scenario.guideRow()).toEqual(before);
    expect(scenario.events()).toEqual([]);
  });

  it('el docente queda notificado con el motivo', async () => {
    const suggestion = await send();
    await rejection.reject(
      suggestion.id,
      { reason: REJECT_REASONS[2], feedback: FEEDBACK },
      LAURA,
    );
    expect(scenario.notifications()).toEqual([
      expect.objectContaining({
        recipientId: JULIAN.id,
        type: 'SUGGESTION_REJECTED',
        title: 'Sugerencia SUG-001 rechazada',
        message:
          'Motivo: Requiere más sustento pedagógico. Revisa la retroalimentación en Mis sugerencias.',
        suggestionId: suggestion.id,
        readAt: null,
      }),
    ]);
  });

  it('usa la misma lista de motivos que el front', () => {
    expect(REJECT_REASONS).toEqual([
      'No se ajusta a la intensidad horaria del módulo',
      'No está alineada con la competencia',
      'Requiere más sustento pedagógico',
      'Duplica contenido existente en la guía',
      'Otro motivo',
    ]);
  });

  describe('errores', () => {
    it('REASON_REQUIRED sin motivo o con uno que no está en la lista', async () => {
      const suggestion = await send();
      expect(
        await errorOf(
          rejection.reject(suggestion.id, { feedback: FEEDBACK }, LAURA),
        ),
      ).toMatchObject({
        statusCode: 400,
        code: 'REASON_REQUIRED',
      });
      expect(
        await errorOf(
          rejection.reject(
            suggestion.id,
            { reason: 'Porque no', feedback: FEEDBACK },
            LAURA,
          ),
        ),
      ).toMatchObject({
        code: 'REASON_REQUIRED',
      });
    });

    it('FEEDBACK_TOO_SHORT con menos de 30 caracteres y FEEDBACK_TOO_LONG con más de 500', async () => {
      const suggestion = await send();
      expect(
        await errorOf(
          rejection.reject(
            suggestion.id,
            { reason: REJECT_REASONS[0], feedback: 'Muy corta.' },
            LAURA,
          ),
        ),
      ).toMatchObject({ code: 'FEEDBACK_TOO_SHORT' });
      expect(
        await errorOf(
          rejection.reject(
            suggestion.id,
            { reason: REJECT_REASONS[0], feedback: 'x'.repeat(501) },
            LAURA,
          ),
        ),
      ).toMatchObject({ code: 'FEEDBACK_TOO_LONG' });
      // Los límites exactos son válidos.
      await expect(
        rejection.reject(
          suggestion.id,
          { reason: REJECT_REASONS[0], feedback: 'x'.repeat(30) },
          LAURA,
        ),
      ).resolves.toMatchObject({ status: 'rejected' });
      expect(scenario.suggestions()[0].status).toBe('rejected');
    });

    it('SUGGESTION_ALREADY_DECIDED (409) si ya se decidió', async () => {
      const suggestion = await send();
      await rejection.reject(
        suggestion.id,
        { reason: REJECT_REASONS[0], feedback: FEEDBACK },
        LAURA,
      );
      expect(
        await errorOf(
          rejection.reject(
            suggestion.id,
            { reason: REJECT_REASONS[1], feedback: FEEDBACK },
            LAURA,
          ),
        ),
      ).toMatchObject({ statusCode: 409, code: 'SUGGESTION_ALREADY_DECIDED' });
      expect(scenario.notifications()).toHaveLength(1);
    });

    it('NOT_FOUND si la sugerencia no existe', async () => {
      expect(
        await errorOf(
          rejection.reject(
            randomUUID(),
            { reason: REJECT_REASONS[0], feedback: FEEDBACK },
            LAURA,
          ),
        ),
      ).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    });
  });
});
