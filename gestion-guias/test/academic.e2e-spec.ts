import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('Academic API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
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
      .put(`/academic/modules/${moduleId}/competencies/${competencyId}/guide-fields`)
      .send({
        fields: [
          { key: 'objective', label: 'Objetivo', type: 'text', required: true },
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
