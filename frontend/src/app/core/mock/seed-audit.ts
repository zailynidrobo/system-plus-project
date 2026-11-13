import { AcademicModule } from '../../shared/models/academic-module';
import { DetalleDeRol, DetalleEventoAuditoria, PermisoDeRol } from '../../shared/models/audit';
import { Guide } from '../../shared/models/guide';
import { ROLE_LABELS, Role } from '../../shared/models/user';
import { UsuarioMock } from './seed-users';

interface Plantilla {
  area: string;
  action: string;
  rol: Role | null; // null = cualquiera
  entidad: 'guide' | 'module' | 'user' | 'suggestion' | 'session';
  metodo: string;
  ruta: string;
  details: Record<string, unknown> | null;
}

const PLANTILLAS: Plantilla[] = [
  { area: 'Guías base', action: 'Crear guías base', rol: 'COORDINADOR', entidad: 'guide', metodo: 'POST', ruta: '/academic/guides', details: { fields: ['title', 'content'], status: 'draft' } },
  { area: 'Guías base', action: 'Editar guías base', rol: 'COORDINADOR', entidad: 'guide', metodo: 'PATCH', ruta: '/academic/guides/:id', details: { fields: ['content'], status: 'draft' } },
  { area: 'Guías base', action: 'Publicar guías', rol: 'COORDINADOR', entidad: 'guide', metodo: 'PATCH', ruta: '/academic/guides/:id/publish', details: { status: 'published', version: 'v1.0' } },
  { area: 'Sugerencias', action: 'Enviar sugerencias sobre una guía', rol: 'DOCENTE', entidad: 'suggestion', metodo: 'POST', ruta: '/academic/suggestions', details: { fields: ['fieldKey', 'proposedValue', 'justification'] } },
  { area: 'Sugerencias', action: 'Aprobar sugerencias', rol: 'COORDINADOR', entidad: 'suggestion', metodo: 'PATCH', ruta: '/academic/suggestions/:id/approve', details: { status: 'approved', version: 'v1.1' } },
  { area: 'Sugerencias', action: 'Rechazar sugerencias', rol: 'COORDINADOR', entidad: 'suggestion', metodo: 'PATCH', ruta: '/academic/suggestions/:id/reject', details: { status: 'rejected', fields: ['reason', 'feedback'] } },
  { area: 'Programa y módulos', action: 'Crear módulos curriculares', rol: 'COORDINADOR', entidad: 'module', metodo: 'POST', ruta: '/programs/:programId/modules', details: { fields: ['name', 'description'] } },
  { area: 'Usuarios y roles', action: 'Asignar roles', rol: 'ADMINISTRADOR', entidad: 'user', metodo: 'PATCH', ruta: '/users/:id/role', details: { role: 'docente' } },
  { area: 'Usuarios y roles', action: 'Desactivar usuarios', rol: 'ADMINISTRADOR', entidad: 'user', metodo: 'PATCH', ruta: '/users/:id/deactivate', details: { status: 'inactive' } },
  { area: 'Sesión', action: 'Inicio de sesión', rol: null, entidad: 'session', metodo: 'POST', ruta: '/auth/login', details: null },
  { area: 'Sesión', action: 'Cierre de sesión', rol: null, entidad: 'session', metodo: 'POST', ruta: '/auth/logout', details: null },
];

const IPS = ['192.168.1.20', '192.168.1.33', '10.0.0.15', '127.0.0.1'];
const NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36';

/** Unos 50 eventos de los últimos días (el más reciente es de hace un rato), del más reciente al más antiguo. */
export function crearEventosAuditoria(
  usuarios: UsuarioMock[],
  modulos: AcademicModule[],
  guias: Guide[],
): DetalleEventoAuditoria[] {
  const activos = usuarios.filter((u) => u.activo);
  const inicio = Date.now() - 20 * 60_000;
  const eventos: DetalleEventoAuditoria[] = [];

  for (let i = 0; i < 50; i++) {
    const ocurrio = new Date(inicio - i * 53 * 60_000 - (i % 4) * 7_000).toISOString();
    const base = { id: `evt-${String(i + 1).padStart(4, '0')}`, occurredAt: ocurrio, ip: IPS[i % IPS.length], userAgent: NAVEGADOR };

    // cada 11 eventos alguien se equivoca de contraseña
    if (i % 11 === 10) {
      eventos.push({
        ...base,
        user: { id: null, name: null, email: 'intruso@example.com', role: null, roleLabel: null },
        area: 'Sesión',
        action: 'Inicio de sesión fallido',
        result: 'failed',
        statusCode: 401,
        entity: { type: 'session', id: null, label: 'intruso@example.com' },
        module: null,
        method: 'POST',
        route: '/auth/login',
        path: '/auth/login',
        details: null,
      });
      continue;
    }

    const p = PLANTILLAS[(i * 5) % PLANTILLAS.length];
    const candidatos = activos.filter((u) => (p.rol ? u.rol === p.rol : true));
    const u = candidatos[i % candidatos.length];
    const guia = guias[i % guias.length];
    const modulo = modulos.find((m) => m.id === guia.moduleId) ?? null;
    const afectado = activos[(i + 3) % activos.length];

    const entidad =
      p.entidad === 'guide'
        ? { type: 'guide', id: `guia-${guia.id}`, label: `${guia.code} · ${guia.title}` }
        : p.entidad === 'suggestion'
          ? { type: 'suggestion', id: `sug-${i}`, label: `SUG-${String(i + 1).padStart(3, '0')}` }
          : p.entidad === 'module'
            ? { type: 'module', id: `mod-${modulo?.id}`, label: modulo?.name ?? null }
            : p.entidad === 'user'
              ? { type: 'user', id: `u-${afectado.id}`, label: afectado.correo }
              : { type: 'session', id: null, label: u.correo };
    const conModulo = p.entidad === 'guide' || p.entidad === 'suggestion' || p.entidad === 'module';

    // cada 9 eventos un docente intenta publicar una guía y no puede
    const denegado = i % 9 === 8;
    const docente = activos.find((x) => x.rol === 'DOCENTE') ?? u;
    const quien = denegado ? docente : u;
    const sobre = denegado ? { type: 'guide', id: `guia-${guia.id}`, label: `${guia.code} · ${guia.title}` } : entidad;
    const ruta = denegado ? '/academic/guides/:id/publish' : p.ruta;
    eventos.push({
      ...base,
      user: { id: `u-${quien.id}`, name: quien.nombre, email: quien.correo, role: quien.rol, roleLabel: ROLE_LABELS[quien.rol] },
      area: denegado ? 'Guías base' : p.area,
      action: denegado ? 'Publicar guías' : p.action,
      result: denegado ? 'denied' : 'success',
      statusCode: denegado ? 403 : 200,
      entity: sobre,
      module: denegado || conModulo ? (modulo ? { id: String(modulo.id), name: modulo.name } : null) : null,
      method: denegado ? 'PATCH' : p.metodo,
      route: ruta,
      path: ruta.replace(/:\w+/, sobre.id ?? 'x'),
      details: denegado ? null : p.details,
    });
  }
  return eventos;
}

type Fila = [area: string, action: string, method: string, path: string, roles: Role[]];

const TODOS: Role[] = ['ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'DOCENTE_AUTORIZADO'];
const DOCENTES: Role[] = ['DOCENTE', 'DOCENTE_AUTORIZADO'];

const FILAS: Fila[] = [
  ['Usuarios y roles', 'Registrar usuarios', 'POST', '/users', ['ADMINISTRADOR']],
  ['Usuarios y roles', 'Asignar roles', 'PATCH', '/users/:id/role', ['ADMINISTRADOR']],
  ['Usuarios y roles', 'Desactivar usuarios', 'PATCH', '/users/:id/deactivate', ['ADMINISTRADOR']],
  ['Programa y módulos', 'Crear módulos curriculares', 'POST', '/programs/:programId/modules', ['COORDINADOR']],
  ['Programa y módulos', 'Editar módulos', 'PATCH', '/modules/:moduleId', ['COORDINADOR']],
  ['Guías base', 'Crear guías base', 'POST', '/academic/guides', ['COORDINADOR']],
  ['Guías base', 'Editar guías base', 'PATCH', '/academic/guides/:id', ['COORDINADOR']],
  ['Guías base', 'Publicar guías', 'PATCH', '/academic/guides/:id/publish', ['COORDINADOR']],
  ['Guías base', 'Consultar guías de módulos asignados', 'GET', '/academic/guides', TODOS],
  ['Versiones personalizadas', 'Crear una versión personalizada', 'POST', '/academic/guides/:guideId/personalized-versions', DOCENTES],
  ['Versiones personalizadas', 'Editar una versión personalizada', 'PATCH', '/academic/personalized-versions/:id', DOCENTES],
  ['Versiones personalizadas', 'Ver versiones de otros docentes', 'GET', '/academic/guides/:id/personalized-versions', ['COORDINADOR']],
  ['Sugerencias', 'Enviar sugerencias sobre una guía', 'POST', '/academic/guides/:guideId/suggestions', DOCENTES],
  ['Sugerencias', 'Aprobar sugerencias', 'PATCH', '/academic/suggestions/:id/approve', ['COORDINADOR']],
  ['Sugerencias', 'Rechazar sugerencias', 'PATCH', '/academic/suggestions/:id/reject', ['COORDINADOR']],
  ['Auditoría', 'Consultar el historial de acciones de los usuarios', 'GET', '/audit/actions', ['ADMINISTRADOR']],
  ['Auditoría', 'Consultar los permisos de cada rol', 'GET', '/audit/permissions', ['ADMINISTRADOR']],
];

/** El Docente Autorizado tiene los mismos permisos que el Docente (decisión del cliente pendiente). */
export const PERMISOS_MOCK = Object.fromEntries(
  TODOS.map((rol) => [
    rol,
    FILAS.filter((f) => f[4].includes(rol)).map(([area, action, method, path]): PermisoDeRol => ({ area, action, method, path })),
  ]),
) as Record<Role, PermisoDeRol[]>;

export function detalleDeRolMock(role: Role): DetalleDeRol {
  const permissions = [...PERMISOS_MOCK[role]].sort((a, b) => a.area.localeCompare(b.area));
  return { role, label: ROLE_LABELS[role], totalPermissions: permissions.length, permissions };
}
