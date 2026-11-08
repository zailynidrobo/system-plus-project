import 'reflect-metadata';
import { NotFoundException, Type } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../../auth/keycloak-roles.guard.js';
import { Role } from '../../users/entities/user.entity.js';
import { PERMISSION_CATALOG } from './permission-catalog.js';
import { RolePermissionsController } from './role-permissions.controller.js';
import { RolePermissionsService } from './role-permissions.service.js';
import { RoutePermission, collectRoutePermissions, routeKey } from './route-permissions.js';

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Todos los controladores del proyecto, para que la prueba cubra también los que se agreguen después. */
async function loadAllControllers(): Promise<Type[]> {
  const files = readdirSync(srcDir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.controller.ts'));
  const modules = await Promise.all(files.map((f) => import(pathToFileURL(join(srcDir, f)).href) as Promise<Record<string, unknown>>));
  return modules.flatMap((m) => Object.values(m)).filter((v): v is Type => typeof v === 'function' && Reflect.hasMetadata('path', v));
}

const actions = (service: RolePermissionsService, role: Role) => service.findOne(role).permissions.map((p) => p.action);

describe('Permisos autorizados por rol (HE-08-HU-02)', () => {
  let routes: RoutePermission[];
  let service: RolePermissionsService;

  beforeAll(async () => {
    routes = collectRoutePermissions(await loadAllControllers());
    service = new RolePermissionsService({} as DiscoveryService);
    service.load(routes);
  });

  it('cada ruta protegida tiene una descripción legible', () => {
    const sinDescripcion = routes.map(routeKey).filter((key) => !PERMISSION_CATALOG[key]);
    expect(sinDescripcion).toEqual([]);
  });

  it('el catálogo no describe rutas que ya no existen', () => {
    const existentes = new Set(routes.map(routeKey));
    expect(Object.keys(PERMISSION_CATALOG).filter((key) => !existentes.has(key))).toEqual([]);
  });

  it('no incluye las rutas públicas de inicio de sesión', () => {
    expect(routes.some((r) => r.path.startsWith('/auth'))).toBe(false);
  });

  it('el administrador gestiona usuarios y roles, pero no guías', () => {
    const admin = actions(service, Role.ADMIN);
    expect(admin).toContain('Asignar roles');
    expect(admin).toContain('Desactivar usuarios');
    expect(admin).toContain('Consultar los permisos de cada rol');
    expect(admin).not.toContain('Publicar guías');
  });

  it('el coordinador aprueba sugerencias y publica guías, pero no gestiona usuarios', () => {
    const coordinador = actions(service, Role.COORDINADOR);
    expect(coordinador).toContain('Aprobar sugerencias');
    expect(coordinador).toContain('Publicar guías');
    expect(coordinador).not.toContain('Asignar roles');
    expect(coordinador).not.toContain('Enviar sugerencias sobre una guía');
  });

  it('el docente sugiere cambios, pero no los aprueba ni adjunta material', () => {
    const docente = actions(service, Role.DOCENTE);
    expect(docente).toContain('Enviar sugerencias sobre una guía');
    expect(docente).toContain('Crear una versión personalizada de una guía');
    expect(docente).not.toContain('Aprobar sugerencias');
    expect(docente).not.toContain('Adjuntar material de apoyo');
  });

  it('el docente autorizado además puede adjuntar material de apoyo', () => {
    const autorizado = actions(service, Role.DOCENTE_AUTORIZADO);
    const docente = actions(service, Role.DOCENTE);
    expect(autorizado).toContain('Adjuntar material de apoyo');
    expect(docente.every((a) => autorizado.includes(a))).toBe(true);
  });

  it('las rutas sin rol exigido aparecen para todos los roles', () => {
    for (const role of Object.values(Role)) {
      expect(actions(service, role)).toContain('Consultar sus notificaciones');
    }
  });

  it('devuelve los permisos agrupables por área y ordenados', () => {
    const { permissions, totalPermissions, label } = service.findOne(Role.COORDINADOR);
    expect(label).toBe('Coordinador Académico');
    expect(totalPermissions).toBe(permissions.length);
    const areas = permissions.map((p) => p.area);
    expect(areas).toEqual([...areas].sort((a, b) => a.localeCompare(b, 'es')));
    expect(permissions.every((p) => p.method && p.path.startsWith('/'))).toBe(true);
  });

  it('el resumen trae los cuatro roles con su número de permisos', () => {
    const resumen = service.findAll();
    expect(resumen.map((r) => r.role)).toEqual(Object.values(Role));
    for (const r of resumen) {
      expect(r.totalPermissions).toBe(service.findOne(r.role).totalPermissions);
      expect(r.areas.length).toBeGreaterThan(0);
    }
  });

  it('responde 404 si el rol no existe', () => {
    expect(() => service.findOne('superusuario')).toThrow(NotFoundException);
  });

  it('la consulta de permisos es solo para el administrador', () => {
    expect(Reflect.getMetadata(ROLES_KEY, RolePermissionsController)).toEqual([Role.ADMIN]);
  });
});
