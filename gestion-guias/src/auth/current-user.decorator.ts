import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { KeycloakJwtPayload } from './keycloak.strategy.js';

/** Datos mínimos del usuario autenticado usados para auditoría (creado/editado por). */
export interface AuthenticatedUser {
  id: string;
  name: string;
}

export function toAuthenticatedUser(
  payload: KeycloakJwtPayload,
): AuthenticatedUser {
  const name =
    (typeof payload.name === 'string' && payload.name) ||
    payload.preferred_username ||
    payload.email ||
    payload.sub;
  return { id: payload.sub, name };
}

/** Inyecta el usuario del token de Keycloak validado por `KeycloakAuthGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    toAuthenticatedUser(
      context.switchToHttp().getRequest<{ user: KeycloakJwtPayload }>().user,
    ),
);
