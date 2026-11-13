/**
 * Nombre legible de cada ruta protegida, para que el administrador entienda qué permite.
 * Quién puede usar cada ruta NO se define aquí: sale de los decoradores @Roles de los
 * controladores. Si se agrega una ruta nueva, la prueba de este módulo avisa que falta su descripción.
 */
export interface PermissionDescription {
  area: string;
  action: string;
}

const USUARIOS = 'Usuarios y roles';
const PROGRAMA = 'Programa y módulos';
const COMPETENCIAS = 'Competencias';
const ESTRUCTURA = 'Estructura de guías';
const GUIAS = 'Guías base';
const MATERIALES = 'Material de apoyo';
const ASIGNACION = 'Asignación de docentes';
const VERSIONES = 'Versiones personalizadas';
const SUGERENCIAS = 'Sugerencias';
const NOTIFICACIONES = 'Notificaciones';
const AUDITORIA = 'Auditoría';
const CIERRES = 'Cierres de edición';

export const PERMISSION_CATALOG: Record<string, PermissionDescription> = {
  'POST /users': { area: USUARIOS, action: 'Registrar usuarios' },
  'GET /users': { area: USUARIOS, action: 'Consultar la lista de usuarios' },
  'GET /users/:id': { area: USUARIOS, action: 'Ver el detalle de un usuario' },
  'PATCH /users/:id': { area: USUARIOS, action: 'Editar los datos de un usuario' },
  'PATCH /users/:id/deactivate': { area: USUARIOS, action: 'Desactivar usuarios' },
  'PATCH /users/:id/role': { area: USUARIOS, action: 'Asignar roles' },
  'GET /academic/teachers': { area: ASIGNACION, action: 'Consultar la lista de docentes' },

  'GET /programs': { area: PROGRAMA, action: 'Consultar los programas académicos' },
  'GET /programs/:programId': { area: PROGRAMA, action: 'Ver el detalle de un programa' },
  'POST /programs/:programId/modules': { area: PROGRAMA, action: 'Crear módulos curriculares' },
  'GET /programs/:programId/modules': { area: PROGRAMA, action: 'Consultar los módulos de un programa' },
  'GET /programs/:programId/modules/name-availability': { area: PROGRAMA, action: 'Verificar si el nombre de un módulo está disponible' },
  'GET /modules/:moduleId': { area: PROGRAMA, action: 'Ver el detalle de un módulo' },
  'PATCH /modules/:moduleId': { area: PROGRAMA, action: 'Editar módulos' },
  'PATCH /modules/:moduleId/register': { area: PROGRAMA, action: 'Registrar módulos (pasar de borrador a registrado)' },
  'PATCH /modules/:moduleId/deactivate': { area: PROGRAMA, action: 'Desactivar módulos' },
  'PATCH /modules/:moduleId/reactivate': { area: PROGRAMA, action: 'Reactivar módulos' },

  'POST /modules/:moduleId/competencies': { area: COMPETENCIAS, action: 'Crear competencias' },
  'GET /modules/:moduleId/competencies': { area: COMPETENCIAS, action: 'Consultar las competencias de un módulo' },
  'GET /modules/:moduleId/competencies/next-code': { area: COMPETENCIAS, action: 'Obtener el código de la siguiente competencia' },
  'GET /competencies/:competencyId': { area: COMPETENCIAS, action: 'Ver el detalle de una competencia' },
  'PATCH /competencies/:competencyId': { area: COMPETENCIAS, action: 'Editar competencias' },
  'DELETE /competencies/:competencyId': { area: COMPETENCIAS, action: 'Eliminar competencias' },
  'GET /competencies/:competencyId/history': { area: COMPETENCIAS, action: 'Consultar el historial de una competencia' },
  'GET /competencies/:competencyId/versions/:version': { area: COMPETENCIAS, action: 'Ver una versión anterior de una competencia' },

  'PUT /academic/modules/:moduleId/guide-fields': { area: ESTRUCTURA, action: 'Definir los campos de las guías de un módulo' },
  'GET /academic/modules/:moduleId/guide-fields': { area: ESTRUCTURA, action: 'Consultar los campos de las guías de un módulo' },
  'POST /academic/modules/:moduleId/guide-fields/impact': { area: ESTRUCTURA, action: 'Revisar el impacto de cambiar los campos' },
  'GET /academic/modules/:moduleId/guides/next-code': { area: ESTRUCTURA, action: 'Obtener el código de la siguiente guía' },
  'PUT /academic/modules/:moduleId/teacher-guide-fields': { area: ESTRUCTURA, action: 'Definir qué campos puede personalizar el docente' },
  'PUT /academic/modules/:moduleId/competencies/:competencyId/guide-fields': { area: ESTRUCTURA, action: 'Definir los campos de las guías de una competencia' },

  'POST /academic/guides': { area: GUIAS, action: 'Crear guías base' },
  'GET /academic/guides': { area: GUIAS, action: 'Consultar y buscar guías' },
  'GET /academic/guides/summary': { area: GUIAS, action: 'Ver el resumen de guías' },
  'GET /academic/guides/:id': { area: GUIAS, action: 'Ver el detalle de una guía' },
  'GET /academic/guides/:id/events': { area: GUIAS, action: 'Consultar la actividad de una guía' },
  'GET /academic/guides/:id/versions': { area: GUIAS, action: 'Consultar el historial de versiones de una guía' },
  'GET /academic/guides/:id/versions/:version': { area: GUIAS, action: 'Ver una versión anterior de una guía' },
  'GET /academic/guides/:id/versions/:version/export': { area: GUIAS, action: 'Descargar una versión anterior de una guía' },
  'GET /academic/guides/:id/export': { area: GUIAS, action: 'Descargar guías (PDF o DOCX)' },
  'PATCH /academic/guides/:id': { area: GUIAS, action: 'Editar guías base' },
  'PATCH /academic/guides/:id/publish': { area: GUIAS, action: 'Publicar guías' },

  'GET /academic/guide-edit-locks': { area: CIERRES, action: 'Consultar los periodos en que no se pueden editar guías' },
  'POST /academic/guide-edit-locks': { area: CIERRES, action: 'Programar un periodo de edición inhabilitada' },
  'DELETE /academic/guide-edit-locks/:id': { area: CIERRES, action: 'Eliminar un periodo de edición inhabilitada' },

  'POST /academic/guides/:id/support-materials': { area: MATERIALES, action: 'Adjuntar material de apoyo' },
  'DELETE /academic/guides/:id/support-materials/:materialId': { area: MATERIALES, action: 'Eliminar material de apoyo' },
  'GET /academic/guides/:id/support-materials': { area: MATERIALES, action: 'Consultar el material de apoyo' },
  'GET /academic/guides/:id/support-materials/:materialId/download': { area: MATERIALES, action: 'Descargar material de apoyo' },

  'PUT /academic/modules/:moduleId/teachers/:teacherId': { area: ASIGNACION, action: 'Asignar docentes a un módulo' },
  'GET /academic/modules/:moduleId/teachers': { area: ASIGNACION, action: 'Consultar los docentes de un módulo' },
  'DELETE /academic/modules/:moduleId/teachers/:teacherId': { area: ASIGNACION, action: 'Quitar docentes de un módulo' },
  'GET /academic/my-assignments': { area: ASIGNACION, action: 'Consultar los módulos asignados' },

  'POST /academic/guides/:guideId/personalized-versions': { area: VERSIONES, action: 'Crear una versión personalizada de una guía' },
  'GET /academic/personalized-versions': { area: VERSIONES, action: 'Consultar sus versiones personalizadas' },
  'GET /academic/personalized-versions/:id': { area: VERSIONES, action: 'Ver una versión personalizada' },
  'GET /academic/personalized-versions/:id/isolation': { area: VERSIONES, action: 'Comprobar que la versión no afecta la guía base' },
  'GET /academic/personalized-versions/:id/export': { area: VERSIONES, action: 'Descargar una versión personalizada' },
  'PATCH /academic/personalized-versions/:id': { area: VERSIONES, action: 'Editar una versión personalizada' },

  'POST /academic/guides/:guideId/suggestions': { area: SUGERENCIAS, action: 'Enviar sugerencias sobre una guía' },
  'GET /academic/suggestions/mine': { area: SUGERENCIAS, action: 'Consultar sus sugerencias enviadas' },
  'GET /academic/suggestions/mine/:id': { area: SUGERENCIAS, action: 'Ver el detalle de una sugerencia enviada' },
  'GET /academic/suggestions': { area: SUGERENCIAS, action: 'Consultar la bandeja de sugerencias' },
  'GET /academic/suggestions/summary': { area: SUGERENCIAS, action: 'Ver el resumen de sugerencias' },
  'GET /academic/suggestions/guides': { area: SUGERENCIAS, action: 'Consultar las guías con sugerencias' },
  'GET /academic/suggestions/:id': { area: SUGERENCIAS, action: 'Revisar una sugerencia' },
  'PATCH /academic/suggestions/:id/approve': { area: SUGERENCIAS, action: 'Aprobar sugerencias' },
  'PATCH /academic/suggestions/:id/reject': { area: SUGERENCIAS, action: 'Rechazar sugerencias' },

  'GET /academic/notifications': { area: NOTIFICACIONES, action: 'Consultar sus notificaciones' },
  'PATCH /academic/notifications/read-all': { area: NOTIFICACIONES, action: 'Marcar todas las notificaciones como leídas' },
  'PATCH /academic/notifications/:id/read': { area: NOTIFICACIONES, action: 'Marcar una notificación como leída' },

  'GET /audit/permissions': { area: AUDITORIA, action: 'Consultar los permisos de cada rol' },
  'GET /audit/permissions/:role': { area: AUDITORIA, action: 'Consultar los permisos de un rol' },
  'GET /audit/actions': { area: AUDITORIA, action: 'Consultar el historial de acciones de los usuarios' },
  'GET /audit/actions/filters': { area: AUDITORIA, action: 'Consultar las opciones de filtro del historial de acciones' },
  'GET /audit/actions/:id': { area: AUDITORIA, action: 'Ver el detalle de una acción registrada' },
};
