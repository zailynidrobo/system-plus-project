# Verificación del frontend · HE-01 a HE-05

**Proyecto:** Intranet de guías académicas docentes · System Plus Piendamó / AthenaDev
**Fecha:** 2026-10-11
**Rama verificada:** `ramaJulia` (commit `b4f45d4`, igual a `origin/main` salvo el merge del PR #2)
**Alcance:** solo verificación. No se cambiaron pantallas, estilos ni lógica de la app.

---

## 1. Resumen

| Estado | Cantidad | HU |
|---|---|---|
| ✅ Completa | 1 | HE-01 HU-01 |
| 🟡 Parcial | 4 | HE-01 HU-02, HU-03, HU-04, HU-05 |
| ❌ Falta | 17 | Todas las de HE-02 (6), HE-03 (4), HE-04 (3) y HE-05 (4) |
| ⚠️ Difiere de Figma | 0 verificadas | Ver la nota sobre Figma |
| **Total** | **22** | |

**Hallazgos principales**

1. **El front solo implementa HE-01 (login y usuarios).** No hay rutas, componentes ni servicios de módulos, competencias, guías, espacio docente ni sugerencias en ninguna rama del repositorio:
   - `main` / `ramaJulia`: solo `features/auth` y `features/users`.
   - `develop` y `feature/formularios-dinamicos`: solo contienen el backend NestJS (`gestion-guias/`), sin carpeta `frontend/`.
   - `copilot/invite-collaborator-sofiamoreno`: el mismo front que `main`.
   - El `.zip` que hay junto al repositorio tiene el mismo contenido que `ramaJulia`.
2. **Coordinador y Docente no pueden usar la app.** Inician sesión, pero el login siempre redirige a `/usuarios` (solo Administrador) y el `roleGuard` los devuelve a `/login` sin ningún mensaje.
3. **Todo HE-01 funciona con datos simulados.** Hay dos conjuntos de mocks que no están conectados entre sí: los usuarios del login (`auth.ts`) y los del listado (`user-api.ts`). Por eso desactivar o cambiar el rol en el listado no afecta a quién puede iniciar sesión.
4. **El interceptor HTTP no envía el token.** Su implementación real quedó pegada dentro del archivo de pruebas `auth-interceptor.spec.ts`.
5. **La comparación con Figma está pendiente.** El enlace del archivo no se proporcionó (el texto decía `<PEGA AQUÍ EL ENLACE DEL ARCHIVO DE FIGMA>`). El MCP de Figma está conectado (`whoami` OK, usuario *SofiaMoreno*), pero no se hizo ninguna llamada que cuente para el límite. El código cita el Figma en `user-role.ts:14`.

---

## 2. Entorno y estado de la compilación

| Paso | Resultado |
|---|---|
| Node / npm | `v24.21.0` / `11.19.0`. Cumple Angular 21 (`^20.19 \|\| ^22.12 \|\| >=24`). |
| `npm ci` | ✅ OK (469 paquetes). npm 11.19 avisa de que no ejecutó los *install scripts* de `esbuild`, `lmdb`, `msgpackr-extract` y `@parcel/watcher` (falta `allowScripts`). No afecta a compilar, probar ni servir. |
| `npm audit` | 5 vulnerabilidades (2 críticas, 3 altas), todas en dependencias transitivas de la herramienta de compilación: `piscina`, `http-cache-semantics` y `@modelcontextprotocol/sdk`. Se arreglan con `npm audit fix`, pero **no se aplicó** porque modifica `package-lock.json`. |
| `ng build --configuration development` | ✅ OK, sin advertencias. |
| `ng build` (producción) | ✅ OK. Inicial: 396 kB (97 kB transferidos), dentro del presupuesto de 500 kB. ⚠️ 4 advertencias de presupuesto `anyComponentStyle` (máx. 4 kB): `login.scss` 4.31 kB, `user-role.scss` 4.25 kB, `user-list.scss` 4.14 kB y `user-deactivate.scss` 4.14 kB. Ninguno llega al límite de error de 8 kB. |
| `ng test --watch=false` | Antes: ❌ 3 tests y 1 archivo fallaban. Después de los cambios de la sección 7: **9/9 tests pasan**, pero sigue fallando 1 archivo (`auth-interceptor.spec.ts`, sin suite de pruebas). Está pendiente de decisión. |
| `ng serve` | ✅ Responde en `http://localhost:4200` (HTTP 200). |

No había una herramienta de navegador disponible en la sesión. Las pantallas se verificaron leyendo las plantillas y la lógica.

---

## 3. Inventario del front

### 3.1 Rutas

| Ruta | Componente | Guard / rol | HU |
|---|---|---|---|
| `/login` | `Login` | Pública | HE-01 HU-05 |
| `/` | `Shell` → redirige a `usuarios` | `authGuard` | — |
| `/usuarios` | `UserList` | `roleGuard` ADMINISTRADOR | HE-01 (listado base) |
| `/usuarios/nuevo` | `UserForm` | ADMINISTRADOR | HE-01 HU-01 |
| `/usuarios/registro-exitoso` | `UserCreated` | ADMINISTRADOR | HE-01 HU-01 (confirmación) |
| `/usuarios/:id/editar` | `UserEdit` | ADMINISTRADOR | HE-01 HU-02 |
| `/usuarios/:id/desactivar` | `UserDeactivate` | ADMINISTRADOR | HE-01 HU-03 |
| `/usuarios/:id/rol` | `UserRole` | ADMINISTRADOR | HE-01 HU-04 |
| `**` | redirige a `login` | — | — |

Fuente: `frontend/src/app/app.routes.ts:13-32`.

### 3.2 Servicios y origen de los datos

| Servicio | Mock o API | Evidencia |
|---|---|---|
| `Auth` (login/logout/rol) | **Mock** (`USE_MOCK = true`). Con `false` llamaría a `POST http://localhost:3000/api/auth/login`. | `core/auth/auth.ts:8-9`, `:27-30`, `:50-59` |
| `UserApi` (listar, resumen, crear, obtener, actualizar, desactivar, cambiarRol) | **Solo mock**, en memoria. No inyecta `HttpClient` ni tiene una opción para usar la API real. Los datos se pierden al recargar. | `features/users/user-api.ts:58-145` |
| `TokenStorage` | `localStorage` si se marca "Mantener sesión"; si no, `sessionStorage`. | `core/auth/token-storage.ts:9-16` |
| `authInterceptor` | No hace nada (solo `next(req)`). | `core/interceptors/auth-interceptor.ts:3-5` |

No existen los archivos `environments/`: la URL de la API está escrita directamente en `auth.ts:9`.

### 3.3 Usuarios de prueba (mock del login)

| Correo | Contraseña | Rol | Activo | ¿Qué pasa al entrar? |
|---|---|---|---|---|
| `admin@systemplus.edu.co` | `123456` | ADMINISTRADOR | Sí | Entra a `/usuarios`. |
| `coordinador@systemplus.edu.co` | `123456` | COORDINADOR | Sí | Vuelve a `/login` sin mensaje (ver B-02). |
| `docente@systemplus.edu.co` | `123456` | DOCENTE | Sí | Vuelve a `/login` sin mensaje (ver B-02). |
| `inactivo@systemplus.edu.co` | `123456` | DOCENTE | No | Mensaje genérico de credenciales inválidas. |

No hay un usuario de prueba con el rol DOCENTE_AUTORIZADO.

---

## 4. Verificación por historia de usuario

Leyenda de la columna Figma: "—" = sin verificar, porque falta el enlace del archivo.

### HE-01 · Usuarios, roles y permisos (Administrador)

| HU | Estado | Ruta / componente | Frame Figma | Evidencia |
|---|---|---|---|---|
| HU-01 Registrar usuario | ✅ | `/usuarios/nuevo` → `UserForm`; `/usuarios/registro-exitoso` → `UserCreated` | — | Nombre, correo y rol obligatorios (`user-form.ts:41-45`). Correo único con aviso "Este correo ya está registrado en el directorio." (`user-form.ts:95`, `user-api.ts:90-92`). No hay campo de contraseña y se informa que se genera de forma automática y no se muestra (`user-form.html:54-63`, `user-created.html:30-39`). |
| HU-02 Editar usuario | 🟡 | `/usuarios/:id/editar` → `UserEdit` | — | Edita nombre y correo, valida que el correo sea único y muestra "Cambios guardados correctamente." (`user-edit.ts:119-143`, `user-edit.html:62-66`). El listado se actualiza porque `UserApi` es un singleton. **No existe pantalla de perfil** ("Ver perfil" está deshabilitado en `user-created.html:42`). Si el administrador se edita a sí mismo, la barra superior no cambia. |
| HU-03 Desactivar usuario | 🟡 | `/usuarios/:id/desactivar` → `UserDeactivate` | — | Pide confirmación con una pantalla dedicada (`user-deactivate.html:82-88`). No borra, solo cambia `activo` (`user-api.ts:127-134`). El listado muestra "Desactivado" (`user-list.html:101-103`). **"No puede iniciar sesión"** solo se cumple con el usuario fijo `inactivo@`: desactivar desde la pantalla no afecta al login, porque son mocks distintos (`auth.ts:11-16` frente a `user-api.ts:44-56`). |
| HU-04 Asignar rol | 🟡 | `/usuarios/:id/rol` → `UserRole` | — | Ofrece los 4 roles como opción única (radio) (`user-role.ts:16-49`, `user-role.html:27-53`). Reemplaza el rol anterior (`user-api.ts:137-144`). **"Aplica sin volver a iniciar sesión"** no se cumple en el front: el rol del usuario conectado se guarda al iniciar sesión (`token-storage.ts:11-16`) y nunca se vuelve a consultar. Para llegar a la pantalla solo hay un enlace dentro de "Editar usuario" (`user-edit.html:58`). El listado no tiene acción de rol (`user-list.html:106-118`) y "Roles y permisos" del menú está deshabilitado (`shell.ts:23`). |
| HU-05 Iniciar sesión | 🟡 | `/login` → `Login` | — | Entra con correo y contraseña. El mensaje de error es genérico y no dice qué dato falló (`login.ts:67-71`, `login.html:43-50`). La sesión persiste con "Mantener sesión iniciada", marcado por defecto (`login.ts:22`, `token-storage.ts:11-16`). **Solo funciona para Administrador** (ver B-02). Si ya hay sesión, `/login` no redirige a la app. |

### HE-02 · Programa académico: módulos y competencias (Coordinador)

| HU | Estado | Evidencia |
|---|---|---|
| HU-01 Registrar módulo | ❌ | No hay ruta, componente ni servicio. `app.routes.ts` solo define rutas de usuarios. |
| HU-02 Editar módulo | ❌ | Ídem. |
| HU-03 Inhabilitar módulo | ❌ | Ídem. |
| HU-04 Asociar competencia | ❌ | Ídem. |
| HU-05 Editar competencia | ❌ | Ídem. |
| HU-06 Eliminar competencia | ❌ | Ídem. |

### HE-03 · Guías base institucionales (Coordinador)

| HU | Estado | Evidencia |
|---|---|---|
| HU-01 Crear guía base | ❌ | Sin implementar en el front. |
| HU-02 Editar guía en Borrador | ❌ | Sin implementar. |
| HU-03 Publicar guía | ❌ | Sin implementar. |
| HU-04 Configurar campos del formulario | ❌ | Sin implementar. La rama `feature/formularios-dinamicos` tiene esto solo en el backend (`PUT /academic/modules/:moduleId/guide-fields`). |

### HE-04 · Espacio del docente (Docente)

| HU | Estado | Evidencia |
|---|---|---|
| HU-01 Consultar guías base | ❌ | Sin implementar. Además, el Docente no puede pasar del login (B-02). |
| HU-02 Crear versión personalizada | ❌ | Sin implementar. |
| HU-03 Editar versión personalizada | ❌ | Sin implementar. |

### HE-05 · Sugerencias y aprobación

| HU | Estado | Evidencia |
|---|---|---|
| HU-01 Enviar sugerencia (Docente) | ❌ | Sin implementar en el front ni en el backend (no hay ningún archivo `suggest*` en ninguna rama). |
| HU-02 Revisar pendientes (Coordinador) | ❌ | Ídem. |
| HU-03 Aprobar sugerencia | ❌ | Ídem. |
| HU-04 Rechazar sugerencia | ❌ | Ídem. |

---

## 5. Detalle de brechas y sugerencias

Ordenadas por prioridad: primero lo que bloquea criterios de aceptación.

### Bloqueantes

**B-01 · No existe el front de HE-02 a HE-05 (17 HU).**
Sugerencia: crear `features/academic-program/` (módulos y competencias), `features/guides/` (guías base y configuración de campos), `features/teacher-space/` (consulta y versiones personalizadas) y `features/suggestions/`. Seguir el patrón de `features/users`: un servicio `*-api.ts`, una pantalla por acción y `roleGuard` con `data: { roles: [...] }`.

**B-02 · Coordinador y Docente no pueden entrar a la app.**
- `login.ts:66` siempre navega a `/usuarios`.
- `app.routes.ts:28` redirige `''` a `usuarios`.
- `role-guard.ts:13` manda a `/login` a quien no tiene el rol, y la sesión queda guardada.

Resultado: el usuario vuelve a la pantalla de login sin ninguna explicación.
Sugerencia: redirigir según el rol después del login (p. ej. Coordinador → `/modulos`, Docente → `/mis-guias`), crear una página "Sin acceso" (el propio código lo deja pendiente en `role-guard.ts:12`) y, en `/login`, redirigir a quien ya tiene sesión.

**B-03 · El menú lateral no depende del rol.**
`shell.ts:20-25` define siempre el bloque "ADMINISTRACIÓN" (Inicio, Usuarios, Roles y permisos, Auditoría), y la miga de pan dice siempre "Gestión de usuarios" (`shell.html:36`).
Sugerencia: armar `nav` con un `computed` que dependa de `auth.user().rol` y tomar la miga de pan de `route.data`.

**B-04 · HE-01 HU-03 y HU-04 no se cumplen de punta a punta.**
Los mocks del login y del listado están separados: desactivar no impide iniciar sesión y cambiar el rol no afecta a la sesión.
Sugerencia: con el backend real, hacer que el login rechace a los inactivos y que el front vuelva a consultar el usuario actual (`GET /me` o similar) al navegar o con un intervalo, para aplicar el rol sin cerrar sesión. Mientras se use el mock, que `Auth` y `UserApi` compartan la misma fuente de datos.

**B-05 · El token no se envía al backend.**
`core/interceptors/auth-interceptor.ts:3-5` está vacío. La implementación correcta (agregar `Authorization: Bearer <token>`) está en `core/interceptors/auth-interceptor.spec.ts:1-9`, que por eso falla como "No test suite found".
Sugerencia: mover ese código a `auth-interceptor.ts` y escribir una prueba real en el `.spec`.

### Importantes

**I-01 · `UserApi` no tiene modo API.**
Para conectar el backend hay que reescribir los métodos con `HttpClient`. No basta con cambiar `USE_MOCK`.

**I-02 · No hay pantalla de perfil.**
HU-02 pide que el cambio se refleje en el perfil. Hay que crear `/perfil` o `/usuarios/:id` y habilitar "Ver perfil" (`user-created.html:42`).

**I-03 · Acceso a "Asignar rol".**
Agregar la acción en la tabla del listado (`user-list.html:106-118`) o habilitar "Roles y permisos" en el menú, según lo que muestre Figma.

**I-04 · Permisos provisionales.**
Los permisos de Administrador, Docente y Docente Autorizado en `user-role.ts:14-15` están marcados como provisionales. Confirmarlos con el equipo y con Figma.

**I-05 · No hay usuario de prueba DOCENTE_AUTORIZADO.**
Agregar uno en `auth.ts:11-16` para poder probar ese rol.

### Menores

- "Guardar borrador" aparece deshabilitado en el registro (`user-form.html:74-76`). No está en los criterios de aceptación; confirmar con Figma si debe existir.
- La pantalla de desactivar dice "La cuenta podrá reactivarse posteriormente" (`user-deactivate.html:70`), pero el front no tiene opción para reactivar.
- El texto del registro dice "La usuaria deberá renovarla al ingresar" (`user-form.html:60`), en femenino fijo. Mejor algo neutro, como "La persona usuaria…".
- Presupuestos de estilos excedidos por pocos bytes en 4 componentes (sección 2).

---

## 6. Figma: pantallas sin implementar o fuera de Figma

**No se pudo hacer el inventario** porque falta el enlace del archivo de Figma. Llamadas usadas: 1 (`whoami`, que no cuenta para el límite).

Cuando se tenga el enlace, el plan es: 1 `get_metadata` para listar páginas y frames, unos 22–30 `get_screenshot` (un frame por HU y los estados de error, éxito o modal) y `get_design_context` solo si hay dudas puntuales. En total, menos de 40 llamadas.

**Pantallas implementadas que habrá que comprobar contra Figma:**
- Login.
- Listado de usuarios, con tarjetas de resumen, filtros y paginación.
- Registrar usuario (paso 1) y Registro completado (paso 2).
- Editar usuario.
- Desactivar usuario: confirmación en una página completa, no en un modal. Revisar cuál de las dos opciones muestra Figma.
- Asignar rol.

**Elementos del menú sin pantalla:** "Inicio", "Roles y permisos", "Auditoría" y "Centro de ayuda". También "¿Olvidaste tu contraseña?" y "¿Necesitas ayuda?" en el login.

---

## 7. Errores encontrados y correcciones aplicadas

Todos los cambios están sin confirmar (sin commit) y solo afectan a archivos de pruebas.

| Archivo | Problema | Cambio |
|---|---|---|
| `frontend/src/app/features/users/user-list/user-list.spec.ts` | `NG0201: No provider found for ActivatedRoute`. El componente usa `RouterLink` y el test no daba un router. | Se agregó `import { provideRouter }` y `providers: [provideRouter([])]`. |
| `frontend/src/app/features/users/user-form/user-form.spec.ts` | El mismo error `NG0201`. | El mismo cambio. |
| `frontend/src/app/app.spec.ts` | La prueba heredada del andamiaje de Angular buscaba un `<h1>` con "Hello, frontend". Ese texto ya no existe: `app.html` ahora es solo `<router-outlet />`. | La prueba ahora se llama "should render the router outlet" y comprueba que existe `router-outlet`. |
| `frontend/src/app/core/interceptors/auth-interceptor.spec.ts` | "No test suite found". El archivo contiene la implementación del interceptor en lugar de pruebas (B-05). | **Sin cambios.** Corregirlo cambia el comportamiento de la app y borraría la única copia de ese código. Queda pendiente de decisión. |

No hubo errores de compilación ni de arranque. No se modificaron `package.json` ni `package-lock.json`.

---

## 8. Observaciones de integración con el backend

Solo se reportan; no se cambió nada. Fuente: ramas `origin/develop` y `origin/feature/formularios-dinamicos`, proyecto `gestion-guias/`.

### 8.1 Endpoints que espera el front

| Uso | Endpoint esperado | Estado en el backend |
|---|---|---|
| Login | `POST http://localhost:3000/api/auth/login` → `{ token, usuario }` | **No existe.** El backend autentica con Keycloak (`src/auth/keycloak.strategy.ts`). |
| Usuarios (CRUD) | Hoy ninguno: `UserApi` es solo mock. | El backend expone `POST/GET /users`, `GET/PATCH /users/:id`, `PATCH /users/:id/deactivate` y `PATCH /users/:id/role`, con `@Roles('admin')`. |

### 8.2 Diferencias conocidas

1. **Autenticación.** El backend usa Keycloak (Bearer JWT de Keycloak). El front tiene su propio login simulado contra `/api/auth/login`. Hay que decidir si el front usa el flujo de Keycloak (p. ej. `keycloak-angular` o OIDC) o si el backend expone un endpoint de login que haga de intermediario con Keycloak.
2. **Roles.** Backend: `admin`, `coordinador`, `docente`, `docente_autorizado` (`users/entities/user.entity.ts`). Front: `ADMINISTRADOR`, `COORDINADOR`, `DOCENTE`, `DOCENTE_AUTORIZADO` (`shared/models/user.ts:1-5`). Además, `ADMINISTRADOR` frente a `admin` no es solo un cambio de mayúsculas.
3. **Nombres de campos.** Backend: `id: string`, `name`, `email`, `role`, `isActive`. Front: `id: number`, `nombre`, `correo`, `rol`, `activo`. Hace falta un adaptador o unificar los nombres.
4. **Contraseña en el registro.** El `CreateUserDto` del backend **exige `password` (mínimo 8 caracteres)**. Esto contradice HE-01 HU-01, donde la contraseña la genera el sistema y el administrador no la escribe. `UpdateUserDto` también acepta `password`.
5. **Prefijo y CORS.** El backend escucha en el puerto `3000` sin `setGlobalPrefix('api')` y sin `enableCors()` (`src/main.ts`). El front apunta a `http://localhost:3000/api` desde `localhost:4200`, así que las peticiones fallarían por ruta y por CORS. Alternativa: un `proxy.conf.json` en Angular.
6. **HE-02.** El backend expone `GET /programs`, `GET /programs/:programId`, `POST/GET /programs/:programId/modules`, `GET /programs/:programId/modules/name-availability`, `GET/PATCH /modules/:moduleId`, `PATCH /modules/:moduleId/{register,deactivate,reactivate}`, `POST/GET /modules/:moduleId/competencies`, `GET /modules/:moduleId/competencies/next-code`, `GET/PATCH/DELETE /competencies/:competencyId` y `GET /competencies/:competencyId/{history,versions/:version}`. También hay un módulo paralelo `/academic/*` (`/academic/modules`, `/academic/competencies`…) que se superpone con el anterior: hay que confirmar con el equipo de backend cuál es el oficial.
7. **HE-03 / HE-04** (`/academic`, más completo en `feature/formularios-dinamicos`): `POST/GET /academic/guides`, `GET/PATCH /academic/guides/:id`, `PATCH /academic/guides/:id/publish`, `GET /academic/guides/:id/export`, `PUT /academic/modules/:moduleId/guide-fields`, `PUT /academic/modules/:moduleId/teacher-guide-fields`, `PUT/DELETE /academic/modules/:moduleId/teachers/:teacherId`, `POST /academic/guides/:guideId/personalized-versions`, `GET /academic/personalized-versions`, `GET/PATCH /academic/personalized-versions/:id` y `GET /academic/personalized-versions/:id/export`.
8. **HE-05:** no hay endpoints de sugerencias en ninguna rama del backend.
