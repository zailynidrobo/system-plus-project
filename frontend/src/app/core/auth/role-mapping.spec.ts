import { mapKeycloakRole, mapKeycloakRoles, toBackendRole } from './role-mapping';

describe('Mapeo de roles Keycloak -> front', () => {
  it.each([
    ['admin', 'ADMINISTRADOR'],
    ['coordinador', 'COORDINADOR'],
    ['docente', 'DOCENTE'],
    ['docente_autorizado', 'DOCENTE_AUTORIZADO'],
  ])('%s -> %s', (keycloak, front) => {
    expect(mapKeycloakRole(keycloak)).toBe(front);
    expect(mapKeycloakRoles([keycloak])).toBe(front);
  });

  it('no distingue mayúsculas ni espacios', () => {
    expect(mapKeycloakRole(' Coordinador ')).toBe('COORDINADOR');
  });

  it('ignora los roles propios de Keycloak', () => {
    const roles = ['offline_access', 'uma_authorization', 'default-roles-system-plus', 'docente'];
    expect(mapKeycloakRoles(roles)).toBe('DOCENTE');
  });

  it('devuelve null si no hay ningún rol de la app', () => {
    expect(mapKeycloakRoles(['offline_access', 'uma_authorization'])).toBeNull();
    expect(mapKeycloakRoles([])).toBeNull();
    expect(mapKeycloakRole('toString')).toBeNull();
  });

  it('con varios roles toma uno solo, el de mayor prioridad (un rol activo, HE-01)', () => {
    expect(mapKeycloakRoles(['docente', 'coordinador'])).toBe('COORDINADOR');
    expect(mapKeycloakRoles(['docente', 'docente_autorizado'])).toBe('DOCENTE_AUTORIZADO');
    expect(mapKeycloakRoles(['docente', 'admin', 'coordinador'])).toBe('ADMINISTRADOR');
  });

  it('convierte de vuelta al rol del backend', () => {
    expect(toBackendRole('ADMINISTRADOR')).toBe('admin');
    expect(toBackendRole('DOCENTE_AUTORIZADO')).toBe('docente_autorizado');
  });
});
