import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { KeycloakJwtPayload } from './keycloak.strategy.js';

export const ROLES_KEY = 'roles';

@Injectable()
export class KeycloakRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: KeycloakJwtPayload }>();
    const userRoles = request.user?.realm_access?.roles ?? [];

    if (requiredRoles.some((role) => userRoles.includes(role))) return true;
    throw new ForbiddenException('No tienes el rol requerido para esta operación');
  }
}
