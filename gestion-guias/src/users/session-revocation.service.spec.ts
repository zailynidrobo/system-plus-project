import { describe, expect, it } from 'vitest';
import { SessionRevocationService } from './session-revocation.service.js';

describe('Revocación de sesiones (DEF-02, DEF-04)', () => {
  const ahora = Date.UTC(2026, 10, 14, 12, 0, 0);
  const seg = Math.floor(ahora / 1000);

  it('acepta los tokens de usuarios sin cambios', () => {
    expect(new SessionRevocationService().motivo('u1', seg)).toBeNull();
  });

  it('rechaza los tokens emitidos antes de cambiar el rol', () => {
    const s = new SessionRevocationService();
    s.revocar('u1', 'ROL_ACTUALIZADO', ahora);
    expect(s.motivo('u1', seg - 60)).toBe('ROL_ACTUALIZADO');
    expect(s.motivo('u1', seg)).toBe('ROL_ACTUALIZADO');
  });

  it('acepta el token renovado después del cambio', () => {
    const s = new SessionRevocationService();
    s.revocar('u1', 'ROL_ACTUALIZADO', ahora);
    expect(s.motivo('u1', seg + 1)).toBeNull();
  });

  it('rechaza el token de una cuenta desactivada y no afecta a otros usuarios', () => {
    const s = new SessionRevocationService();
    s.revocar('u1', 'CUENTA_DESACTIVADA', ahora);
    expect(s.motivo('u1', seg - 5)).toBe('CUENTA_DESACTIVADA');
    expect(s.motivo('u2', seg - 5)).toBeNull();
    expect(s.mensaje('CUENTA_DESACTIVADA')).toMatch(/desactivada/);
  });

  it('un token sin fecha de emisión se trata como anterior al cambio', () => {
    const s = new SessionRevocationService();
    s.revocar('u1', 'CUENTA_DESACTIVADA', ahora);
    expect(s.motivo('u1', undefined)).toBe('CUENTA_DESACTIVADA');
  });

  it('olvida las revocaciones de más de un día', () => {
    const s = new SessionRevocationService();
    s.revocar('u1', 'ROL_ACTUALIZADO', ahora);
    s.revocar('u2', 'ROL_ACTUALIZADO', ahora + 25 * 3600 * 1000);
    expect(s.motivo('u1', seg - 10)).toBeNull();
  });
});
