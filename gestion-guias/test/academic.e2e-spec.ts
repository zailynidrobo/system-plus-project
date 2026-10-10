import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AcademicModule } from '../src/academic/academic.module.js';

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
      imports: [AcademicModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
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
  });

  afterEach(async () => {
    await app.close();
  });

  it('supports academic structure and the guide draft-to-publication workflow', async () => {
    const moduleResponse = await request(app.getHttpServer())
      .post('/academic/modules')
      .send({ name: 'Matemáticas' })
      .expect(201);
    const moduleId = moduleResponse.body.id as string;

    await request(app.getHttpServer())
      .patch(`/academic/modules/${moduleId}`)
      .send({ name: null })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/academic/modules/${moduleId}`)
      .send({ description: 'Programa académico' })
      .expect(200);

    const competencyResponse = await request(app.getHttpServer())
      .post('/academic/competencies')
      .send({ name: 'Álgebra' })
      .expect(201);
    const competencyId = competencyResponse.body.id as string;

    await request(app.getHttpServer())
      .post(`/academic/modules/${moduleId}/competencies/${competencyId}`)
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/academic/competencies/${competencyId}`)
      .send({ description: 'Expresiones algebraicas' })
      .expect(200);

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
        title: 'Guía de álgebra',
        content: {},
      })
      .expect(201);
    const guideId = guideResponse.body.id as string;

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
        expect(body.publishedAt).toBeDefined();
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
      .delete(`/academic/competencies/${competencyId}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/academic/guides/${guideId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.competencyName).toBe('Álgebra');
      });

    await request(app.getHttpServer())
      .patch(`/academic/modules/${moduleId}/deactivate`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.isActive).toBe(false);
      });
    await request(app.getHttpServer())
      .post('/academic/guides')
      .send({ moduleId, title: 'Otra guía', content: {} })
      .expect(400);
  });
});
