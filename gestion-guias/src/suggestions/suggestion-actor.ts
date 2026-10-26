import type { KeycloakJwtPayload } from '../auth/keycloak.strategy.js';

export interface SuggestionActor {
  /** `sub` de Keycloak. */
  id: string;
  name: string;
  roles: string[];
}

/** Nombre visible: `name`, o `given_name` + `family_name`, o `preferred_username` (luego correo o sub). */
export function actorFromToken(payload: KeycloakJwtPayload): SuggestionActor {
  const text = (value: unknown) =>
    typeof value === 'string' ? value.trim() : '';
  const fullName = [text(payload.given_name), text(payload.family_name)]
    .filter(Boolean)
    .join(' ');
  return {
    id: payload.sub,
    name:
      text(payload.name) ||
      fullName ||
      text(payload.preferred_username) ||
      text(payload.email) ||
      payload.sub,
    roles: payload.realm_access?.roles ?? [],
  };
}

export const isTeacher = (roles: string[]) =>
  roles.includes('docente') || roles.includes('docente_autorizado');
