import { RequestMethod, Type } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { IS_PUBLIC_KEY } from '../../auth/keycloak-auth.guard.js';
import { ROLES_KEY } from '../../auth/keycloak-roles.guard.js';

/** Una ruta protegida de la API y los roles que la pueden usar. */
export interface RoutePermission {
  method: string;
  path: string;
  /** Vacío cuando la ruta no exige rol: la puede usar cualquier usuario con sesión. */
  roles: string[];
}

function joinPath(...parts: (string | string[] | undefined)[]): string {
  const segments = parts
    .map((part) => (Array.isArray(part) ? part[0] : part) ?? '')
    .flatMap((part) => part.split('/'))
    .filter(Boolean);
  return '/' + segments.join('/');
}

/**
 * Lee los permisos directamente de los decoradores (@Roles, @Public, @Get...) de los
 * controladores. Así la consulta muestra lo que la API realmente hace cumplir y no una
 * lista aparte que se pueda desactualizar.
 */
export function collectRoutePermissions(controllers: Type[]): RoutePermission[] {
  const routes: RoutePermission[] = [];

  for (const controller of controllers) {
    const basePath = Reflect.getMetadata(PATH_METADATA, controller) as string | string[] | undefined;
    const classRoles = Reflect.getMetadata(ROLES_KEY, controller) as string[] | undefined;
    const classPublic = Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true;
    const proto = controller.prototype as Record<string, unknown>;

    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue;
      const handler = proto[name];
      if (typeof handler !== 'function') continue;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (method === undefined) continue;

      const isPublic = classPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true;
      if (isPublic) continue;

      const handlerRoles = Reflect.getMetadata(ROLES_KEY, handler) as string[] | undefined;
      const handlerPath = Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined;
      routes.push({
        method: RequestMethod[method],
        path: joinPath(basePath, handlerPath),
        // Igual que KeycloakRolesGuard: el decorador del método manda sobre el de la clase.
        roles: [...(handlerRoles?.length ? handlerRoles : (classRoles ?? []))],
      });
    }
  }

  return routes;
}

export const routeKey = (route: Pick<RoutePermission, 'method' | 'path'>) => `${route.method} ${route.path}`;
