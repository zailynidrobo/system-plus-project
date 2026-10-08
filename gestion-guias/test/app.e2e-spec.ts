import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { startKeycloakTestServer } from './keycloak-test-server.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let keycloak: Awaited<ReturnType<typeof startKeycloakTestServer>>;

  beforeEach(async () => {
    keycloak = await startKeycloakTestServer();
    process.env.KEYCLOAK_ISSUER_URL = keycloak.issuer;
    process.env.KEYCLOAK_AUDIENCE = keycloak.audience;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/users (GET) requires a Keycloak token and the admin realm role', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${keycloak.createToken()}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${keycloak.createToken(['admin'])}`)
      .expect(200);
  });

  it('/academic/modules (GET) accepts a valid Keycloak token', () => {
    return request(app.getHttpServer())
      .get('/academic/modules')
      .set('Authorization', `Bearer ${keycloak.createToken()}`)
      .expect(200);
  });

  afterEach(async () => {
    await app.close();
    await keycloak.close();
  });
});
