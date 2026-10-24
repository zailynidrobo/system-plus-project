import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AcademicModule } from '../src/academic/academic.module.js';
import { AcademicProgramModule } from '../src/academic-program/academic-program.module.js';
import { ProgramsService } from '../src/academic-program/services/programs.service.js';
import { KeycloakRolesGuard } from '../src/auth/keycloak-roles.guard.js';
import { DatabaseModule } from '../src/database/database.module.js';
import { CLOCK, Clock } from '../src/suggestions/clock.js';
import { SuggestionsModule } from '../src/suggestions/suggestions.module.js';

/** Personas de la prueba: `x-test-role`, `x-test-user` y `x-test-name` (codificado, por las tildes) simulan el token. */
const COORDINATOR = {
  role: 'coordinador',
  user: 'coord-laura',
  name: 'Laura Muñoz',
};
const JULIAN = {
  role: 'docente',
  user: 'teacher-julian',
  name: 'Julián Andrés Ospina',
};
const PAOLA = {
  role: 'docente_autorizado',
  user: 'teacher-paola',
  name: 'Paola Valencia',
};

const JUSTIFICATION =
  'La sustentación permite evaluar la comprensión real del estudiante.';
const FEEDBACK =
  'Gracias por la propuesta. Por ahora la bibliografía institucional es suficiente.';

describe('HE-05 Sugerencias (e2e)', () => {
  let app: INestApplication<App>;
  // Viernes 30 oct 2026, 10:00 a. m. en Bogotá: vence el 12 nov y la fecha mínima es el 13 nov.
  let now = new Date('2026-10-30T15:00:00Z');
  const clock: Clock = { now: () => new Date(now) };

  const as = (person: { role: string; user: string; name: string }) => {
    const server = app.getHttpServer();
    const withPerson = (test: request.Test) =>
      test
        .set('x-test-role', person.role)
        .set('x-test-user', person.user)
        .set('x-test-name', encodeURIComponent(person.name));
    return {
      get: (url: string) => withPerson(request(server).get(url)),
      post: (url: string) => withPerson(request(server).post(url)),
      put: (url: string) => withPerson(request(server).put(url)),
      patch: (url: string) => withPerson(request(server).patch(url)),
    };
  };

  beforeEach(async () => {
    now = new Date('2026-10-30T15:00:00Z');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.test', '.env'],
        }),
        DatabaseModule,
        AcademicModule,
        AcademicProgramModule,
        SuggestionsModule,
      ],
      // El guard de roles de la API real: un docente en una ruta de coordinador recibe 403.
      providers: [{ provide: APP_GUARD, useClass: KeycloakRolesGuard }],
    })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    if (!app.get(ConfigService).get<string>('DB_NAME', '').endsWith('_test')) {
      throw new Error(
        'Las pruebas e2e reinician la base de datos: DB_NAME debe terminar en _test',
      );
    }
    app.use(
      (
        req: { header: (name: string) => string | undefined },
        _res: unknown,
        next: () => void,
      ) => {
        Object.assign(req, {
          user: {
            sub: req.header('x-test-user') ?? COORDINATOR.user,
            name: decodeURIComponent(
              req.header('x-test-name') ?? COORDINATOR.name,
            ),
            realm_access: {
              roles: [req.header('x-test-role') ?? COORDINATOR.role],
            },
          },
        });
        next();
      },
    );
    await app.init();
    await app.get(DataSource).synchronize(true);
  });

  afterEach(async () => {
    await app.close();
  });

  /** Módulo POO del plan por defecto, con una guía publicada en v1.0 y Julián y Paola asignados. */
  async function publishedGuide() {
    const coordinator = as(COORDINATOR);
    // `synchronize(true)` vació las tablas: se vuelven a sembrar el programa y sus seis módulos.
    const programs = app.get(ProgramsService);
    await programs.onApplicationBootstrap();
    const programId = (await programs.ensureDefaultProgram()).id;
    const modules = (
      await coordinator.get(`/programs/${programId}/modules`).expect(200)
    ).body as {
      id: string;
      name: string;
    }[];
    const moduleId = modules.find(
      (module) => module.name === 'Programación Orientada a Objetos',
    )!.id;
    const competencyId = (
      (await coordinator.get(`/modules/${moduleId}/competencies`).expect(200))
        .body as { id: string }[]
    )[0].id;
    await coordinator
      .put(`/academic/modules/${moduleId}/guide-fields`)
      .send({
        fields: [
          {
            key: 'criterios',
            label: 'Criterios de evaluación',
            type: 'textarea',
            required: true,
            maxLength: 500,
          },
          {
            key: 'recursos',
            label: 'Recursos y bibliografía',
            type: 'textarea',
            required: false,
          },
        ],
      })
      .expect(200);
    const guideId = (
      await coordinator
        .post('/academic/guides')
        .send({
          moduleId,
          competencyId,
          content: {
            criterios: 'Evidencia de producto: aplicación CRUD.',
            recursos: 'Documentación de Java SE.',
          },
        })
        .expect(201)
    ).body.id as string;
    await coordinator.patch(`/academic/guides/${guideId}/publish`).expect(200);
    for (const teacher of [JULIAN, PAOLA]) {
      await coordinator
        .put(`/academic/modules/${moduleId}/teachers/${teacher.user}`)
        .expect(200);
    }
    return { moduleId, guideId };
  }

  it('el docente envía, el coordinador la ve en la bandeja y en la campana, y la aprueba', async () => {
    const { guideId, moduleId } = await publishedGuide();
    const julian = as(JULIAN);
    const coordinator = as(COORDINATOR);

    // Con menos de 14 días de anticipación no se acepta.
    await julian
      .post(`/academic/guides/${guideId}/suggestions`)
      .send({
        fieldKey: 'criterios',
        proposedValue: 'Sustentación oral.',
        justification: JUSTIFICATION,
        neededBy: '2026-11-12',
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          statusCode: 400,
          error: 'Bad Request',
          code: 'NOTICE_TOO_SHORT',
        });
        expect(body.message).toContain('13 nov 2026');
      });

    const created = await julian
      .post(`/academic/guides/${guideId}/suggestions`)
      .send({
        fieldKey: 'criterios',
        proposedValue:
          'Evidencia de producto: aplicación CRUD. Evidencia de desempeño: sustentación oral.',
        justification: JUSTIFICATION,
        neededBy: '2026-11-13',
      })
      .expect(201);
    const suggestionId = created.body.id as string;
    expect(created.body).toMatchObject({
      code: 'SUG-001',
      status: 'pending',
      teacherName: 'Julián Andrés Ospina',
      currentValue: 'Evidencia de producto: aplicación CRUD.',
      baseVersion: 'v1.0',
      neededBy: '2026-11-13',
      dueSoonAt: '2026-11-10T04:59:59.999Z',
      dueAt: '2026-11-13T04:59:59.999Z',
      deadlineStatus: 'on_time',
      guideCode: 'GB-POO-01',
      competencyPrefix: 'POO',
      summary: 'Agrega «Evidencia de desempeño: sustentación oral.»',
    });

    await julian
      .post(`/academic/guides/${guideId}/suggestions`)
      .send({
        fieldKey: 'criterios',
        proposedValue: 'Otra redacción.',
        justification: JUSTIFICATION,
        neededBy: '2026-11-20',
      })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('SUGGESTION_ALREADY_PENDING'),
      );

    // Paola sugiere sobre el mismo campo: al aprobar la de Julián, la suya queda desactualizada.
    const paolaSuggestion = await as(PAOLA)
      .post(`/academic/guides/${guideId}/suggestions`)
      .send({
        fieldKey: 'criterios',
        proposedValue: 'Rúbrica con tres niveles.',
        justification: JUSTIFICATION,
        neededBy: '2026-11-30',
      })
      .expect(201);

    await julian
      .get('/academic/suggestions/mine')
      .expect(200)
      .expect(({ body }) =>
        expect(body.map((s: { code: string }) => s.code)).toEqual(['SUG-001']),
      );

    await coordinator
      .get(
        `/academic/suggestions?status=pending&moduleId=${moduleId}&order=asc`,
      )
      .expect(200)
      .expect(({ body }) =>
        expect(body.map((s: { code: string }) => s.code)).toEqual([
          'SUG-001',
          'SUG-002',
        ]),
      );
    await coordinator
      .get('/academic/suggestions/summary')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual({
          pending: 2,
          approved: 0,
          rejected: 0,
          dueSoon: 0,
          overdue: 0,
        }),
      );
    await coordinator
      .get('/academic/suggestions/guides')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual([
          expect.objectContaining({ id: guideId, code: 'GB-POO-01' }),
        ]),
      );
    await coordinator
      .get('/academic/notifications')
      .expect(200)
      .expect(({ body }) => {
        expect(body.unread).toBe(2);
        expect(body.items[0]).toMatchObject({
          type: 'SUGGESTION_PENDING',
          title: 'SUG-001 · Julián Ospina · GB-POO-01',
          message: 'nueva, recibida hoy',
          suggestionId,
          guide: { id: guideId, code: 'GB-POO-01', version: 'v1.0' },
        });
      });
    await coordinator
      .get(`/academic/suggestions/${suggestionId}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body.review).toEqual({
          currentGuideValue: 'Evidencia de producto: aplicación CRUD.',
          moduleTeachers: 2,
          teacherVersions: 0,
        }),
      );

    // Pasa el plazo (las dos se enviaron el 30 oct): siguen pendientes y se pueden decidir igual.
    now = new Date('2026-11-17T15:00:00Z');
    await coordinator
      .get('/academic/suggestions?deadline=overdue')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual(
          ['SUG-001', 'SUG-002'].map((code) =>
            expect.objectContaining({
              code,
              status: 'pending',
              deadlineStatus: 'overdue',
              businessDaysOverdue: 2,
            }),
          ),
        ),
      );

    await coordinator
      .patch(`/academic/suggestions/${suggestionId}/approve`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.suggestion).toMatchObject({
          status: 'approved',
          resultingVersion: 'v1.1',
          decidedByName: 'Laura Muñoz',
        });
        expect(body.guide).toMatchObject({ id: guideId, version: 'v1.1' });
        expect(body.notifications).toEqual({ author: 1, newVersion: 1 });
      });
    await coordinator
      .get(`/academic/guides/${guideId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.version).toBe('v1.1');
        expect(body.content.criterios).toContain('sustentación oral');
      });
    await coordinator
      .get(`/academic/guides/${guideId}/events`)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              title:
                'Sugerencia SUG-001 aprobada · Criterios de evaluación (v1.1)',
            }),
          ]),
        ),
      );
    await coordinator
      .patch(`/academic/suggestions/${suggestionId}/approve`)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('SUGGESTION_ALREADY_DECIDED'),
      );
    await coordinator
      .patch(`/academic/suggestions/${paolaSuggestion.body.id}/approve`)
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('GUIDE_CHANGED'));

    // El autor recibe "aprobada" y Paola "nueva versión".
    const julianBell = await julian.get('/academic/notifications').expect(200);
    expect(julianBell.body.unread).toBe(1);
    expect(julianBell.body.items[0]).toMatchObject({
      type: 'SUGGESTION_APPROVED',
      read: false,
      guide: { id: guideId, version: 'v1.1' },
    });
    await as(PAOLA)
      .get('/academic/notifications')
      .expect(200)
      .expect(({ body }) =>
        expect(body.items).toEqual([
          expect.objectContaining({
            type: 'GUIDE_NEW_VERSION',
            title: 'Nueva versión v1.1 de GB-POO-01 disponible',
          }),
        ]),
      );
    await julian
      .patch(`/academic/notifications/${julianBell.body.items[0].id}/read`)
      .expect(200)
      .expect(({ body }) => expect(body.read).toBe(true));
    await as(PAOLA)
      .patch(`/academic/notifications/${julianBell.body.items[0].id}/read`)
      .expect(404);
    await julian
      .get('/academic/notifications')
      .expect(200)
      .expect(({ body }) => expect(body.unread).toBe(0));
  });

  it('el coordinador rechaza otra sugerencia y el docente ve el motivo y la retroalimentación', async () => {
    const { guideId } = await publishedGuide();
    const julian = as(JULIAN);
    const coordinator = as(COORDINATOR);
    const created = await julian
      .post(`/academic/guides/${guideId}/suggestions`)
      .send({
        fieldKey: 'recursos',
        proposedValue: 'Documentación de Java SE. Curso en línea de UML.',
        justification: JUSTIFICATION,
        neededBy: '2026-11-20',
      })
      .expect(201);
    const id = created.body.id as string;

    await coordinator
      .patch(`/academic/suggestions/${id}/reject`)
      .send({
        reason: 'Requiere más sustento pedagógico',
        feedback: 'Muy corta.',
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('FEEDBACK_TOO_SHORT'));
    await coordinator
      .patch(`/academic/suggestions/${id}/reject`)
      .send({ reason: 'Requiere más sustento pedagógico', feedback: FEEDBACK })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ status: 'rejected', feedback: FEEDBACK }),
      );

    await julian
      .get(`/academic/suggestions/mine/${id}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          status: 'rejected',
          rejectReason: 'Requiere más sustento pedagógico',
          feedback: FEEDBACK,
        }),
      );
    await julian
      .get('/academic/notifications')
      .expect(200)
      .expect(({ body }) =>
        expect(body.items[0]).toMatchObject({
          type: 'SUGGESTION_REJECTED',
          message: expect.stringContaining('Requiere más sustento pedagógico'),
        }),
      );
    // La guía no cambió.
    await coordinator
      .get(`/academic/guides/${guideId}`)
      .expect(200)
      .expect(({ body }) => expect(body.version).toBe('v1.0'));
    // Paola no puede ver la sugerencia de Julián.
    await as(PAOLA).get(`/academic/suggestions/mine/${id}`).expect(404);
  });

  it('un docente que llama rutas de coordinador recibe 403', async () => {
    const { guideId } = await publishedGuide();
    const julian = as(JULIAN);
    const created = await julian
      .post(`/academic/guides/${guideId}/suggestions`)
      .send({
        fieldKey: 'recursos',
        proposedValue: 'Otra bibliografía.',
        justification: JUSTIFICATION,
        neededBy: '2026-11-20',
      })
      .expect(201);

    await julian.get('/academic/suggestions').expect(403);
    await julian.get('/academic/suggestions/summary').expect(403);
    await julian.get(`/academic/suggestions/${created.body.id}`).expect(403);
    await julian
      .patch(`/academic/suggestions/${created.body.id}/approve`)
      .expect(403);
    await julian
      .patch(`/academic/suggestions/${created.body.id}/reject`)
      .send({ reason: 'Otro motivo', feedback: FEEDBACK })
      .expect(403);
    // Y el coordinador no envía sugerencias.
    await as(COORDINATOR)
      .post(`/academic/guides/${guideId}/suggestions`)
      .send({
        fieldKey: 'recursos',
        proposedValue: 'x',
        justification: JUSTIFICATION,
        neededBy: '2026-11-20',
      })
      .expect(403);
  });
});
