# HE-08-HU-01 Consultar el historial de acciones de los usuarios

Permite al Administrador consultar quién hizo qué, cuándo y desde dónde, y filtrar el registro por
usuario o por módulo curricular (POO, Bases de Datos…).

- **CA-01 · Registro de auditoría:** cada evento trae el usuario, la acción, la fecha y hora y la IP de origen.
- **CA-02 · Filtro por usuario o módulo:** con `moduleId` o `userId` solo salen las acciones que cumplen ese criterio.

## Cómo funciona

Cada evento es una fila de la tabla `audit_events` que no se edita ni se borra: la API no tiene
endpoints para hacerlo.

**Qué se registra**

| Qué | Cómo se registra | Resultado |
|---|---|---|
| Toda acción que cambia algo (`POST`, `PUT`, `PATCH`, `DELETE`) de un usuario con sesión y que responde 2xx: crear, editar, publicar, aprobar, rechazar, desactivar, asignar roles y docentes, material de apoyo, competencias, versiones personalizadas y sugerencias | Interceptor global (`AuditInterceptor`), después de la respuesta exitosa. No hay que tocar cada controlador | `success` |
| Accesos denegados (403) de usuarios con sesión: alguien intentó algo que su rol no permite | Filtro global (`AuditForbiddenFilter`). Los guards se ejecutan antes que los interceptores, por eso se captura ahí. La respuesta al usuario es la misma de siempre | `denied` |
| Inicio de sesión, cierre de sesión y cambio de contraseña temporal | `AuthController` (son rutas públicas) | `success` |
| Inicio de sesión fallido y cambio de contraseña temporal fallido, con el correo que se intentó | `AuthController`. **Nunca se guarda la contraseña** | `failed` |

**Qué no se registra**

- Las consultas (`GET`): llenarían la tabla sin aportar a los criterios (ver pendientes).
- La renovación de la sesión (`POST /auth/refresh`).
- Las rutas que usan `POST` pero no cambian nada, como `POST /academic/modules/:moduleId/guide-fields/impact`.
  Están en `EXCLUDED_ROUTES` de `src/audit/actions/audit-rules.ts`.
- Acciones que terminan en error (4xx distinto de 403, o 5xx).

**De dónde sale cada dato**

- **Acción y área:** del mismo catálogo de HE-08-HU-02 (`src/audit/permissions/permission-catalog.ts`),
  con `routeKey`. Así "Publicar guías" se llama igual en la pantalla de permisos y en el registro.
  Inicio y cierre de sesión usan el área `Sesión`.
- **Usuario:** `sub`, nombre (`actorFromToken`), correo y el rol de la app que tenía en ese momento.
  La etiqueta del rol (Administrador, Coordinador Académico…) es `ROLE_LABELS` de HE-08-HU-02.
- **Módulo curricular (CA-02):** lo resuelve `AuditContextResolver`. El nombre se guarda como copia,
  para que el historial no cambie si después renombran el módulo.

  | Ruta | De dónde sale el módulo |
  |---|---|
  | Tiene `:moduleId` | Ese mismo |
  | `POST /programs/:programId/modules` | El `id` de la respuesta |
  | Tiene `:competencyId` | `competencies.moduleId` (también si la competencia se acaba de eliminar) |
  | `guides/:id` o `guides/:guideId` | `academic_guides.moduleId` |
  | `POST /academic/guides` | El `moduleId` de la respuesta o del body |
  | `personalized-versions/:id` | `moduleId` de la versión |
  | `suggestions/:id` | `moduleId` de la sugerencia |
  | Usuarios y sesión | No tienen módulo (`null`) |

- **Sobre qué (`entity`):** tipo (`guide`, `module`, `competency`, `user`, `suggestion`,
  `personalized_version`, `support_material`, `teacher_assignment`, `session`), id y una etiqueta
  legible: `GB-POO-01 · Guía de clases`, `Programación Orientada a Objetos`, `SUG-014` o el correo
  del usuario afectado. Las notificaciones leídas se registran sin entidad.
- **`details`:** un resumen corto: los nombres de los campos enviados y el estado resultante
  (`status`, `version`, `role`…). Nunca los valores del body, el contenido de una guía, contraseñas,
  tokens ni secretos: se descartan las llaves que contienen `password`, `token`, `secret`,
  `authorization`, `credential` o `cookie`, aunque vengan anidadas, y el JSON no pasa de 2000 caracteres.

**El registro nunca rompe la acción del usuario.** Si la escritura falla (la base de datos no
responde, un dato no cabe…), el error se reporta con el `Logger` de Nest y la respuesta sale igual.
Se prefirió perder un evento a impedir que un coordinador publique una guía porque la tabla de
auditoría no está disponible. Es una decisión a revisar si el cliente exige que ninguna acción
quede sin registro.

### IP de origen y `TRUST_PROXY`

- `TRUST_PROXY=false` (por defecto): se usa la IP de la conexión.
- `TRUST_PROXY=true`: se usa la primera IP de `X-Forwarded-For`. Actívalo solo si la API está detrás
  de un proxy o balanceador, como en la dockerización (SYS-86). Sin proxy no se debe activar: ese
  encabezado lo puede inventar cualquiera.
- `::ffff:127.0.0.1` se guarda como `127.0.0.1`.

## Endpoints

Solo rol `admin`. Sin sesión responde 401 y con otro rol 403. Los errores usan el formato
`{ statusCode, error, code, message }`.

### `GET /audit/actions`

Registro paginado, del más reciente al más antiguo.

| Parámetro | Descripción |
|---|---|
| `userId` | `sub` del usuario (sale de `/audit/actions/filters`) |
| `moduleId` | Módulo curricular (uuid) |
| `area` | Área exacta: `Guías base`, `Sugerencias`, `Sesión`… |
| `result` | `success`, `denied` o `failed` |
| `from`, `to` | Fechas `YYYY-MM-DD` en hora de Bogotá, ambas incluidas |
| `q` | Busca en el nombre o correo del usuario, en la acción y en "sobre qué" (sin distinguir mayúsculas) |
| `page`, `pageSize` | Página desde 1. `pageSize` es 20 por defecto, máximo 100 |

```json
{
  "items": [
    {
      "id": "0f6d2c9e-5a1b-4c3d-9e8f-7a6b5c4d3e2f",
      "occurredAt": "2026-11-05T15:32:10.000Z",
      "user": {
        "id": "8c1d…",
        "name": "Laura Muñoz",
        "email": "coordinador@example.com",
        "role": "coordinador",
        "roleLabel": "Coordinador Académico"
      },
      "area": "Guías base",
      "action": "Publicar guías",
      "result": "success",
      "statusCode": 200,
      "ip": "192.168.1.20",
      "entity": { "type": "guide", "id": "4f2a…", "label": "GB-POO-01 · Guía de clases" },
      "module": { "id": "11a3…", "name": "Programación Orientada a Objetos" }
    },
    {
      "id": "7b3c…",
      "occurredAt": "2026-11-05T15:30:02.000Z",
      "user": { "id": null, "name": null, "email": "intruso@example.com", "role": null, "roleLabel": null },
      "area": "Sesión",
      "action": "Inicio de sesión fallido",
      "result": "failed",
      "statusCode": 401,
      "ip": "192.168.1.33",
      "entity": { "type": "session", "id": null, "label": "intruso@example.com" },
      "module": null
    }
  ],
  "total": 2,
  "page": 1,
  "pageSize": 20
}
```

Errores (400):

| `code` | Cuándo |
|---|---|
| `INVALID_DATE` | `from` o `to` no es una fecha válida `YYYY-MM-DD` |
| `INVALID_DATE_RANGE` | `from` es posterior a `to` |
| `INVALID_RESULT` | `result` no es `success`, `denied` ni `failed` |
| `INVALID_MODULE` | `moduleId` no es un uuid |
| `INVALID_PAGE` | `page` o `pageSize` no es un entero mayor que 0 |

### `GET /audit/actions/filters`

Opciones de los filtros, sacadas de lo que ya está registrado (solo usuarios y módulos que tienen
eventos). Usuarios y módulos vienen ordenados por nombre.

```json
{
  "users": [{ "id": "8c1d…", "name": "Laura Muñoz", "email": "coordinador@example.com" }],
  "modules": [{ "id": "11a3…", "name": "Programación Orientada a Objetos" }],
  "areas": ["Guías base", "Programa y módulos", "Sesión", "Sugerencias"]
}
```

### `GET /audit/actions/:id`

Detalle de un evento: lo mismo de la lista más `method`, `route`, `path`, `userAgent` y `details`.
Si no existe responde 404 con `code: "NOT_FOUND"`.

```json
{
  "id": "0f6d2c9e-5a1b-4c3d-9e8f-7a6b5c4d3e2f",
  "occurredAt": "2026-11-05T15:32:10.000Z",
  "user": { "id": "8c1d…", "name": "Laura Muñoz", "email": "coordinador@example.com", "role": "coordinador", "roleLabel": "Coordinador Académico" },
  "area": "Guías base",
  "action": "Publicar guías",
  "result": "success",
  "statusCode": 200,
  "ip": "192.168.1.20",
  "entity": { "type": "guide", "id": "4f2a…", "label": "GB-POO-01 · Guía de clases" },
  "module": { "id": "11a3…", "name": "Programación Orientada a Objetos" },
  "method": "PATCH",
  "route": "/academic/guides/:id/publish",
  "path": "/academic/guides/4f2a…/publish",
  "userAgent": "Mozilla/5.0 …",
  "details": { "status": "published", "version": "v1.0" }
}
```

## Para la pantalla (SYS-73)

El menú del administrador ya tiene "Auditoría" sin ruta (`core/layout/shell/nav.ts`).

**Columnas sugeridas**

| Columna | Campo |
|---|---|
| Fecha y hora | `occurredAt`, mostrado en hora de Bogotá |
| Usuario | `user.name` (o `user.email` si el nombre es null, p. ej. en un inicio de sesión fallido) |
| Rol | `user.roleLabel` |
| Acción | `action` (con `area` como etiqueta o agrupador) |
| Módulo | `module.name` (vacío si es `null`) |
| Sobre qué | `entity.label` |
| IP | `ip` |
| Resultado | `result`: `success` = Exitosa, `denied` = Denegada, `failed` = Fallida |

**Filtros:** usuario (`userId`), módulo (`moduleId`), área (`area`), resultado (`result`), fechas
(`from`, `to`) y búsqueda (`q`). Las listas de usuario, módulo y área salen de
`GET /audit/actions/filters`. Al hacer clic en una fila se puede abrir el detalle
(`GET /audit/actions/:id`) para ver `details` y el navegador.

## Pendientes por confirmar con el cliente

Se aplicó el valor por defecto; cada uno se cambia en un solo lugar.

| Pregunta | Valor por defecto | Dónde se cambia |
|---|---|---|
| ¿Las consultas (`GET`) también deben quedar en la auditoría? | No | `AUDITED_METHODS` en `audit-rules.ts` |
| ¿Los accesos denegados a consultas (`GET` con 403) se registran? | Sí | `AUDIT_DENIED_READS` en `audit-rules.ts` |
| ¿Cuánto tiempo se guardan los registros? | No se borran | No hay tarea de limpieza |
| ¿Se necesita exportar el registro a Excel o PDF? | No está en esta historia | — |
| ¿Marcar notificaciones como leídas debe registrarse? Hoy sí (es un `PATCH`) | Sí | `EXCLUDED_ROUTES` en `audit-rules.ts` |
| ¿Si el registro falla, la acción del usuario debe fallar también? | No: se pierde el evento y se reporta en el log | `AuditLogService.record` |

Otras notas:

- El usuario del cierre de sesión se toma del refresh token que envía el front (la API no puede
  verificar su firma, la valida Keycloak) y su nombre, correo y rol se buscan en Keycloak.
- El índice de `occurredAt` es un btree normal: PostgreSQL lo recorre en ambos sentidos, así que
  también sirve para `ORDER BY occurredAt DESC`.
- La asignación de docentes guarda como etiqueta el `sub` del docente; la API no tiene su nombre sin
  consultar Keycloak.

## Archivos

| Archivo | Contenido |
|---|---|
| `src/audit/actions/audit-rules.ts` | Reglas en un solo lugar: métodos, rutas excluidas, área `Sesión`, llaves sensibles, límites |
| `src/audit/actions/audit-event.entity.ts` | Tabla `audit_events` y sus índices |
| `src/audit/actions/audit-log.service.ts` | Escribe los eventos; si falla, solo lo reporta en el log |
| `src/audit/actions/audit.interceptor.ts` | Registra las acciones exitosas que cambian algo |
| `src/audit/actions/audit-forbidden.filter.ts` | Registra los accesos denegados (403) |
| `src/audit/actions/session-audit.service.ts` | Inicio, cierre de sesión y contraseña temporal (lo usa `AuthController`) |
| `src/audit/actions/audit-context.resolver.ts` | Módulo curricular y entidad de cada acción |
| `src/audit/actions/request-info.ts` | IP (`TRUST_PROXY`), navegador, ruta y usuario de la petición |
| `src/audit/actions/audit-details.ts` | Resumen de `details` sin datos sensibles |
| `src/audit/actions/dto/list-audit-actions.query.ts` | Filtros de la consulta y su validación |
| `src/audit/actions/audit-actions.service.ts` | Consulta paginada, opciones de filtros y detalle |
| `src/audit/actions/audit-actions.controller.ts` | Endpoints `/audit/actions` |
| `src/audit/actions/*.spec.ts` | 51 pruebas unitarias |
| `postman/gestion-guias_postman_collection.json` | Carpeta "09 - HE-08 Auditoría (HU-01)" |
