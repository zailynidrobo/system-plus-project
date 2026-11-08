import { describe, expect, it } from 'vitest';
import {
  AuditRequest,
  actorFromPayload,
  clientIp,
  normalizeIp,
  requestPath,
  routePattern,
  userAgent,
} from './request-info.js';

const request = (overrides: Partial<AuditRequest> = {}): AuditRequest => ({
  method: 'PATCH',
  headers: {},
  socket: { remoteAddress: '10.0.0.7' },
  ...overrides,
});

describe('Origen de la petición (HE-08-HU-01)', () => {
  it('sin proxy usa la IP del socket', () => {
    expect(clientIp(request(), false)).toBe('10.0.0.7');
  });

  it('sin TRUST_PROXY ignora X-Forwarded-For, que cualquiera puede inventar', () => {
    const forwarded = request({
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    });
    expect(clientIp(forwarded, false)).toBe('10.0.0.7');
  });

  it('con TRUST_PROXY toma la primera IP de X-Forwarded-For', () => {
    const forwarded = request({
      headers: { 'x-forwarded-for': ' 203.0.113.5 , 10.0.0.1' },
    });
    expect(clientIp(forwarded, true)).toBe('203.0.113.5');
  });

  it('con TRUST_PROXY y sin encabezado usa la del socket', () => {
    expect(clientIp(request(), true)).toBe('10.0.0.7');
  });

  it('normaliza ::ffff:127.0.0.1 a 127.0.0.1 y deja las IPv6 reales', () => {
    expect(
      clientIp(
        request({ socket: { remoteAddress: '::ffff:127.0.0.1' } }),
        false,
      ),
    ).toBe('127.0.0.1');
    expect(normalizeIp('::1')).toBe('::1');
    expect(normalizeIp('')).toBeNull();
  });

  it('recorta el navegador a 300 caracteres', () => {
    const agent = userAgent(
      request({ headers: { 'user-agent': 'x'.repeat(500) } }),
    );
    expect(agent).toHaveLength(300);
    expect(userAgent(request())).toBeNull();
  });

  it('separa el patrón de la ruta de la URL real sin query string', () => {
    const publish = request({
      originalUrl: '/academic/guides/abc/publish?x=1',
      route: { path: '/academic/guides/:id/publish' },
    });
    expect(requestPath(publish)).toBe('/academic/guides/abc/publish');
    expect(routePattern(publish)).toBe('/academic/guides/:id/publish');
  });

  it('toma el usuario del token con el rol de mayor alcance', () => {
    expect(
      actorFromPayload({
        sub: 'u-1',
        given_name: 'Laura',
        family_name: 'Muñoz',
        email: 'laura@example.com',
        realm_access: { roles: ['offline_access', 'docente', 'coordinador'] },
      }),
    ).toEqual({
      actorId: 'u-1',
      actorName: 'Laura Muñoz',
      actorEmail: 'laura@example.com',
      actorRole: 'coordinador',
    });
  });
});
