import { ArgumentsHost, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseExceptionFilter } from '@nestjs/core';
import { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { AuditContextResolver } from './audit-context.resolver.js';
import { AuditEventRecord } from './audit-event.entity.js';
import { AuditForbiddenFilter } from './audit-forbidden.filter.js';
import { AuditLogService } from './audit-log.service.js';
import { AuditRequest } from './request-info.js';

const NOW = new Date('2026-11-05T15:30:00Z');
const POO = '11111111-1111-4111-8111-111111111111';

const DOCENTE = {
  sub: 'teacher-julian',
  name: 'Julián Ospina',
  realm_access: { roles: ['docente'] },
};

/** Adaptador HTTP simulado: guarda lo que se le responde al usuario. */
function adapter() {
  return {
    reply: vi.fn(),
    end: vi.fn(),
    isHeadersSent: () => false,
  };
}

function setup(insert = vi.fn(async () => undefined)) {
  const events = { insert } as unknown as Repository<AuditEventRecord>;
  const config = {
    get: (_key: string, fallback?: string) => fallback,
  } as unknown as ConfigService;
  const log = new AuditLogService(events, { now: () => NOW }, config);
  const resolver = {
    resolve: vi.fn(async () => ({
      entityType: 'module' as const,
      entityId: POO,
      entityLabel: 'Programación Orientada a Objetos',
      moduleId: POO,
      moduleName: 'Programación Orientada a Objetos',
    })),
  } as unknown as AuditContextResolver;
  const http = adapter();
  const filter = new AuditForbiddenFilter(log, resolver);
  Object.assign(filter, { httpAdapterHost: { httpAdapter: http } });
  return { filter, insert, http };
}

function host(request: Partial<AuditRequest>) {
  const response = { id: 'res' };
  const full: AuditRequest = {
    method: 'PATCH',
    headers: {},
    socket: { remoteAddress: '10.0.0.8' },
    originalUrl: `/modules/${POO}`,
    route: { path: '/modules/:moduleId' },
    params: { moduleId: POO },
    user: DOCENTE,
    ...request,
  };
  return {
    response,
    host: {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => full }),
      getArgByIndex: (index: number) => (index === 1 ? response : full),
    } as unknown as ArgumentsHost,
  };
}

const denied = () =>
  new ForbiddenException('No tienes el rol requerido para esta operación');

describe('AuditForbiddenFilter (HE-08-HU-01)', () => {
  it('registra el intento denegado y responde igual que el filtro por defecto', async () => {
    const { filter, insert, http } = setup();
    const { host: args, response } = host({});
    const exception = denied();

    filter.catch(exception, args);
    await vi.waitFor(() => expect(http.reply).toHaveBeenCalled());

    expect(insert.mock.calls[0]).toEqual([
      expect.objectContaining({
        actorId: 'teacher-julian',
        actorRole: 'docente',
        area: 'Programa y módulos',
        action: 'Editar módulos',
        result: 'denied',
        statusCode: 403,
        ip: '10.0.0.8',
        moduleId: POO,
        details: { reason: 'No tienes el rol requerido para esta operación' },
      }),
    ]);

    // Lo mismo que respondería Nest sin este filtro.
    const expected = adapter();
    const base = new BaseExceptionFilter();
    Object.assign(base, { httpAdapterHost: { httpAdapter: expected } });
    base.catch(exception, args);
    expect(http.reply.mock.calls).toEqual(expected.reply.mock.calls);
    expect(http.reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: 403,
        error: 'Forbidden',
        message: 'No tienes el rol requerido para esta operación',
      },
      403,
    );
  });

  it('si no puede guardar el evento, el usuario recibe su 403 igual', async () => {
    const { filter, http } = setup(
      vi.fn(async () => {
        throw new Error('sin conexión');
      }),
    );
    filter.catch(denied(), host({}).host);
    await vi.waitFor(() => expect(http.reply).toHaveBeenCalled());
    expect(http.reply.mock.calls[0][2]).toBe(403);
  });

  it('no registra 403 sin sesión ni los del inicio de sesión', async () => {
    const { filter, insert, http } = setup();
    filter.catch(denied(), host({ user: undefined }).host);
    filter.catch(
      denied(),
      host({ route: { path: '/auth/login' }, originalUrl: '/auth/login' }).host,
    );
    await vi.waitFor(() => expect(http.reply).toHaveBeenCalledTimes(2));
    expect(insert).not.toHaveBeenCalled();
  });
});
