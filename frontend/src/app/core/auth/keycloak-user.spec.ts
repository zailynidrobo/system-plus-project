import { usuarioDesdeToken } from './keycloak-user';

describe('usuarioDesdeToken (token de Keycloak → usuario)', () => {
  const base = {
    sub: '3936408e-cc51-4435-96a2-c3dbe4f30381',
    email: 'Admin@Example.com',
    name: 'admin 1',
    preferred_username: 'admin@example.com',
  };

  it('arma el usuario con el rol de la app y el correo en minúscula', () => {
    const usuario = usuarioDesdeToken({
      ...base,
      realm_access: { roles: ['default-roles-system-plus', 'offline_access', 'admin', 'uma_authorization'] },
    });

    expect(usuario).toMatchObject({
      nombre: 'admin 1',
      correo: 'admin@example.com',
      rol: 'ADMINISTRADOR',
      activo: true,
      keycloakId: base.sub,
    });
  });

  it('traduce cada rol de Keycloak al rol del front', () => {
    const rolDe = (rol: string) => usuarioDesdeToken({ ...base, realm_access: { roles: [rol] } })?.rol;

    expect(rolDe('coordinador')).toBe('COORDINADOR');
    expect(rolDe('docente')).toBe('DOCENTE');
    expect(rolDe('docente_autorizado')).toBe('DOCENTE_AUTORIZADO');
  });

  it('con varios roles de la app gana el de mayor prioridad', () => {
    const usuario = usuarioDesdeToken({ ...base, realm_access: { roles: ['docente', 'coordinador'] } });

    expect(usuario?.rol).toBe('COORDINADOR');
  });

  it('devuelve null si el usuario no tiene ningún rol de la app', () => {
    expect(usuarioDesdeToken({ ...base, realm_access: { roles: ['offline_access', 'uma_authorization'] } })).toBeNull();
    expect(usuarioDesdeToken({ ...base })).toBeNull();
  });

  it('devuelve null si no hay token', () => {
    expect(usuarioDesdeToken(undefined)).toBeNull();
  });

  it('sin nombre completo usa el nombre de usuario', () => {
    const usuario = usuarioDesdeToken({
      sub: 'x',
      preferred_username: 'docente@example.com',
      realm_access: { roles: ['docente'] },
    });

    expect(usuario?.nombre).toBe('docente@example.com');
    expect(usuario?.correo).toBe('docente@example.com');
  });
});
