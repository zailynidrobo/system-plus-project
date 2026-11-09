import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { Session } from '../../auth/auth.service.js';
import { Role } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/users.service.js';
import { AuditEventRecord } from './audit-event.entity.js';
import { AuditLogService } from './audit-log.service.js';
import { AuditRequest } from './request-info.js';
import { SessionAuditService } from './session-audit.service.js';

const NOW = new Date('2026-11-05T15:30:00Z');

const request: AuditRequest = {
  method: 'POST',
  originalUrl: '/auth/login',
  headers: { 'user-agent': 'Firefox' },
  socket: { remoteAddress: '::ffff:127.0.0.1' },
  // El cuerpo trae la contraseña: nunca debe llegar al registro.
  body: { email: 'laura@example.com', password: 'Secreta123' },
};

const session: Session = {
  accessToken: 'access-token-secreto',
  refreshToken: 'refresh-token-secreto',
  expiresIn: 300,
  refreshExpiresIn: 1800,
  user: {
    id: 'coord-laura',
    name: 'Laura Muñoz',
    email: 'laura@example.com',
    role: Role.COORDINADOR,
    isActive: true,
  },
};

const refreshToken = (sub: string) =>
  `x.${Buffer.from(JSON.stringify({ sub, typ: 'Refresh' })).toString('base64url')}.firma`;

function setup(users: Partial<UsersService> = {}) {
  const insert = vi.fn(async (_event: unknown) => undefined);
  const events = { insert } as unknown as Repository<AuditEventRecord>;
  const config = {
    get: (_key: string, fallback?: string) => fallback,
  } as unknown as ConfigService;
  const log = new AuditLogService(events, { now: () => NOW }, config);
  const service = new SessionAuditService(log, users as UsersService);
  const saved = () =>
    insert.mock.calls.map(([event]) => event as AuditEventRecord);
  return { service, saved };
}

const noSecrets = (event: AuditEventRecord) => {
  const json = JSON.stringify(event);
  expect(json).not.toContain('Secreta123');
  expect(json).not.toContain('secreto');
  // La ruta /auth/temporary-password sí contiene la palabra; lo que importa es `details`.
  expect(JSON.stringify(event.details ?? {})).not.toMatch(/password|token/i);
};

describe('Sesión en el registro de auditoría (HE-08-HU-01)', () => {
  it('inicio de sesión exitoso', async () => {
    const { service, saved } = setup();
    await service.loginSucceeded(request, session);

    const [event] = saved();
    expect(event).toMatchObject({
      occurredAt: NOW,
      actorId: 'coord-laura',
      actorName: 'Laura Muñoz',
      actorEmail: 'laura@example.com',
      actorRole: 'coordinador',
      method: 'POST',
      route: '/auth/login',
      area: 'Sesión',
      action: 'Iniciar sesión',
      result: 'success',
      statusCode: 200,
      ip: '127.0.0.1',
      userAgent: 'Firefox',
      entityType: 'session',
      moduleId: null,
    });
    noSecrets(event);
  });

  it('inicio de sesión fallido: guarda el correo intentado, nunca la contraseña', async () => {
    const { service, saved } = setup();
    const error = new UnauthorizedException({
      code: 'CREDENCIALES_INVALIDAS',
      message: 'Credenciales inválidas',
    });
    await service.loginFailed(request, '  Laura@Example.com ', error);

    const [event] = saved();
    expect(event).toMatchObject({
      actorId: null,
      actorEmail: 'laura@example.com',
      action: 'Inicio de sesión fallido',
      result: 'failed',
      statusCode: 401,
      details: { reason: 'CREDENCIALES_INVALIDAS' },
    });
    noSecrets(event);
  });

  it('cierre de sesión: el usuario sale del refresh token y sus datos de Keycloak', async () => {
    const findOne = vi.fn(async () => ({
      id: 'coord-laura',
      name: 'Laura Muñoz',
      email: 'laura@example.com',
      role: Role.COORDINADOR,
      isActive: true,
    }));
    const { service, saved } = setup({ findOne });
    await service.loggedOut(
      { ...request, originalUrl: '/auth/logout' },
      refreshToken('coord-laura'),
    );

    expect(findOne).toHaveBeenCalledWith('coord-laura');
    const [event] = saved();
    expect(event).toMatchObject({
      actorId: 'coord-laura',
      actorName: 'Laura Muñoz',
      actorRole: 'coordinador',
      route: '/auth/logout',
      action: 'Cerrar sesión',
      result: 'success',
      statusCode: 204,
    });
    noSecrets(event);
  });

  it('cierre de sesión: si Keycloak no responde, se registra con el id', async () => {
    const { service, saved } = setup({
      findOne: vi.fn(async () => {
        throw new Error('sin conexión');
      }),
    });
    await service.loggedOut(request, refreshToken('coord-laura'));
    expect(saved()[0]).toMatchObject({
      actorId: 'coord-laura',
      actorName: null,
    });
  });

  it('cambio de contraseña temporal', async () => {
    const { service, saved } = setup();
    await service.temporaryPasswordChanged(
      { ...request, originalUrl: '/auth/temporary-password' },
      session,
    );
    const [event] = saved();
    expect(event).toMatchObject({
      route: '/auth/temporary-password',
      area: 'Sesión',
      action: 'Cambiar contraseña temporal',
      result: 'success',
      actorId: 'coord-laura',
    });
    noSecrets(event);
  });
});
