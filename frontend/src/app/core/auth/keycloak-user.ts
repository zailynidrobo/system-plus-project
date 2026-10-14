import { User } from '../../shared/models/user';
import { mapKeycloakRoles } from './role-mapping';

/** Los datos del access token de Keycloak que usa el front. */
export interface TokenKeycloak {
  sub?: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
}

/**
 * Access token de Keycloak → usuario de la app.
 * Devuelve null si no hay token o si el usuario no tiene ningún rol de la app
 * (admin, coordinador, docente o docente_autorizado).
 */
export function usuarioDesdeToken(token: TokenKeycloak | undefined): User | null {
  if (!token) return null;

  const rol = mapKeycloakRoles(token.realm_access?.roles ?? []);
  if (!rol) return null;

  const correo = (token.email ?? token.preferred_username ?? '').trim().toLowerCase();
  const nombre = token.name?.trim() || token.preferred_username?.trim() || correo;

  return {
    // El id numérico solo existe en los datos simulados. El identificador real en Keycloak
    // y en el backend es `keycloakId` (el `sub` del token, un UUID).
    id: 0,
    keycloakId: token.sub,
    nombre,
    correo,
    rol,
    activo: true,
  };
}
