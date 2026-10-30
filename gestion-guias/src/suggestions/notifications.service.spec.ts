import { randomUUID } from 'node:crypto';
import { AcademicService } from '../academic/academic.service.js';
import { AcademicGuideRecord } from '../academic/entities/academic-guide-record.entity.js';
import { ModuleTeacherAssignmentRecord } from '../academic/entities/module-teacher-assignment-record.entity.js';
import { SuggestionRecord } from './entities/suggestion-record.entity.js';
import { UserNotificationRecord } from './entities/user-notification-record.entity.js';
import { NotificationsService } from './notifications.service.js';
import { SuggestionApprovalService } from './suggestion-approval.service.js';
import { SuggestionRejectionService } from './suggestion-rejection.service.js';
import { REJECT_REASONS } from './suggestion-rules.js';
import { SuggestionSubmissionService } from './suggestion-submission.service.js';
import {
  CARLOS,
  DIANA,
  JULIAN,
  JUSTIFICATION,
  LAURA,
  PAOLA,
  Scenario,
  createScenario,
  errorOf,
} from './suggestions.fixture-spec.js';

describe('Campana de notificaciones (HE-05)', () => {
  let scenario: Scenario;
  let submission: SuggestionSubmissionService;
  let approval: SuggestionApprovalService;
  let rejection: SuggestionRejectionService;
  let notifications: NotificationsService;

  const send = (teacher = JULIAN, fieldKey = 'criterios') =>
    submission.create(
      scenario.guide.id,
      {
        fieldKey,
        proposedValue:
          fieldKey === 'intensidad'
            ? '60 horas · 15 semanas'
            : `Texto nuevo de ${teacher.name}.`,
        justification: JUSTIFICATION,
        neededBy: '2026-12-15',
      },
      teacher,
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
    const academic = {
      findGuide: async (id: string) => scenario.guideRow(id),
    } as unknown as AcademicService;
    approval = new SuggestionApprovalService(
      store.dataSource,
      scenario.views,
      academic,
      scenario.rules,
    );
    rejection = new SuggestionRejectionService(
      store.dataSource,
      scenario.views,
      scenario.rules,
    );
    notifications = new NotificationsService(
      store.repository(UserNotificationRecord),
      store.repository(SuggestionRecord),
      store.repository(AcademicGuideRecord),
      scenario.views,
      scenario.rules,
    );
  });

  describe('coordinador: alertas calculadas de las pendientes', () => {
    it('ordena vencidas, luego por vencer, luego nuevas, con los datos de la guía', async () => {
      const overdue = await send(JULIAN); // viernes 30 oct: vence el 12 nov
      scenario.clock.set('2026-11-10T15:00:00Z');
      const dueSoon = await send(PAOLA); // martes 10 nov: por vencer desde el 19 nov, vence el 23 nov
      scenario.clock.set('2026-11-19T15:00:00Z');
      const fresh = await send(CARLOS); // nueva, recibida hoy
      scenario.clock.set('2026-11-19T20:00:00Z');

      const bell = await notifications.listFor(LAURA);
      expect(bell.unread).toBe(3);
      expect(bell.items.map((item) => item.suggestionId)).toEqual([
        overdue.id,
        dueSoon.id,
        fresh.id,
      ]);
      expect(bell.items[0]).toMatchObject({
        type: 'SUGGESTION_OVERDUE',
        severity: 'danger',
        read: false,
        title: 'SUG-001 · Julián Ospina · GB-POO-01',
        // Venció el 12 nov; hábiles desde entonces: 13, 17, 18 y 19 (el 16 es festivo).
        message: 'venció hace 4 días hábiles (sigue pendiente)',
        guide: {
          id: scenario.guide.id,
          code: 'GB-POO-01',
          title: 'Guía base · Programación Orientada a Objetos',
          version: 'v1.0',
          moduleName: 'Programación Orientada a Objetos',
        },
      });
      expect(bell.items[1]).toMatchObject({
        type: 'SUGGESTION_DUE_SOON',
        severity: 'warning',
        title: 'SUG-002 · Paola Valencia · GB-POO-01',
        message: 'vence en 2 días hábiles',
      });
      expect(bell.items[2]).toMatchObject({
        type: 'SUGGESTION_PENDING',
        severity: 'info',
        message: 'nueva, recibida hoy',
      });
    });

    it('usa el singular y "recibida ayer"', async () => {
      await send(JULIAN); // vence el jueves 12 nov
      scenario.clock.set('2026-11-11T15:00:00Z');
      expect((await notifications.listFor(LAURA)).items[0].message).toBe(
        'vence en 1 día hábil',
      );
      scenario.clock.set('2026-11-13T15:00:00Z');
      expect((await notifications.listFor(LAURA)).items[0].message).toBe(
        'venció hace 1 día hábil (sigue pendiente)',
      );

      scenario.clock.set('2026-11-14T15:00:00Z');
      await send(PAOLA);
      scenario.clock.set('2026-11-15T15:00:00Z');
      const items = (await notifications.listFor(LAURA)).items;
      expect(items.find((item) => item.title.includes('Paola'))?.message).toBe(
        'nueva, recibida ayer',
      );
    });

    it('desaparecen cuando se deciden', async () => {
      const a = await send(JULIAN);
      await send(PAOLA, 'intensidad');
      await approval.approve(a.id, LAURA);
      const bell = await notifications.listFor(LAURA);
      expect(bell.unread).toBe(1);
      expect(bell.items).toHaveLength(1);
    });
  });

  describe('docente: notificaciones guardadas', () => {
    it('cada tipo llega a su destinatario', async () => {
      const approved = await send(JULIAN);
      const rejected = await send(PAOLA, 'intensidad');
      await approval.approve(approved.id, LAURA);
      scenario.clock.set('2026-10-30T18:00:00Z');
      await rejection.reject(
        rejected.id,
        {
          reason: REJECT_REASONS[0],
          feedback: 'El plan de estudios fija 40 horas para el módulo.',
        },
        LAURA,
      );

      const julian = await notifications.listFor(JULIAN);
      expect(julian.unread).toBe(1);
      expect(julian.items).toEqual([
        expect.objectContaining({
          type: 'SUGGESTION_APPROVED',
          severity: 'success',
          read: false,
          suggestionId: approved.id,
        }),
      ]);
      expect(julian.items[0].guide).toMatchObject({
        code: 'GB-POO-01',
        version: 'v1.1',
      });

      const paola = await notifications.listFor(PAOLA);
      // Las más recientes primero.
      expect(paola.items.map((item) => item.type)).toEqual([
        'SUGGESTION_REJECTED',
        'GUIDE_NEW_VERSION',
      ]);
      expect(paola.items[0]).toMatchObject({
        severity: 'danger',
        message: expect.stringContaining(REJECT_REASONS[0]),
      });

      const carlos = await notifications.listFor(CARLOS);
      expect(carlos.items).toEqual([
        expect.objectContaining({
          type: 'GUIDE_NEW_VERSION',
          title: 'Nueva versión v1.1 de GB-POO-01 disponible',
        }),
      ]);
    });

    it('marca como leída una o todas, solo las propias', async () => {
      const a = await send(JULIAN);
      await approval.approve(a.id, LAURA);
      const b = await send(JULIAN, 'recursos');
      await approval.approve(b.id, LAURA);

      const [first] = (await notifications.listFor(JULIAN)).items;
      expect(
        await errorOf(notifications.markRead(first.id, PAOLA.id)),
      ).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
      await expect(
        notifications.markRead(first.id, JULIAN.id),
      ).resolves.toMatchObject({ id: first.id, read: true });
      expect((await notifications.listFor(JULIAN)).unread).toBe(1);

      await expect(notifications.markAllRead(JULIAN.id)).resolves.toEqual({
        updated: 1,
      });
      expect((await notifications.listFor(JULIAN)).unread).toBe(0);
      // Las de Paola siguen sin leer.
      expect((await notifications.listFor(PAOLA)).unread).toBe(2);
      expect(
        await errorOf(notifications.markRead(randomUUID(), JULIAN.id)),
      ).toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  it('administrador: lista vacía por ahora', async () => {
    await send(JULIAN);
    await expect(notifications.listFor(DIANA)).resolves.toEqual({
      unread: 0,
      items: [],
    });
  });
});
