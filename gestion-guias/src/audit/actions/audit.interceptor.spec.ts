import 'reflect-metadata';
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../../auth/keycloak-auth.guard.js';
import { AuditContextResolver } from './audit-context.resolver.js';
import { AuditEventRecord } from './audit-event.entity.js';
import { AuditInterceptor } from './audit.interceptor.js';
import { AuditLogService } from './audit-log.service.js';
import { AuditRequest } from './request-info.js';

const POO = '11111111-1111-4111-8111-111111111111';
const GUIDE = '44444444-4444-4444-8444-444444444444';
const NOW = new Date('2026-11-05T15:30:00Z');

const COORDINATOR = {
  sub: 'coord-laura',
  name: 'Laura Muñoz',
  email: 'laura@example.com',
  realm_access: { roles: ['coordinador'] },
};

function setup(insert = vi.fn(async () => undefined)) {
  const events = { insert } as unknown as Repository<AuditEventRecord>;
  const config = {
    get: (_key: string, fallback?: string) => fallback,
  } as unknown as ConfigService;
  const log = new AuditLogService(events, { now: () => NOW }, config);
  const resolve = vi.fn(async () => ({
    entityType: 'guide' as const,
    entityId: GUIDE,
    entityLabel: 'GB-POO-01 · Guía de clases',
    moduleId: POO,
    moduleName: 'Programación Orientada a Objetos',
  }));
  const resolver = { resolve } as unknown as AuditContextResolver;
  return {
    insert,
    resolve,
    interceptor: new AuditInterceptor(new Reflector(), log, resolver),
  };
}

class GuidesController {}
/** Las rutas públicas (como /auth/*) llevan @Public() en la clase. */
class PublicController {}
const publishHandler = () => undefined;
const loginHandler = () => undefined;
Reflect.defineMetadata(IS_PUBLIC_KEY, true, PublicController);

function http(
  request: Partial<AuditRequest>,
  controller:
    typeof GuidesController | typeof PublicController = GuidesController,
) {
  const handler =
    controller === PublicController ? loginHandler : publishHandler;
  const full: AuditRequest = {
    method: 'PATCH',
    headers: { 'user-agent': 'Vitest' },
    socket: { remoteAddress: '::ffff:192.168.1.20' },
    user: COORDINATOR,
    params: { id: GUIDE },
    originalUrl: `/academic/guides/${GUIDE}/publish`,
    route: { path: '/academic/guides/:id/publish' },
    ...request,
  };
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => full }),
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

const responds = (body: unknown): CallHandler => ({ handle: () => of(body) });

describe('AuditInterceptor (HE-08-HU-01)', () => {
  it('registra un PATCH exitoso con usuario, acción del catálogo, IP y módulo', async () => {
    const { interceptor, insert } = setup();
    const guide = { id: GUIDE, status: 'published', version: 'v1.0' };

    const body = await lastValueFrom(
      interceptor.intercept(http({}), responds(guide)),
    );

    expect(body).toBe(guide);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0]).toEqual([
      expect.objectContaining({
        occurredAt: NOW,
        actorId: 'coord-laura',
        actorName: 'Laura Muñoz',
        actorEmail: 'laura@example.com',
        actorRole: 'coordinador',
        method: 'PATCH',
        route: '/academic/guides/:id/publish',
        path: `/academic/guides/${GUIDE}/publish`,
        area: 'Guías base',
        action: 'Publicar guías',
        result: 'success',
        statusCode: 200,
        ip: '192.168.1.20',
        userAgent: 'Vitest',
        entityType: 'guide',
        entityLabel: 'GB-POO-01 · Guía de clases',
        moduleId: POO,
        moduleName: 'Programación Orientada a Objetos',
        details: { status: 'published', version: 'v1.0' },
      }),
    ]);
  });

  it('un POST exitoso queda con código 201', async () => {
    const { interceptor, insert } = setup();
    await lastValueFrom(
      interceptor.intercept(
        http({
          method: 'POST',
          route: { path: '/academic/guides' },
          originalUrl: '/academic/guides',
          params: {},
        }),
        responds({ id: GUIDE }),
      ),
    );
    expect(insert.mock.calls[0]).toEqual([
      expect.objectContaining({ statusCode: 201, action: 'Crear guías base' }),
    ]);
  });

  it('no registra consultas (GET)', async () => {
    const { interceptor, insert } = setup();
    await lastValueFrom(
      interceptor.intercept(
        http({ method: 'GET', route: { path: '/academic/guides/:id' } }),
        responds({}),
      ),
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it('no registra las rutas excluidas que no cambian nada', async () => {
    const { interceptor, insert } = setup();
    await lastValueFrom(
      interceptor.intercept(
        http({
          method: 'POST',
          route: { path: '/academic/modules/:moduleId/guide-fields/impact' },
        }),
        responds({}),
      ),
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it('no registra las rutas públicas ni peticiones sin sesión', async () => {
    const { interceptor, insert } = setup();
    await lastValueFrom(
      interceptor.intercept(http({}, PublicController), responds({})),
    );
    await lastValueFrom(
      interceptor.intercept(http({ user: undefined }), responds({})),
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it('no registra una respuesta con error', async () => {
    const { interceptor, insert } = setup();
    const failing: CallHandler = {
      handle: () =>
        throwError(() => new BadRequestException('Datos inválidos')),
    };
    await expect(
      lastValueFrom(interceptor.intercept(http({}), failing)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(insert).not.toHaveBeenCalled();
  });

  it('si guardar falla, la respuesta del usuario sale igual', async () => {
    const { interceptor, insert } = setup(
      vi.fn(async () => {
        throw new Error('la base de datos no responde');
      }),
    );
    const guide = { id: GUIDE };
    await expect(
      lastValueFrom(interceptor.intercept(http({}), responds(guide))),
    ).resolves.toBe(guide);
    expect(insert).toHaveBeenCalled();
  });

  it('si no se puede resolver el módulo, la respuesta también sale igual', async () => {
    const { interceptor, resolve, insert } = setup();
    resolve.mockRejectedValueOnce(new Error('timeout'));
    const guide = { id: GUIDE };
    await expect(
      lastValueFrom(interceptor.intercept(http({}), responds(guide))),
    ).resolves.toBe(guide);
    expect(insert).not.toHaveBeenCalled();
  });
});
