import { AcademicGuideRecord } from '../academic/entities/academic-guide-record.entity.js';
import { ModuleTeacherAssignmentRecord } from '../academic/entities/module-teacher-assignment-record.entity.js';
import { SuggestionRecord } from './entities/suggestion-record.entity.js';
import {
  SuggestionSubmissionService,
  SUGGESTION_CODE_LOCK,
} from './suggestion-submission.service.js';
import {
  CARLOS,
  JULIAN,
  JUSTIFICATION,
  PAOLA,
  Scenario,
  createScenario,
  errorOf,
} from './suggestions.fixture-spec.js';

/** Fecha requerida válida: 14 días después del viernes 30 oct 2026. */
const NEEDED_BY = '2026-11-13';

describe('HE-05-HU-01 · Enviar sugerencia', () => {
  let scenario: Scenario;
  let service: SuggestionSubmissionService;

  const build = (s: Scenario) =>
    new SuggestionSubmissionService(
      s.store.repository(SuggestionRecord),
      s.store.repository(AcademicGuideRecord),
      s.store.repository(ModuleTeacherAssignmentRecord),
      s.store.dataSource,
      s.views,
      s.rules,
    );

  const send = (
    body: Record<string, unknown> = {},
    teacher = JULIAN,
    guideId = scenario.guide.id,
  ) =>
    service.create(
      guideId,
      {
        fieldKey: 'criterios',
        proposedValue:
          'Evidencia de producto: aplicación CRUD. Evidencia de desempeño: sustentación oral.',
        justification: JUSTIFICATION,
        neededBy: NEEDED_BY,
        ...body,
      },
      teacher,
    );

  beforeEach(() => {
    scenario = createScenario();
    service = build(scenario);
  });

  it('guarda la sugerencia pendiente con código, valor actual, versión base y plazos', async () => {
    const view = await send();
    expect(view).toMatchObject({
      code: 'SUG-001',
      status: 'pending',
      guideId: scenario.guide.id,
      moduleId: scenario.module.id,
      fieldKey: 'criterios',
      fieldLabel: 'Criterios de evaluación',
      teacherId: JULIAN.id,
      teacherName: 'Julián Andrés Ospina',
      currentValue: 'Evidencia de producto: aplicación CRUD.',
      baseVersion: 'v1.0',
      neededBy: NEEDED_BY,
      dueSoonAt: '2026-11-10T04:59:59.999Z',
      dueAt: '2026-11-13T04:59:59.999Z',
      deadlineStatus: 'on_time',
      businessDaysLeft: 8,
      guideCode: 'GB-POO-01',
      guideVersion: 'v1.0',
      moduleName: 'Programación Orientada a Objetos',
      competencyPrefix: 'POO',
      summary: 'Agrega «Evidencia de desempeño: sustentación oral.»',
    });
    // El consecutivo se asigna con el bloqueo de la transacción.
    expect(scenario.store.queries).toEqual([
      {
        sql: 'SELECT pg_advisory_xact_lock($1)',
        params: [SUGGESTION_CODE_LOCK],
      },
    ]);
  });

  it('numera las sugerencias en orden sin repetir el código', async () => {
    const first = await send();
    const second = await send({
      fieldKey: 'recursos',
      proposedValue: 'Documentación oficial de Java SE. Curso de UML.',
    });
    const third = await send({}, PAOLA);
    expect([first.code, second.code, third.code]).toEqual([
      'SUG-001',
      'SUG-002',
      'SUG-003',
    ]);
  });

  it('convierte a número los campos numéricos y rechaza texto en ellos', async () => {
    const view = await send({ fieldKey: 'semanas', proposedValue: '12' });
    expect(view.proposedValue).toBe(12);
    expect(
      await errorOf(
        send({ fieldKey: 'semanas', proposedValue: 'doce' }, PAOLA),
      ),
    ).toMatchObject({
      statusCode: 400,
      code: 'INVALID_NUMBER',
    });
  });

  describe('errores', () => {
    it('NOT_FOUND si la guía no existe o no está publicada', async () => {
      const draft = scenario.addGuide({
        code: 'GB-POO-02',
        status: 'draft',
        version: 'v0',
      });
      expect(await errorOf(send({}, JULIAN, draft.id))).toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
      expect(await errorOf(send({}, JULIAN, 'no-es-un-uuid'))).toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('GUIDE_NOT_ASSIGNED (403) si el módulo no está asignado al docente', async () => {
      const outsider = { ...CARLOS, id: 'teacher-sin-modulo' };
      expect(await errorOf(send({}, outsider))).toMatchObject({
        statusCode: 403,
        code: 'GUIDE_NOT_ASSIGNED',
      });
      // El docente autorizado también necesita la asignación (regla authorizedTeacherNeedsAssignment).
      const authorized = { ...PAOLA, id: 'autorizado-sin-modulo' };
      expect(await errorOf(send({}, authorized))).toMatchObject({
        code: 'GUIDE_NOT_ASSIGNED',
      });
    });

    it('FIELD_NOT_FOUND si el campo no está en la guía', async () => {
      expect(await errorOf(send({ fieldKey: 'inventado' }))).toMatchObject({
        statusCode: 400,
        code: 'FIELD_NOT_FOUND',
      });
    });

    it('NO_CHANGES si la propuesta es igual al valor actual (sin contar espacios)', async () => {
      expect(
        await errorOf(
          send({
            proposedValue: '  Evidencia de producto: aplicación CRUD.  ',
          }),
        ),
      ).toMatchObject({
        code: 'NO_CHANGES',
      });
    });

    it('PROPOSAL_REQUIRED si deja vacío un campo obligatorio', async () => {
      expect(await errorOf(send({ proposedValue: '   ' }))).toMatchObject({
        code: 'PROPOSAL_REQUIRED',
      });
    });

    it('permite vaciar un campo opcional', async () => {
      const view = await send({ fieldKey: 'recursos', proposedValue: '' });
      expect(view.proposedValue).toBeNull();
      expect(view.summary).toBe('Deja el campo vacío');
    });

    it('INVALID_OPTION si la lista no tiene esa opción', async () => {
      expect(
        await errorOf(
          send({ fieldKey: 'intensidad', proposedValue: '48 horas' }),
        ),
      ).toMatchObject({
        code: 'INVALID_OPTION',
      });
    });

    it('VALUE_TOO_LONG si supera maxLength', async () => {
      expect(
        await errorOf(send({ proposedValue: 'x'.repeat(121) })),
      ).toMatchObject({ code: 'VALUE_TOO_LONG' });
    });

    it('JUSTIFICATION_REQUIRED y JUSTIFICATION_TOO_SHORT', async () => {
      expect(await errorOf(send({ justification: '  ' }))).toMatchObject({
        code: 'JUSTIFICATION_REQUIRED',
      });
      expect(
        await errorOf(send({ justification: 'Muy corta.' })),
      ).toMatchObject({ code: 'JUSTIFICATION_TOO_SHORT' });
    });

    it('SUGGESTION_ALREADY_PENDING (409) con otra pendiente propia sobre el mismo campo', async () => {
      await send();
      expect(
        await errorOf(
          send({
            proposedValue: 'Otra redacción de los criterios de evaluación.',
          }),
        ),
      ).toMatchObject({
        statusCode: 409,
        code: 'SUGGESTION_ALREADY_PENDING',
      });
      // Otro docente sí puede sugerir sobre el mismo campo.
      await expect(send({}, PAOLA)).resolves.toMatchObject({ code: 'SUG-002' });
      expect(scenario.suggestions()).toHaveLength(2);
    });

    it('traduce la violación del índice único parcial a SUGGESTION_ALREADY_PENDING', async () => {
      const failing = createScenario();
      const duplicate = Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: 'UQ_academic_guide_suggestions_pending_field',
      });
      failing.store.manager.save = () => Promise.reject(duplicate);
      service = build(failing);
      scenario = failing;
      expect(await errorOf(send())).toMatchObject({
        statusCode: 409,
        code: 'SUGGESTION_ALREADY_PENDING',
      });
    });
  });

  describe('fecha requerida (neededBy) con 14 días de anticipación', () => {
    beforeEach(() => {
      // Sábado 24 oct 2026 en Bogotá: la fecha mínima es el 7 nov 2026.
      scenario = createScenario({ now: '2026-10-24T15:00:00Z' });
      service = build(scenario);
    });

    it('NEEDED_BY_REQUIRED si no la envía', async () => {
      expect(await errorOf(send({ neededBy: undefined }))).toMatchObject({
        code: 'NEEDED_BY_REQUIRED',
      });
    });

    it('NEEDED_BY_INVALID si no es una fecha AAAA-MM-DD', async () => {
      expect(await errorOf(send({ neededBy: '07/11/2026' }))).toMatchObject({
        code: 'NEEDED_BY_INVALID',
      });
    });

    it('13 días da NOTICE_TOO_SHORT con un mensaje claro; 14 días es válido', async () => {
      const error = await errorOf(send({ neededBy: '2026-11-06' }));
      expect(error).toMatchObject({
        statusCode: 400,
        code: 'NOTICE_TOO_SHORT',
      });
      expect(error.message).toContain('14 días de anticipación');
      expect(error.message).toContain('7 nov 2026');
      await expect(send({ neededBy: '2026-11-07' })).resolves.toMatchObject({
        neededBy: '2026-11-07',
      });
    });

    it('si la regla lo permite, la fecha requerida es opcional', async () => {
      scenario = createScenario({ rules: { neededByRequired: false } });
      service = build(scenario);
      await expect(send({ neededBy: undefined })).resolves.toMatchObject({
        neededBy: null,
      });
    });
  });

  describe('Mis sugerencias', () => {
    it('lista solo las propias, las más recientes primero', async () => {
      const first = await send();
      scenario.clock.set('2026-10-30T16:00:00Z');
      const second = await send({
        fieldKey: 'recursos',
        proposedValue: 'Documentación oficial de Java SE. Curso de UML.',
      });
      await send({}, PAOLA);
      expect((await service.findMine(JULIAN.id)).map((s) => s.code)).toEqual([
        second.code,
        first.code,
      ]);
    });

    it('el detalle de otra persona responde NOT_FOUND', async () => {
      const mine = await send();
      await expect(
        service.findMineOne(mine.id, JULIAN.id),
      ).resolves.toMatchObject({ code: 'SUG-001' });
      expect(
        await errorOf(service.findMineOne(mine.id, PAOLA.id)),
      ).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    });
  });
});
