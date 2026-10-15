import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AcademicModule } from '../src/academic/academic.module.js';
import { AcademicProgramModule } from '../src/academic-program/academic-program.module.js';
import { ProgramsService } from '../src/academic-program/services/programs.service.js';
import { DatabaseModule } from '../src/database/database.module.js';

const parseBinaryResponse = (
  response: NodeJS.ReadableStream & {
    setEncoding: (encoding: BufferEncoding) => NodeJS.ReadableStream;
    on: (
      event: string,
      listener: (chunk?: string) => void,
    ) => NodeJS.ReadableStream;
  },
  callback: (error: Error | null, body?: Buffer) => void,
) => {
  let output = '';
  response.setEncoding('binary');
  response.on('data', (chunk) => {
    output += chunk;
  });
  response.on('end', () => callback(null, Buffer.from(output, 'binary')));
};

describe('Academic API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.test', '.env'],
        }),
        DatabaseModule,
        AcademicModule,
        // Los módulos y competencias son los de HE-02: las guías se crean sobre ellos.
        AcademicProgramModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    const config = app.get(ConfigService);
    if (!config.get<string>('DB_NAME', '').endsWith('_test')) {
      throw new Error(
        'Las pruebas e2e reinician la base de datos: DB_NAME debe terminar en _test',
      );
    }
    app.use((request, _response, next) => {
      const role = request.header('x-test-role') ?? 'coordinador';
      const userId = request.header('x-test-user') ?? 'test-coordinator';
      Object.assign(request, {
        user: {
          sub: userId,
          realm_access: { roles: [role] },
        },
      });
      next();
    });
    await app.init();
    await app.get(DataSource).synchronize(true);
  });

  afterEach(async () => {
    await app.close();
  });

  it('supports the guide draft-to-publication workflow on HE-02 modules and competencies', async () => {
    // `synchronize(true)` vació las tablas: se vuelve a crear el programa por defecto.
    const programId = (await app.get(ProgramsService).ensureDefaultProgram())
      .id;
    const moduleResponse = await request(app.getHttpServer())
      .post(`/programs/${programId}/modules`)
      .send({ name: 'Matemáticas', description: 'Programa académico' })
      .expect(201);
    const moduleId = moduleResponse.body.id as string;

    // Sin competencias, HE-02 no habilita el módulo para crear guías.
    await request(app.getHttpServer())
      .post('/academic/guides')
      .send({ moduleId, competencyId: randomUUID(), content: {} })
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe('MODULE_WITHOUT_COMPETENCIES');
      });

    const competencyResponse = await request(app.getHttpServer())
      .post(`/modules/${moduleId}/competencies`)
      .send({ text: 'Resuelve ecuaciones algebraicas' })
      .expect(201);
    const competencyId = competencyResponse.body.id as string;

    await request(app.getHttpServer())
      .post('/academic/guides')
      .send({ moduleId, content: {} })
      .expect(400);

    await request(app.getHttpServer())
      .get(`/academic/modules/${moduleId}/guides/next-code`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.code).toBe('GB-MAT-01');
      });

    await request(app.getHttpServer())
      .put(
        `/academic/modules/${moduleId}/competencies/${competencyId}/guide-fields`,
      )
      .send({
        fields: [
          { key: 'objective', label: 'Objetivo', type: 'text', required: true },
        ],
      })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/academic/modules/${moduleId}/teacher-guide-fields`)
      .send({
        fields: [
          {
            key: 'lessonPlan',
            label: 'Plan de clases',
            type: 'textarea',
            required: false,
            section: 'Planeación',
          },
        ],
      })
      .expect(200);

    const guideResponse = await request(app.getHttpServer())
      .post('/academic/guides')
      .send({
        moduleId,
        competencyId,
        content: {},
      })
      .expect(201);
    const guideId = guideResponse.body.id as string;
    expect(guideResponse.body).toMatchObject({
      code: 'GB-MAT-01',
      title: 'Guía base · Matemáticas',
      structureVersion: 1,
      version: 'v0',
      competencyDeleted: false,
    });
    const materialResponse = await request(app.getHttpServer())
      .post(`/academic/guides/${guideId}/support-materials`)
      .attach('file', Buffer.from('%PDF-1.7\nmaterial de apoyo'), {
        filename: 'lectura-apoyo.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const materialId = materialResponse.body.id as string;
    expect(materialResponse.body).toMatchObject({
      guideId,
      fileName: 'lectura-apoyo.pdf',
      contentType: 'application/pdf',
    });

    await request(app.getHttpServer())
      .patch(`/academic/guides/${guideId}/publish`)
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/academic/guides/${guideId}`)
      .send({ content: { objective: 'Resolver ecuaciones' } })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/academic/guides/${guideId}/publish`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('published');
        expect(body.version).toBe('v1.0');
        expect(body.publishedAt).toBeDefined();
      });
    await request(app.getHttpServer())
      .get(`/academic/guides/${guideId}/events`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ title: 'Guía creada como borrador' }),
            expect.objectContaining({ title: 'Objetivo editado' }),
            expect.objectContaining({ title: 'Guía publicada' }),
          ]),
        );
      });
    await request(app.getHttpServer())
      .get(`/modules/${moduleId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.guidesCount).toBe(1);
        expect(body.publishedGuidesCount).toBe(1);
      });
    await request(app.getHttpServer())
      .get(`/competencies/${competencyId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.publishedGuidesCount).toBe(1);
      });
    await request(app.getHttpServer())
      .get(`/academic/guides/${guideId}/export?format=docx`)
      .buffer(true)
      .parse(parseBinaryResponse)
      .expect(200)
      .expect(
        'Content-Type',
        /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/,
      )
      .expect(({ body }) => {
        expect(Buffer.isBuffer(body)).toBe(true);
        expect(body.subarray(0, 2).toString()).toBe('PK');
      });
    await request(app.getHttpServer())
      .get(`/academic/guides/${guideId}/export?format=pdf`)
      .buffer(true)
      .parse(parseBinaryResponse)
      .expect(200)
      .expect('Content-Type', /application\/pdf/)
      .expect(({ body }) => {
        expect(Buffer.isBuffer(body)).toBe(true);
        expect(body.subarray(0, 5).toString()).toBe('%PDF-');
      });
    await request(app.getHttpServer())
      .get(`/academic/guides/${guideId}/export?format=csv`)
      .expect(400);
    await request(app.getHttpServer())
      .put(`/academic/modules/${moduleId}/teachers/teacher-one`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/academic/guides/${guideId}/support-materials`)
      .set('x-test-role', 'docente')
      .set('x-test-user', 'teacher-one')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            id: materialId,
            fileName: 'lectura-apoyo.pdf',
            contentType: 'application/pdf',
          }),
        ]);
        expect(body[0]).not.toHaveProperty('data');
      });
    await request(app.getHttpServer())
      .get(
        `/academic/guides/${guideId}/support-materials/${materialId}/download`,
      )
      .set('x-test-role', 'docente')
      .set('x-test-user', 'teacher-one')
      .buffer(true)
      .parse(parseBinaryResponse)
      .expect(200)
      .expect('Content-Type', 'application/pdf')
      .expect(({ body }) => {
        expect(Buffer.isBuffer(body)).toBe(true);
        expect(body.subarray(0, 5).toString()).toBe('%PDF-');
      });
    await request(app.getHttpServer())
      .get(`/academic/guides/${guideId}/support-materials`)
      .set('x-test-role', 'docente')
      .set('x-test-user', 'teacher-two')
      .expect(403);
    const personalizedVersionResponse = await request(app.getHttpServer())
      .post(`/academic/guides/${guideId}/personalized-versions`)
      .set('x-test-role', 'docente')
      .set('x-test-user', 'teacher-one')
      .expect(201);
    const personalizedVersionId = personalizedVersionResponse.body.id as string;
    await request(app.getHttpServer())
      .patch(`/academic/personalized-versions/${personalizedVersionId}`)
      .set('x-test-role', 'docente')
      .set('x-test-user', 'teacher-one')
      .send({ content: { lessonPlan: 'Clase 1: práctica' } })
      .expect(200);
    await request(app.getHttpServer())
      .get(
        `/academic/personalized-versions/${personalizedVersionId}/export?format=pdf`,
      )
      .set('x-test-role', 'docente')
      .set('x-test-user', 'teacher-one')
      .buffer(true)
      .parse(parseBinaryResponse)
      .expect(200)
      .expect('Content-Type', /application\/pdf/)
      .expect(({ body }) => {
        expect(Buffer.isBuffer(body)).toBe(true);
        expect(body.subarray(0, 5).toString()).toBe('%PDF-');
      });
    await request(app.getHttpServer())
      .patch(`/academic/personalized-versions/${personalizedVersionId}`)
      .set('x-test-role', 'docente')
      .set('x-test-user', 'teacher-two')
      .send({ content: { lessonPlan: 'Sin permiso' } })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/academic/guides/${guideId}`)
      .send({ title: 'Edición no permitida' })
      .expect(409);

    await request(app.getHttpServer())
      .delete(`/competencies/${competencyId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.publishedGuidesPreserved).toBe(1);
      });
    await request(app.getHttpServer())
      .get(`/academic/guides/${guideId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.competencyName).toContain(
          'Resuelve ecuaciones algebraicas',
        );
        expect(body.competencyDeleted).toBe(true);
      });

    await request(app.getHttpServer())
      .patch(`/modules/${moduleId}/deactivate`)
      .send({ reason: 'Fin del periodo' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/academic/guides')
      .send({ moduleId, competencyId: randomUUID(), content: {} })
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe('MODULE_NOT_ACTIVE');
      });
  });
});
