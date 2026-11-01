# HE-05 · Sugerencias de cambio sobre la guía base

**Épica:** SYS-45 · **HU:** SYS-56 (HU-01 Enviar), SYS-57 (HU-02 Revisar pendientes), SYS-58 (HU-03 Aprobar), SYS-59 (HU-04 Rechazar con retroalimentación).
**Backend:** `gestion-guias/src/suggestions/` · **Frontend:** `frontend/src/app/features/suggestions/` y la campana en `frontend/src/app/core/layout/notification-bell/`.

Un docente propone el cambio de **un campo** de una guía base publicada de su módulo. Coordinación lo aprueba (la guía sube de versión menor) o lo rechaza con motivo y retroalimentación. Las dos partes reciben avisos en la campana del encabezado.

---

## 1. Reglas de negocio

### HU-01 · Enviar sugerencia (`docente`, `docente_autorizado`)

| Regla | Error |
|---|---|
| La guía existe y está publicada | 404 `NOT_FOUND` |
| El módulo de la guía está asignado al docente (también al docente autorizado, ver 3) | 403 `GUIDE_NOT_ASSIGNED` |
| `fieldKey` existe en `fields` de la guía | 400 `FIELD_NOT_FOUND` |
| Campo obligatorio no puede quedar vacío | 400 `PROPOSAL_REQUIRED` |
| Lista: debe ser una de sus opciones | 400 `INVALID_OPTION` |
| Respeta `maxLength` | 400 `VALUE_TOO_LONG` |
| Número: debe ser numérico (acepta `"12"` y lo guarda como `12`) | 400 `INVALID_NUMBER` |
| Fecha: debe ser válida | 400 `INVALID_DATE` |
| Distinto del valor actual (sin contar espacios al inicio y al final) | 400 `NO_CHANGES` |
| Justificación obligatoria, mínimo 20 caracteres | 400 `JUSTIFICATION_REQUIRED`, `JUSTIFICATION_TOO_SHORT` |
| `neededBy` obligatoria, formato `AAAA-MM-DD` | 400 `NEEDED_BY_REQUIRED`, `NEEDED_BY_INVALID` |
| `neededBy` ≥ fecha de envío en Bogotá + 14 días de calendario | 400 `NOTICE_TOO_SHORT` (el mensaje dice la fecha mínima, p. ej. «7 nov 2026») |
| Un docente no tiene dos pendientes propias sobre el mismo campo de la misma guía | 409 `SUGGESTION_ALREADY_PENDING` |

- La última regla también la garantiza la base con el índice único parcial `UQ_academic_guide_suggestions_pending_field` (`guideId`, `teacherId`, `fieldKey`) `WHERE status = 'pending'`. Si dos envíos iguales llegan al tiempo, la violación del índice se responde con el mismo 409.
- El código `SUG-NNN` sale de un consecutivo (`sequence`, único) que se asigna dentro de la transacción con `pg_advisory_xact_lock`: dos envíos simultáneos nunca reciben el mismo código.
- Se guardan `currentValue` (valor del campo en ese momento), `baseVersion`, `dueSoonAt` y `dueAt`.
- `teacherName` sale del token: `name`, o `given_name` + `family_name`, o `preferred_username`.

### Plazo de respuesta (5 a 8 días hábiles)

- Al crear: `dueSoonAt` = fin (23:59:59.999, hora de Bogotá) del **día hábil 5**; `dueAt` = fin del **día hábil 8**. Se cuenta desde el día siguiente al envío.
- Al leer, solo en pendientes:
  - `deadlineStatus`: `on_time` hasta `dueSoonAt`; `due_soon` hasta `dueAt`; `overdue` después.
  - `businessDaysLeft`: días hábiles desde hoy hasta el día de `dueAt` (0 si vence hoy o ya venció).
  - `businessDaysOverdue`: días hábiles de retraso (mínimo 1) cuando está vencida.
- **Una vencida no caduca:** sigue `pending` y se puede aprobar o rechazar. Solo se marca para seguimiento. No hay rol nuevo ni proceso automático que cambie estados.
- Días hábiles = lunes a viernes sin festivos de Colombia (`business-days.ts`, sin dependencias):
  - fijos: 1 ene, 1 may, 20 jul, 7 ago, 8 dic, 25 dic;
  - Ley Emiliani (al lunes siguiente): 6 ene, 19 mar, 29 jun, 15 ago, 12 oct, 1 nov, 11 nov;
  - según la Pascua: jueves y viernes santo; Ascensión, Corpus Christi y Sagrado Corazón al lunes.
- Ejemplo: enviada el viernes 30 oct 2026 → `dueSoonAt` fin del 9 nov y `dueAt` fin del 12 nov (el 2 nov es festivo).

### HU-02 · Revisar pendientes (`coordinador`)

- Bandeja con filtros por estado, módulo, guía y plazo, ordenada por fecha de envío.
- Resumen `{ pending, approved, rejected, dueSoon, overdue }`.
- Lista de guías con sugerencias para el filtro.
- El detalle trae `review.currentGuideValue` (valor vigente, puede ser distinto de `currentValue`), `review.moduleTeachers` y `review.teacherVersions`.

### HU-03 · Aprobar (`coordinador`)

Todo en una transacción, con `pessimistic_write` sobre la sugerencia y la guía:

| Regla | Error |
|---|---|
| La sugerencia sigue pendiente | 409 `SUGGESTION_ALREADY_DECIDED` |
| La guía sigue publicada | 409 `GUIDE_NOT_PUBLISHED` |
| El valor vigente del campo es igual a `currentValue` (otra sugerencia no lo cambió) | 409 `GUIDE_CHANGED` |

Luego: reemplaza el campo en `content`, sube la versión menor (`v1.0 → v1.1`, `v2.1 → v2.2`), actualiza `updatedAt`, `updatedById` y `updatedByName`, registra el evento «Sugerencia SUG-014 aprobada · Criterios de evaluación (v1.1)», marca la sugerencia (`decidedAt`, quién, `resultingVersion`) y crea las notificaciones. **No toca las versiones personalizadas.**

### HU-04 · Rechazar (`coordinador`)

| Regla | Error |
|---|---|
| La sugerencia sigue pendiente | 409 `SUGGESTION_ALREADY_DECIDED` |
| `reason` es uno de los motivos (`REJECT_REASONS`, igual a `MOTIVOS_RECHAZO` del front) | 400 `REASON_REQUIRED` |
| `feedback` de 30 a 500 caracteres (sin contar espacios de los extremos) | 400 `FEEDBACK_TOO_SHORT`, `FEEDBACK_TOO_LONG` |

La guía no cambia. El docente ve el motivo y la retroalimentación en «Mis sugerencias» y recibe una notificación.

### Campana (notificaciones)

| Rol | Qué ve | Contador |
|---|---|---|
| Coordinador | Alertas **calculadas** de las pendientes, sin estado de leído: primero vencidas, luego por vencer, luego nuevas (y dentro de cada grupo, por `dueAt`). Ej.: «SUG-014 · Julián Ospina · GB-POO-01» + «venció hace 2 días hábiles (sigue pendiente)», «vence en 1 día hábil», «nueva, recibida hoy». Desaparecen cuando se deciden. | Número de pendientes |
| Docente / docente autorizado | Notificaciones **guardadas** (`user_notifications`), las 50 más recientes: `SUGGESTION_APPROVED` y `SUGGESTION_REJECTED` (al autor, con el motivo) y `GUIDE_NEW_VERSION` (a los demás docentes asignados al módulo). Se marcan como leídas una a una o todas. | No leídas |
| Administrador | Lista vacía por ahora | 0 |

Cada alerta trae la guía (`id`, `code`, `title`, `version`, `moduleName`) para abrirla directo.

---

## 2. Contrato de la API

Todos los errores tienen el formato `{ statusCode, error, code, message }` (los 403 por rol, del guard de Keycloak, llegan sin `code`). Los ids son UUID; un id que no es UUID responde 404.

| Método y ruta | Rol | Qué hace |
|---|---|---|
| `POST /academic/guides/:guideId/suggestions` | docente, docente_autorizado | Body `{ fieldKey, proposedValue, justification, neededBy }`. 201 con la sugerencia. |
| `GET /academic/suggestions/mine` | docente, docente_autorizado | Mis sugerencias, las más recientes primero. |
| `GET /academic/suggestions/mine/:id` | docente, docente_autorizado | Una propia; 404 si es de otro docente. |
| `GET /academic/suggestions?status=&moduleId=&guideId=&order=&deadline=` | coordinador | `status`: `pending`, `approved`, `rejected` o `all` (sin valor = todas). `order`: `asc` (por defecto) o `desc`. `deadline`: `on_time`, `due_soon` u `overdue` (solo pendientes). |
| `GET /academic/suggestions/summary` | coordinador | `{ pending, approved, rejected, dueSoon, overdue }` |
| `GET /academic/suggestions/guides` | coordinador | `[{ id, code, title, version, status, moduleId, moduleName }]` |
| `GET /academic/suggestions/:id` | coordinador | La sugerencia más `review: { currentGuideValue, moduleTeachers, teacherVersions }`. |
| `PATCH /academic/suggestions/:id/approve` | coordinador | `{ suggestion, guide, notifications: { author, newVersion } }` |
| `PATCH /academic/suggestions/:id/reject` | coordinador | Body `{ reason, feedback }`. Devuelve la sugerencia. |
| `GET /academic/notifications` | cualquier usuario con sesión | `{ unread, items: [{ id, type, severity, title, message, createdAt, read, suggestionId?, guide }] }` según el rol. |
| `PATCH /academic/notifications/:id/read` | docente, docente_autorizado | Marca una propia; 404 si no es suya. |
| `PATCH /academic/notifications/read-all` | docente, docente_autorizado | `{ updated }` |

**Sugerencia en la respuesta:** `id, code, guideId, moduleId, fieldKey, fieldLabel, teacherId, teacherName, currentValue, proposedValue, justification, neededBy, baseVersion, status, createdAt, dueSoonAt, dueAt, decidedAt, decidedById, decidedByName, rejectReason, feedback, resultingVersion`, más `deadlineStatus, businessDaysLeft, businessDaysOverdue`, más `guideCode, guideTitle, guideVersion, moduleName, competencyPrefix` y `summary` (misma lógica que `resumenCambio` del front).

`type` y `severity` de la campana: `SUGGESTION_OVERDUE`/`danger`, `SUGGESTION_DUE_SOON`/`warning`, `SUGGESTION_PENDING`/`info` (coordinador); `SUGGESTION_APPROVED`/`success`, `SUGGESTION_REJECTED`/`danger`, `GUIDE_NEW_VERSION`/`info` (docente).

## 3. Modelo de datos

- `academic_guide_suggestions`: `id`, `sequence` (único), `code` (único), `guideId`, `moduleId`, `fieldKey`, `fieldLabel`, `teacherId` (sub), `teacherName`, `currentValue` y `proposedValue` (jsonb), `justification`, `neededBy` (date), `baseVersion`, `status`, `createdAt`, `dueSoonAt`, `dueAt`, `decidedAt`, `decidedById`, `decidedByName`, `rejectReason`, `feedback`, `resultingVersion`. Índices por `status`, `guideId`, `teacherId` y el único parcial de pendientes.
- `user_notifications`: `id`, `recipientId` (sub), `type`, `title`, `message`, `guideId`, `suggestionId`, `createdAt`, `readAt`. Índice por (`recipientId`, `createdAt`).

Con `DB_SYNCHRONIZE=true` las tablas e índices se crean solos. Donde la sincronización esté apagada, hay que crear una migración equivalente.

## 4. Valores por defecto (un solo lugar)

Todos están en `gestion-guias/src/suggestions/suggestion-rules.ts` (`DEFAULT_SUGGESTION_RULES`):

| Regla | Valor | Variable de entorno |
|---|---|---|
| Día hábil de "por vencer" | 5 | `SUGGESTION_DUE_SOON_BUSINESS_DAYS` |
| Día hábil límite | 8 | `SUGGESTION_DUE_BUSINESS_DAYS` |
| Anticipación mínima de `neededBy` (días de calendario) | 14 | `SUGGESTION_MIN_NOTICE_DAYS` |
| Zona horaria de los límites de día | `America/Bogota` | — |
| Justificación mínima | 20 | — |
| Retroalimentación | 30 a 500 | — |
| `neededBy` obligatoria | sí (`neededByRequired`) | — |
| El docente autorizado también necesita la asignación del módulo | sí (`authorizedTeacherNeedsAssignment`) | — |
| Quién recibe "Nueva versión" | todos los docentes asignados al módulo, menos el autor (`newVersionRecipients: 'module-teachers'`; la otra opción es `'teachers-with-version'`) | — |

Un valor inválido en las variables detiene el arranque con un mensaje claro. HE-09-HU-01 moverá estos valores a la base para que el administrador los configure.

El front repite los números para el modo simulado y los textos en `frontend/src/app/shared/models/suggestion.ts` (`PLAZO_AVISO_DIAS_HABILES`, `PLAZO_LIMITE_DIAS_HABILES`, `ANTICIPACION_MINIMA_DIAS`, `MOTIVOS_RECHAZO`). Si se cambian en el back, hay que cambiarlos también ahí.

## 5. Frontend

- `HttpSuggestionApi` y `HttpNotificationApi` se registran en `app.config.ts` dentro de `apiAcademico === 'http'`. Tienen la misma API pública que los mocks (`SuggestionApi`, `NotificationApi`), traducen `pending/approved/rejected` a `Pendiente/Aprobada/Rechazada` y los errores con `falla()`.
- El modo simulado sigue funcionando con las mismas reglas (plazos con festivos, `neededBy` y alertas). `RELOJ` (`features/suggestions/reloj.ts`) permite fijar la fecha en las pruebas.
- «Sugerir un cambio»: campo «5. Fecha en que necesitas el cambio *», con fecha mínima hoy + 14 días y una ayuda que explica por qué. «Plazo de respuesta: 5 a 8 días hábiles».
- Bandeja y revisión: fecha requerida y estado del plazo («Vence en N días hábiles», «Por vencer · N días hábiles», «Vencida · sigue pendiente»); filtro por plazo; las vencidas se pueden aprobar o rechazar.
- Textos de Figma recuperados (sin nombres fijos): «Coordinación recibirá una notificación para revisarla. Te avisaremos cuando haya una decisión.», el bloque «Notificaciones enviadas» al aprobar y «El docente recibirá esta retroalimentación por notificación…» al rechazar.
- Campana: panel con las alertas del rol (máximo 10) y «Ver todas» (`/sugerencias` o `/mis-sugerencias`). El contador se carga al iniciar la sesión, cada 60 s (`INTERVALO_CAMPANA`) y cuando cambia `decisiones`. En el docente, abrir una alerta la marca como leída y navega. **No hay frame de Figma para el panel**: está hecho con las clases `ui-*` y falta revisarlo con diseño.

## 6. Pruebas

| Dónde | Qué cubre |
|---|---|
| `src/suggestions/business-days.spec.ts` | Pascua, los 18 festivos de 2026 (12 oct, 2 nov, 16 nov…), días hábiles, Bogotá. |
| `src/suggestions/suggestion-deadlines.spec.ts` | 30 oct 2026 → 9 nov y 12 nov; `on_time`, `due_soon`, `overdue`; mínimo de `neededBy`; variables de entorno. |
| `src/suggestions/*.service.spec.ts` | Cada código de error de HU-01 a HU-04, consecutivo, versión menor, versiones docentes intactas, `GUIDE_CHANGED` con dos docentes, vencida que se aprueba, notificaciones por tipo y destinatario, alertas por rol. |
| `test/suggestions.e2e-spec.ts` | Flujo completo con `x-test-role`, `x-test-user` y `x-test-name`, reloj fijo y el guard de roles real (403). |
| `postman/…` carpeta «08 - HE-05 Sugerencias» | 39 peticiones contra Keycloak y la API reales. Crea su propio módulo y guía, así que se puede repetir. |
| Front: `suggestion-api.spec.ts`, `notification-api.spec.ts`, `http-suggestion-api.spec.ts`, `http-notification-api.spec.ts`, `notification-bell.spec.ts` | Mock con las reglas nuevas, adaptadores HTTP y panel de la campana. |

Para Newman, ver `gestion-guias/README.md` (sección HE-05).

## 7. Pendientes por confirmar con el cliente

Se aplicó el valor por defecto; todos se cambian en `suggestion-rules.ts`.

1. **¿«5 a 8 días hábiles» es aviso a los 5 y límite a los 8, o un único límite configurable entre 5 y 8?** Se implementó aviso a los 5 (`due_soon`) y límite a los 8 (`overdue`).
2. **¿La fecha requerida es obligatoria siempre o solo para cierto tipo de cambio?** Obligatoria siempre (`neededByRequired: true`).
3. **¿Las secretarias que harán seguimiento necesitan entrar al sistema?** No se creó un rol; hoy el seguimiento lo ve coordinación (filtro «Vencidas», contadores y campana).
4. **¿El aviso de «nueva versión» llega a todos los docentes del módulo o solo a los que tienen versión personalizada de esa guía?** A todos los asignados al módulo, menos el autor (`newVersionRecipients: 'module-teachers'`).

Supuestos adicionales que conviene validar:

- El docente autorizado también necesita tener asignado el módulo para sugerir (en HE-04 puede consultar guías de cualquier módulo). Regla `authorizedTeacherNeedsAssignment`.
- `businessDaysOverdue` es al menos 1 aunque el retraso caiga en fin de semana.
- Las alertas del coordinador no tienen estado de leído (así lo pide la historia); el contador es el número de pendientes.
