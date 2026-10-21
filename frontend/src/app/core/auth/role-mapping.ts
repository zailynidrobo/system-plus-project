import { Role } from '../../shared/models/user';

/** Roles del realm "system-plus" de Keycloak (los mismos que usa el backend). */
export type KeycloakRole = 'admin' | 'coordinador' | 'docente' | 'docente_autorizado';

const KEYCLOAK_A_FRONT: Record<KeycloakRole, Role> = {
  admin: 'ADMINISTRADOR',
  coordinador: 'COORDINADOR',
  docente: 'DOCENTE',
  docente_autorizado: 'DOCENTE_AUTORIZADO',
};

const FRONT_A_KEYCLOAK: Record<Role, KeycloakRole> = {
  ADMINISTRADOR: 'admin',
  COORDINADOR: 'coordinador',
  DOCENTE: 'docente',
  DOCENTE_AUTORIZADO: 'docente_autorizado',
};

// HE-01 exige un solo rol activo. Si Keycloak trae varios, gana el de mayor prioridad.
const PRIORIDAD: Role[] = ['ADMINISTRADOR', 'COORDINADOR', 'DOCENTE_AUTORIZADO', 'DOCENTE'];

/** Un rol de Keycloak → rol del front, o null si no es un rol de la app. */
export function mapKeycloakRole(rol: string): Role | null {
  const clave = rol.trim().toLowerCase();
  return Object.hasOwn(KEYCLOAK_A_FRONT, clave) ? KEYCLOAK_A_FRONT[clave as KeycloakRole] : null;
}

/**
 * Roles del token de Keycloak (realm_access.roles) → el rol activo del front.
 * Ignora los roles propios de Keycloak (offline_access, uma_authorization,
 * default-roles-system-plus). Devuelve null si el usuario no tiene ningún rol de la app.
 */
export function mapKeycloakRoles(roles: readonly string[]): Role | null {
  const delFront = roles.map(mapKeycloakRole);
  return PRIORIDAD.find((r) => delFront.includes(r)) ?? null;
}

/** Rol del front → rol del backend/Keycloak (para el futuro adaptador de usuarios). */
export function toBackendRole(rol: Role): KeycloakRole {
  return FRONT_A_KEYCLOAK[rol];
}
