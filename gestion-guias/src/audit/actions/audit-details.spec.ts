import { describe, expect, it } from 'vitest';
import { sanitizeDetails, summarizeChange } from './audit-details.js';
import { DETAILS_MAX_LENGTH } from './audit-rules.js';

describe('Datos sensibles en details (HE-08-HU-01)', () => {
  it('nunca guarda password, token ni refreshToken, aunque vengan anidados', () => {
    const details = sanitizeDetails({
      email: 'nuevo@example.com',
      password: 'Secreta123',
      token: 'abc',
      session: {
        refreshToken: 'r-1',
        access_token: 'a-1',
        user: {
          temporaryPassword: 'Temp123',
          newPassword: 'X',
          role: 'docente',
        },
      },
      list: [{ clientSecret: 's' }, { name: 'ok' }],
    });

    const json = JSON.stringify(details);
    for (const secret of [
      'Secreta123',
      'abc',
      'r-1',
      'a-1',
      'Temp123',
      '"s"',
    ]) {
      expect(json).not.toContain(secret);
    }
    expect(json).not.toMatch(/password|token|secret/i);
    expect(details).toEqual({
      email: 'nuevo@example.com',
      session: { user: { role: 'docente' } },
      list: [{}, { name: 'ok' }],
    });
  });

  it('respeta el límite de tamaño: si se pasa, solo deja las llaves', () => {
    const big = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`campo${i}`, 'x'.repeat(150)]),
    );
    const details = sanitizeDetails(big);
    expect(JSON.stringify(details).length).toBeLessThanOrEqual(
      DETAILS_MAX_LENGTH,
    );
    expect(details).toMatchObject({ truncated: true });
    expect((details as { keys: string[] }).keys).toContain('campo0');
  });

  it('recorta textos largos y listas largas', () => {
    const details = sanitizeDetails({
      note: 'y'.repeat(1000),
      items: Array.from({ length: 50 }, (_, i) => i),
    }) as { note: string; items: number[] };
    expect(details.note).toHaveLength(200);
    expect(details.items).toHaveLength(20);
  });

  it('el resumen de una acción lista los campos enviados y el estado resultante, sin valores', () => {
    const summary = summarizeChange(
      { content: { criterios: 'Texto largo de la guía' }, password: 'x' },
      { id: 'g-1', status: 'published', version: 'v1.0', content: { a: 1 } },
    );
    expect(summary).toEqual({
      fields: ['content'],
      status: 'published',
      version: 'v1.0',
    });
    expect(JSON.stringify(summary)).not.toContain('Texto largo');
  });

  it('sin nada que resumir queda en null', () => {
    expect(summarizeChange(undefined, undefined)).toBeNull();
  });
});
