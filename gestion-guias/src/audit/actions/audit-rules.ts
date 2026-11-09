/**
 * Reglas del registro de auditoría (HE-08-HU-01) en un solo lugar, para que sea fácil
 * ajustarlas si el cliente decide otra cosa (ver "Pendientes por confirmar" en docs/he08-auditoria.md).
 */

/** Métodos que cambian algo. Las consultas (GET) no se registran: llenarían la tabla sin aportar. */
export const AUDITED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Rutas que usan POST, PUT, PATCH o DELETE pero no cambian nada. Se escriben como en el
 * catálogo de permisos (`MÉTODO /ruta/:param`).
 */
export const EXCLUDED_ROUTES = new Set<string>([
  'POST /academic/modules/:moduleId/guide-fields/impact',
]);

/** Los accesos denegados (403) se registran en cualquier método, también en consultas. */
export const AUDIT_DENIED_READS = true;

/** Área de los eventos de inicio y cierre de sesión. Las demás salen de PERMISSION_CATALOG. */
export const SESSION_AREA = 'Sesión';

export const SESSION_ACTIONS = {
  login: { route: '/auth/login', action: 'Iniciar sesión' },
  loginFailed: { route: '/auth/login', action: 'Inicio de sesión fallido' },
  logout: { route: '/auth/logout', action: 'Cerrar sesión' },
  temporaryPassword: {
    route: '/auth/temporary-password',
    action: 'Cambiar contraseña temporal',
  },
  temporaryPasswordFailed: {
    route: '/auth/temporary-password',
    action: 'Cambio de contraseña temporal fallido',
  },
} as const;

/** Zona horaria de los filtros `from` y `to`. */
export const AUDIT_TIME_ZONE = 'America/Bogota';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const USER_AGENT_MAX_LENGTH = 300;

/**
 * Llaves que nunca se guardan en `details`, aunque vengan anidadas. Se comparan en minúsculas
 * y por contenido: `newPassword`, `access_token` o `clientSecret` también se descartan.
 */
export const SENSITIVE_KEYS = [
  'password',
  'contrasena',
  'token',
  'secret',
  'authorization',
  'credential',
  'cookie',
];

/** Tamaño máximo de `details` en caracteres de JSON. Si se pasa, solo quedan las llaves. */
export const DETAILS_MAX_LENGTH = 2000;
/** Largo máximo de cada texto dentro de `details`. */
export const DETAILS_MAX_TEXT = 200;
/** Elementos máximos de cada lista dentro de `details`. */
export const DETAILS_MAX_ITEMS = 20;

/**
 * Datos de la respuesta que se copian a `details` como estado resultante de la acción
 * (por ejemplo, la versión publicada o el nuevo rol). Nunca el contenido completo de una guía.
 */
export const RESULT_KEYS = [
  'status',
  'version',
  'role',
  'isActive',
  'assigned',
  'deleted',
];
