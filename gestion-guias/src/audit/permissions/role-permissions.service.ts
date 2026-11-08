import { Injectable, NotFoundException, OnApplicationBootstrap, Type } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Role } from '../../users/entities/user.entity.js';
import { PERMISSION_CATALOG } from './permission-catalog.js';
import { RoutePermission, collectRoutePermissions, routeKey } from './route-permissions.js';

export const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN]: 'Administrador',
  [Role.COORDINADOR]: 'Coordinador Académico',
  [Role.DOCENTE]: 'Docente',
  [Role.DOCENTE_AUTORIZADO]: 'Docente Autorizado',
};

export interface Permission {
  area: string;
  action: string;
  method: string;
  path: string;
}

export interface RolePermissions {
  role: Role;
  label: string;
  totalPermissions: number;
  permissions: Permission[];
}

export interface RolePermissionsSummary {
  role: Role;
  label: string;
  totalPermissions: number;
  areas: string[];
}

const ROLES = Object.values(Role);

/** HE-08-HU-02: qué puede hacer cada rol, tomado de las reglas que la API aplica. */
@Injectable()
export class RolePermissionsService implements OnApplicationBootstrap {
  private routes: RoutePermission[] = [];

  constructor(private readonly discovery: DiscoveryService) {}

  onApplicationBootstrap() {
    const controllers = this.discovery
      .getControllers()
      .map((wrapper) => wrapper.metatype)
      .filter((metatype): metatype is Type => typeof metatype === 'function');
    this.load(collectRoutePermissions(controllers));
  }

  /** Separado para poder probar el servicio sin levantar la aplicación. */
  load(routes: RoutePermission[]) {
    this.routes = routes;
  }

  findAll(): RolePermissionsSummary[] {
    return ROLES.map((role) => {
      const { label, totalPermissions, permissions } = this.build(role);
      return { role, label, totalPermissions, areas: [...new Set(permissions.map((p) => p.area))] };
    });
  }

  findOne(role: string): RolePermissions {
    if (!ROLES.includes(role as Role)) {
      throw new NotFoundException(`El rol "${role}" no existe. Roles válidos: ${ROLES.join(', ')}`);
    }
    return this.build(role as Role);
  }

  private build(role: Role): RolePermissions {
    const permissions = this.routes
      // Sin @Roles la ruta está abierta a cualquier usuario con sesión.
      .filter((route) => route.roles.length === 0 || route.roles.includes(role))
      .map((route) => {
        const description = PERMISSION_CATALOG[routeKey(route)];
        return {
          area: description?.area ?? 'Otros',
          action: description?.action ?? routeKey(route),
          method: route.method,
          path: route.path,
        };
      })
      .sort((a, b) => a.area.localeCompare(b.area, 'es') || a.action.localeCompare(b.action, 'es'));

    return { role, label: ROLE_LABELS[role], totalPermissions: permissions.length, permissions };
  }
}
