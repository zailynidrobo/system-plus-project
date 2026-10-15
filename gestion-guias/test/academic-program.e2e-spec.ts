import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { ProgramsService } from '../src/academic-program/services/programs.service.js';
import { Role } from '../src/users/role.js';
import { startKeycloakTestServer } from './keycloak-test-server.js';

describe('HE-02 Gestión del programa académico (e2e)', () => {
  let app: INestApplication<App>;
  let keycloak: Awaited<ReturnType<typeof startKeycloakTestServer>>;
  let coordinator: string;
  let teacher: string;
  let programId: string;

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  const createModule = (body: object, token = coordinator) =>
    http().post(`/programs/${programId}/modules`).set(bearer(token)).send(body);

  const registerModule = async (
    name: string,
    description = `Descripción de ${name}`,
  ) => {
    const response = await createModule({ name, description }).expect(201);
    return response.body as { id: string; code: string };
  };

  const addCompetency = async (moduleId: string, text: string) => {
    const response = await http()
      .post(`/modules/${moduleId}/competencies`)
      .set(bearer(coordinator))
      .send({ text })
      .expect(201);
    return response.body as { id: string; code: string };
  };

  beforeAll(async () => {
    keycloak = await startKeycloakTestServer();
    process.env.KEYCLOAK_ISSUER_URL = keycloak.issuer;
    process.env.KEYCLOAK_AUDIENCE = keycloak.audience;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    const config = app.get(ConfigService);
    if (!config.get<string>('DB_NAME', '').endsWith('_test')) {
      throw new Error(
        'Las pruebas e2e reinician la base de datos: DB_NAME debe terminar en _test',
      );
    }
    coordinator = keycloak.createToken([Role.COORDINADOR], {
      sub: 'coord-1',
      name: 'Laura Muñoz',
    });
    teacher = keycloak.createToken([Role.DOCENTE], {
      sub: 'doc-1',
      name: 'Docente Pérez',
    });
  });

  beforeEach(async () => {
    await app.get(DataSource).synchronize(true);
    programId = (await app.get(ProgramsService).ensureDefaultProgram()).id;
  });

  afterAll(async () => {
    await app?.close();
    await keycloak?.close();
  });

  describe('seguridad', () => {
    it('exige token y reserva las escrituras al Coordinador Académico', async () => {
      await http().get(`/programs/${programId}/modules`).expect(401);
      await createModule(
        { name: 'Redes', description: 'Redes' },
        teacher,
      ).expect(403);
      await http()
        .get(`/programs/${programId}/modules`)
        .set(bearer(teacher))
        .expect(200);
    });
  });

  describe('HE-02-HU-01 registrar módulo', () => {
    it('CA-01 guarda el módulo con los datos ingresados', async () => {
      const response = await createModule({
        name: '  Seguridad informática y soporte técnico ',
        description: 'Aplica prácticas de protección de la información.',
      }).expect(201);

      expect(response.body).toMatchObject({
        code: 'TS-MOD-01',
        name: 'Seguridad informática y soporte técnico',
        status: 'active',
        competenciesCount: 0,
        availableForGuides: false,
        program: { code: 'TS', name: 'Técnico en Sistemas' },
        audit: { createdBy: { id: 'coord-1', name: 'Laura Muñoz' } },
      });

      const second = await registerModule('Bases de Datos');
      expect(second.code).toBe('TS-MOD-02');

      const list = await http()
        .get(`/programs/${programId}/modules`)
        .set(bearer(coordinator))
        .expect(200);
      expect(list.body.map((module: { name: string }) => module.name)).toEqual([
        'Bases de Datos',
        'Seguridad informática y soporte técnico',
      ]);
    });

    it('CA-02 impide duplicados sin distinguir mayúsculas ni espacios y muestra el existente', async () => {
      const existing = await registerModule('Bases de Datos');

      const response = await createModule({
        name: '  bases   de DATOS ',
        description: 'Otra',
      }).expect(409);
      expect(response.body).toMatchObject({
        code: 'MODULE_NAME_DUPLICATED',
        existingModule: {
          id: existing.id,
          code: 'TS-MOD-01',
          name: 'Bases de Datos',
        },
      });

      const availability = await http()
        .get(`/programs/${programId}/modules/name-availability`)
        .query({ name: 'BASES DE DATOS' })
        .set(bearer(coordinator))
        .expect(200);
      expect(availability.body).toMatchObject({
        available: false,
        existingModule: { id: existing.id },
      });

      await http()
        .get(`/programs/${programId}/modules/name-availability`)
        .query({ name: 'Bases de Datos', excludeModuleId: existing.id })
        .set(bearer(coordinator))
        .expect(200)
        .expect(({ body }) => expect(body.available).toBe(true));
    });

    it('valida campos obligatorios y permite guardar borrador', async () => {
      await createModule({ name: 'Redes' }).expect(400);
      await createModule({ name: '   ', description: 'x' }).expect(400);

      const draft = await createModule({
        name: 'Redes y conectividad',
        draft: true,
      }).expect(201);
      expect(draft.body.status).toBe('draft');

      await http()
        .post(`/modules/${draft.body.id}/competencies`)
        .set(bearer(coordinator))
        .send({ text: 'Configurar redes de área local.' })
        .expect(409);
      await http()
        .patch(`/modules/${draft.body.id}/register`)
        .set(bearer(coordinator))
        .expect(400);
      await http()
        .patch(`/modules/${draft.body.id}`)
        .set(bearer(coordinator))
        .send({ description: 'Diseña e implementa redes.' })
        .expect(200);
      await http()
        .patch(`/modules/${draft.body.id}/register`)
        .set(bearer(coordinator))
        .expect(200)
        .expect(({ body }) => expect(body.status).toBe('active'));
    });
  });

  describe('HE-02-HU-02 editar módulo', () => {
    it('CA-01 refleja el cambio de inmediato sin alterar código ni competencias', async () => {
      const module = await registerModule('Programación Orientada a Objetos');
      await addCompetency(
        module.id,
        'Modelar soluciones de software mediante clases y objetos.',
      );

      const response = await http()
        .patch(`/modules/${module.id}`)
        .set(bearer(coordinator))
        .send({
          name: 'Programación Orientada a Objetos y Patrones',
          description:
            'Desarrolla soluciones con clases, herencia y patrones de diseño.',
        })
        .expect(200);
      expect(response.body).toMatchObject({
        code: module.code,
        name: 'Programación Orientada a Objetos y Patrones',
        competenciesCount: 1,
        audit: { updatedBy: { name: 'Laura Muñoz' } },
      });
      expect(response.body.competencies[0].code).toBe('COMP-POO-01');

      const detail = await http()
        .get(`/modules/${module.id}`)
        .set(bearer(teacher))
        .expect(200);
      expect(detail.body.name).toBe(
        'Programación Orientada a Objetos y Patrones',
      );
    });

    it('rechaza nombres duplicados y ediciones vacías, pero permite cambiar mayúsculas', async () => {
      await registerModule('Bases de Datos');
      const module = await registerModule('Redes');

      await http()
        .patch(`/modules/${module.id}`)
        .set(bearer(coordinator))
        .send({ name: 'bases de datos' })
        .expect(409);
      await http()
        .patch(`/modules/${module.id}`)
        .set(bearer(coordinator))
        .send({})
        .expect(400);
      await http()
        .patch(`/modules/${module.id}`)
        .set(bearer(coordinator))
        .send({ name: 'REDES' })
        .expect(200);
    });
  });

  describe('HE-02-HU-03 inhabilitar módulo', () => {
    it('CA-01 deja de estar disponible para nuevas guías y conserva su información', async () => {
      const module = await registerModule('Bases de Datos');
      await addCompetency(
        module.id,
        'Diseñar modelos relacionales normalizados.',
      );

      const response = await http()
        .patch(`/modules/${module.id}/deactivate`)
        .set(bearer(coordinator))
        .send({ reason: 'Dejó de dictarse en el plan de estudios' })
        .expect(200);
      expect(response.body).toMatchObject({
        status: 'inactive',
        competenciesCount: 1,
        availableForGuides: false,
        audit: {
          inactivatedBy: { name: 'Laura Muñoz' },
          inactivationReason: 'Dejó de dictarse en el plan de estudios',
        },
      });

      await http()
        .patch(`/modules/${module.id}/deactivate`)
        .set(bearer(coordinator))
        .expect(409);
      await http()
        .post(`/modules/${module.id}/competencies`)
        .set(bearer(coordinator))
        .send({ text: 'Optimizar consultas SQL complejas.' })
        .expect(409);

      const available = await http()
        .get(`/programs/${programId}/modules`)
        .query({ availableForGuides: 'true' })
        .set(bearer(teacher))
        .expect(200);
      expect(available.body).toHaveLength(0);

      const inactive = await http()
        .get(`/programs/${programId}/modules`)
        .query({ status: 'inactive' })
        .set(bearer(coordinator))
        .expect(200);
      expect(inactive.body).toHaveLength(1);

      const summary = await http()
        .get(`/programs/${programId}`)
        .set(bearer(coordinator))
        .expect(200);
      expect(summary.body.modules).toMatchObject({
        total: 1,
        active: 0,
        inactive: 1,
      });

      await http()
        .patch(`/modules/${module.id}/reactivate`)
        .set(bearer(coordinator))
        .expect(200)
        .expect(({ body }) => {
          expect(body.status).toBe('active');
          expect(body.availableForGuides).toBe(true);
        });
    });
  });

  describe('HE-02-HU-04 asociar competencia', () => {
    it('CA-01 el módulo queda asociado a múltiples competencias simultáneamente', async () => {
      const module = await registerModule('Programación Orientada a Objetos');
      await addCompetency(
        module.id,
        'Modelar soluciones de software mediante clases y objetos.',
      );

      await http()
        .get(`/modules/${module.id}/competencies/next-code`)
        .set(bearer(coordinator))
        .expect(200)
        .expect(({ body }) => expect(body.code).toBe('COMP-POO-02'));

      const second = await addCompetency(
        module.id,
        'Aplicar patrones de diseño creacionales y estructurales.',
      );
      expect(second.code).toBe('COMP-POO-02');

      const detail = await http()
        .get(`/modules/${module.id}`)
        .set(bearer(coordinator))
        .expect(200);
      expect(
        detail.body.competencies.map(
          (competency: { code: string }) => competency.code,
        ),
      ).toEqual(['COMP-POO-01', 'COMP-POO-02']);
      expect(detail.body).toMatchObject({
        availableForGuides: true,
        summary: { activeCompetencies: 2 },
      });

      await http()
        .post(`/modules/${module.id}/competencies`)
        .set(bearer(coordinator))
        .send({
          text: '  aplicar patrones de diseño creacionales y estructurales. ',
        })
        .expect(409)
        .expect(({ body }) => expect(body.code).toBe('COMPETENCY_DUPLICATED'));
      await http()
        .post(`/modules/${module.id}/competencies`)
        .set(bearer(coordinator))
        .send({ text: 'corto' })
        .expect(400);
    });
  });

  describe('HE-02-HU-05 editar competencia', () => {
    it('CA-01 refleja el cambio sin afectar las demás competencias y conserva la versión anterior', async () => {
      const module = await registerModule('Programación Orientada a Objetos');
      const first = await addCompetency(
        module.id,
        'Modelar soluciones de software mediante clases.',
      );
      const second = await addCompetency(
        module.id,
        'Implementar encapsulamiento y herencia.',
      );

      const response = await http()
        .patch(`/competencies/${second.id}`)
        .set(bearer(coordinator))
        .send({
          text: 'Implementar encapsulamiento, herencia y polimorfismo en aplicaciones modulares.',
        })
        .expect(200);
      expect(response.body).toMatchObject({
        code: second.code,
        version: 2,
        previousText: 'Implementar encapsulamiento y herencia.',
        updatedBy: { name: 'Laura Muñoz' },
      });

      await http()
        .get(`/competencies/${first.id}`)
        .set(bearer(coordinator))
        .expect(200)
        .expect(({ body }) => {
          expect(body.version).toBe(1);
          expect(body.text).toBe(
            'Modelar soluciones de software mediante clases.',
          );
        });

      const history = await http()
        .get(`/competencies/${second.id}/history`)
        .set(bearer(teacher))
        .expect(200);
      expect(
        history.body.revisions.map(
          (revision: { version: number }) => revision.version,
        ),
      ).toEqual([1, 2]);

      await http()
        .get(`/competencies/${second.id}/versions/1`)
        .set(bearer(teacher))
        .expect(200)
        .expect(({ body }) => {
          expect(body.text).toBe('Implementar encapsulamiento y herencia.');
          expect(body.isCurrentVersion).toBe(false);
        });

      await http()
        .patch(`/competencies/${second.id}`)
        .set(bearer(coordinator))
        .send({
          text: 'Implementar encapsulamiento, herencia y polimorfismo en aplicaciones modulares.',
        })
        .expect(400);
      await http()
        .patch(`/competencies/${second.id}`)
        .set(bearer(coordinator))
        .send({ text: 'Modelar soluciones de software mediante clases.' })
        .expect(409);
    });
  });

  describe('HE-02-HU-06 eliminar competencia', () => {
    it('CA-01 la retira del módulo sin perder su historial ni reutilizar su código', async () => {
      const module = await registerModule('Bases de Datos');
      const kept = await addCompetency(
        module.id,
        'Diseñar modelos relacionales normalizados.',
      );
      const removed = await addCompetency(
        module.id,
        'Administrar motores de bases de datos obsoletos.',
      );

      const response = await http()
        .delete(`/competencies/${removed.id}`)
        .set(bearer(coordinator))
        .expect(200);
      expect(response.body).toMatchObject({
        competency: {
          id: removed.id,
          status: 'deleted',
          deletedBy: { name: 'Laura Muñoz' },
        },
        remainingActiveCompetencies: 1,
        moduleAvailableForGuides: true,
      });

      const detail = await http()
        .get(`/modules/${module.id}`)
        .set(bearer(coordinator))
        .expect(200);
      expect(
        detail.body.competencies.map(
          (competency: { id: string }) => competency.id,
        ),
      ).toEqual([kept.id]);

      await http()
        .get(`/competencies/${removed.id}`)
        .set(bearer(coordinator))
        .expect(404);
      await http()
        .delete(`/competencies/${removed.id}`)
        .set(bearer(coordinator))
        .expect(404);
      await http()
        .get(`/competencies/${removed.id}/versions/1`)
        .set(bearer(teacher))
        .expect(200)
        .expect(({ body }) => {
          expect(body.status).toBe('deleted');
          expect(body.text).toBe(
            'Administrar motores de bases de datos obsoletos.',
          );
        });

      const next = await addCompetency(
        module.id,
        'Asegurar la integridad de la información.',
      );
      expect(next.code).toBe('COMP-BD-03');

      await http()
        .delete(`/competencies/${kept.id}`)
        .set(bearer(coordinator))
        .expect(200);
      await http()
        .delete(`/competencies/${next.id}`)
        .set(bearer(coordinator))
        .expect(200)
        .expect(({ body }) =>
          expect(body.moduleAvailableForGuides).toBe(false),
        );
    });
  });

  describe('listado', () => {
    it('busca por nombre o código y ordena', async () => {
      await registerModule('Fundamentos de programación');
      await registerModule('Bases de Datos');
      await registerModule('Redes y conectividad');

      const byName = await http()
        .get(`/programs/${programId}/modules`)
        .query({ search: 'datos' })
        .set(bearer(coordinator))
        .expect(200);
      expect(
        byName.body.map((module: { code: string }) => module.code),
      ).toEqual(['TS-MOD-02']);

      const byCode = await http()
        .get(`/programs/${programId}/modules`)
        .query({ search: 'mod-03' })
        .set(bearer(coordinator))
        .expect(200);
      expect(
        byCode.body.map((module: { name: string }) => module.name),
      ).toEqual(['Redes y conectividad']);

      const sorted = await http()
        .get(`/programs/${programId}/modules`)
        .query({ sort: 'code', order: 'desc' })
        .set(bearer(coordinator))
        .expect(200);
      expect(
        sorted.body.map((module: { code: string }) => module.code),
      ).toEqual(['TS-MOD-03', 'TS-MOD-02', 'TS-MOD-01']);

      await http()
        .get(`/programs/${programId}/modules`)
        .query({ status: 'otro' })
        .set(bearer(coordinator))
        .expect(400);
    });
  });
});
