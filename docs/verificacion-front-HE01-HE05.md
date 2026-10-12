# Verificación del frontend · HE-01 a HE-05

**Proyecto:** Intranet de guías académicas docentes · System Plus Piendamó / AthenaDev
**Fecha:** 2026-10-12 (actualiza la verificación del 2026-10-11)
**Rama:** `feature/front-he02-he05`, creada desde `ramaJulia` (commit `b4f45d4`)
**Alcance:** implementación de HE-02 a HE-05 y ajustes de HE-01 en el front, con datos simulados. No se modificó el backend.

---

## 1. Resumen

| Estado | Antes (11 oct) | Ahora | HU |
|---|---|---|---|
| ✅ Completa | 1 | **21** | HE-01 HU-01, HU-03, HU-04, HU-05 · HE-02 (6) · HE-03 (4) · HE-04 (3) · HE-05 (4) |
| 🟡 Parcial | 4 | **1** | HE-01 HU-02 (no hay pantalla de perfil; tampoco está en Figma) |
| ❌ Falta | 17 | **0** | — |
| **Total** | 22 | 22 | |

"Completa" significa que los criterios de aceptación se cumplen **en el front, contra el mock en memoria**. La integración con el backend real está pendiente (sección 8).

**Qué cambió**

1. **Las 22 HU tienen pantalla, servicio y pruebas.** Las épicas comparten una sola base en memoria (`core/mock/mock-db.ts`), así que los datos son coherentes entre ellas. Por ejemplo:
   - la guía que publica la coordinadora aparece en el espacio del docente;
   - la sugerencia que aprueba sube la versión de esa guía.
2. **Cada rol entra a su inicio:**
   - Administrador → `/usuarios`;
   - Coordinador → `/modulos`;
   - Docente y Docente Autorizado → `/mis-modulos`.

   El menú y la miga de pan dependen del rol. Una ruta de otro rol lleva a «Sin acceso» y no al login.
3. **El login y el listado de usuarios usan los mismos datos.** Desactivar a un usuario le impide entrar. Un cambio de rol se aplica en la siguiente navegación, porque `authGuard` vuelve a consultar al usuario.
4. **El interceptor envía `Authorization: Bearer <token>`** y su `.spec` tiene pruebas reales.
5. **La autenticación es intercambiable:**
   - el contrato es `AuthProvider` y el único punto de cambio es `provideAuth()`;
   - hoy se usa `MockAuthProvider`;
   - `role-mapping.ts` traduce los roles de Keycloak y tiene pruebas.
6. **Figma:** se usaron unas 40 llamadas (`get_design_context`, `get_screenshot` y `get_metadata`) sobre los frames de cada HU. Las diferencias aceptadas están en la sección 6.

---

## 2. Entorno y estado de la compilación

| Paso | Resultado |
|---|---|
| Node / npm | `v24.21.0` / `11.19.0` |
| `npm ci` | ✅ Sin cambios en `package.json` ni en `package-lock.json`. No se agregaron dependencias. |
| `ng build --configuration development` | ✅ OK |
| `ng build` (producción) | ✅ OK. *Bundle* inicial de **423 kB** (111 kB transferidos), por debajo de los 500 kB del presupuesto. Todas las pantallas se cargan solo al abrirlas (`loadComponent`). Quedan las mismas 4 advertencias `anyComponentStyle` de HE-01, entre 4.14 y 4.31 kB, por debajo del límite de error de 8 kB. Ningún `.scss` nuevo supera 4 kB. |
| `ng test --watch=false` | ✅ **150 pruebas en 22 archivos, todas pasan.** |
| `ng serve` | ✅ `http://localhost:4200` |

**Pruebas nuevas:**
- `user-api`, `module-api`, `competency-api`, `guide-api`, `field-config-api`, `teacher-api` y `suggestion-api`;
- `auth`, `token-storage`, `role-mapping` y `auth-interceptor`;
- `dynamic-form` y `version-edit` (autoguardado);
- `nav` y `app.routes` (redirección y acceso por rol).

No hubo una herramienta de navegador en la sesión. La comparación visual con Figma se hizo leyendo el código frente a las capturas de cada frame (ver sección 6.3).

---

## 3. Inventario

### 3.1 Rutas

La tabla completa está en `frontend/GUIA-EJECUCION.md`, sección 7. Fuente: `frontend/src/app/app.routes.ts`.

| Épica | Rutas | Rol |
|---|---|---|
| HE-01 | `/usuarios…`, `/roles`, `/roles/:id` | Administrador |
| HE-02 | `/modulos…`, `/modulos/:id/competencias/…` | Coordinador |
| HE-03 | `/guias`, `/guias/nueva`, `/guias/:id`, `/guias/:id/editar`, `/guias/estructura` | Coordinador |
| HE-04 | `/mis-modulos`, `/mis-modulos/guias/:id`, `/mis-versiones`, `/mis-versiones/:id` | Docente, Docente Autorizado |
| HE-05 | `/mis-modulos/guias/:id/sugerir`, `/mis-sugerencias`, `/mis-sugerencias/:id` | Docente, Docente Autorizado |
| HE-05 | `/sugerencias`, `/sugerencias/:id` | Coordinador |
| Común | `/login` (`guestGuard`), `/sin-acceso`, `''` → inicio del rol, `**` → `''` | — |

### 3.2 Servicios

Todos los servicios devuelven `Observable`, simulan latencia (`MOCK_LATENCY`, 350 ms; 0 en pruebas), entregan copias (`structuredClone`) y fallan con `ApiError(code)`.

| Servicio | Métodos | Endpoint del backend que imita |
|---|---|---|
| `Auth` + `MockAuthProvider` | `login`, `refrescar`, `token`, `logout`, `hasRole` | (Keycloak, ver 8.1) |
| `UserApi` | `listar`, `resumen`, `conteoPorRol`, `correoDisponible`, `crear`, `obtener`, `historial`, `actualizar`, `desactivar`, `cambiarRol` | `/users` |
| `ModuleApi` | `listar`, `resumen`, `obtener`, `disponibilidadNombre`, `disponiblesParaGuias`, `crear`, `actualizar`, `registrar`, `inhabilitar`, `rehabilitar` | `/programs/:id/modules`, `/modules/:id/*` |
| `CompetencyApi` | `listar`, `siguienteCodigo`, `obtener`, `historial`, `guiasPublicadas`, `crear`, `actualizar`, `eliminar` | `/modules/:id/competencies`, `/competencies/:id` |
| `FieldConfigApi` | `obtener`, `impacto`, `guardar` | `PUT /academic/modules/:id/guide-fields` |
| `GuideApi` | `listar`, `resumen`, `obtener`, `historial`, `siguienteCodigo`, `docentesDelModulo`, `crear`, `actualizar`, `publicar` | `/academic/guides` |
| `TeacherApi` | `misModulos`, `guiasAsignadas`, `obtenerGuia`, `crearVersion`, `misVersiones`, `obtenerVersion`, `aislamiento`, `guardarCampo` | `/academic/guides/:id/personalized-versions`, `/academic/personalized-versions` |
| `SuggestionApi` | `enviar`, `misSugerencias`, `obtenerMia`, `listar`, `resumen`, `guiasConSugerencias`, `obtener`, `aprobar`, `rechazar` | **No existe** (contrato propuesto en 8.5) |

### 3.3 Usuarios de prueba

La contraseña de todos es `123456`.

| Correo | Nombre | Rol | Inicio |
|---|---|---|---|
| `admin@example.com` | Diana Marcela Ruiz | Administrador | `/usuarios` |
| `coordinador@example.com` | Laura Muñoz | Coordinador Académico | `/modulos` |
| `docente@example.com` | Julián Andrés Ospina | Docente (POO y Bases de Datos) | `/mis-modulos` |
| `autorizado@example.com` | Paola Valencia | Docente Autorizado (POO y Redes) | `/mis-modulos` |
| `inactivo@example.com` | Carlos Ramírez | Docente desactivado | No entra |

---

## 4. Verificación por historia de usuario

### HE-01 · Usuarios, roles y permisos (Administrador)

| HU | Estado | Pantallas | Evidencia |
|---|---|---|---|
| HU-01 Registrar usuario | ✅ | `/usuarios/nuevo`, `/usuarios/registro-exitoso` | El correo debe ser único y se verifica mientras se escribe, con el aviso «Correo disponible. Debe ser único…». La contraseña la genera el sistema. |
| HU-02 Editar usuario | 🟡 | `/usuarios/:id/editar` | Subtítulo con código y fecha de creación, «Historial reciente», correo único. El cambio se ve en el listado y, si el administrador se edita a sí mismo, en el encabezado. **Falta la pantalla de perfil:** «Ver perfil» sigue deshabilitado y no hay frame en Figma. |
| HU-03 Desactivar usuario | ✅ | `/usuarios/:id/desactivar` | Desactivación lógica y confirmada. El usuario desactivado no puede iniciar sesión, y si tenía sesión abierta la pierde en su siguiente navegación (`authGuard` → `refrescar`). |
| HU-04 Asignar rol | ✅ | `/roles` → `/roles/:id` | Se llega desde «Roles y permisos», como en Figma (`/usuarios/:id/rol` redirige). Un solo rol, que reemplaza al anterior. Se aplica sin volver a iniciar sesión (prueba en `app.routes.spec.ts`). |
| HU-05 Iniciar sesión | ✅ | `/login` | El error es genérico. «Mantener sesión» usa `localStorage`; sin marcarla se usa `sessionStorage`. Cada rol entra a su inicio y `/login` con sesión redirige al inicio del rol. |

### HE-02 · Programa académico (Coordinador)

| HU | Estado | Pantallas | Frame | Evidencia |
|---|---|---|---|---|
| HU-01 Registrar módulo | ✅ | `/modulos/nuevo` | 204:3942, 204:3823, 204:3716 | Código `TS-MOD-NN` y sigla de competencias generados (`buildCompetencyPrefix`). El nombre duplicado se detecta sin distinguir mayúsculas. Tiene borrador y registro. |
| HU-02 Editar módulo | ✅ | `/modulos/:id/editar` | 204:3587 | Nombre único, cambios con trazabilidad y sigla que no se repite (`ensureUniquePrefix`). |
| HU-03 Inhabilitar módulo | ✅ | `/modulos/:id/inhabilitar` | 204:3450 | Inhabilitación lógica con efectos visibles. Un módulo inhabilitado no admite guías nuevas. Se puede rehabilitar. |
| HU-04 Asociar competencia | ✅ | `/modulos/:id/competencias/nueva` | 204:3143 | Código `COMP-<SIGLA>-NN` consecutivo, sin duplicados y solo en módulos activos. |
| HU-05 Editar competencia | ✅ | `…/competencias/:id/editar` | 204:3021 | Guarda la versión anterior en el historial. Las guías publicadas conservan el texto con el que se publicaron. |
| HU-06 Eliminar competencia | ✅ | `…/competencias/:id/eliminar` | 204:2892 | Eliminación lógica. Avisa cuántas guías publicadas la usan y deja de ofrecerse para guías nuevas. |

Listado y detalle: PanelCoordinador (204:4077) y Competencias (204:3269).

### HE-03 · Guías base institucionales (Coordinador)

| HU | Estado | Pantallas | Frame | Evidencia |
|---|---|---|---|---|
| HU-01 Crear guía base | ✅ | `/guias/nueva` | 2027:507, 2027:792 | El formulario se genera desde la estructura vigente del módulo. Código `GB-<SIGLA>-NN`. Queda en Borrador. Solo se ofrecen módulos activos con competencias. |
| HU-02 Editar guía en Borrador | ✅ | `/guias/:id/editar` | 2027:959 | Solo en Borrador (`GUIDE_NOT_EDITABLE`). Marca los campos modificados y registra eventos en el historial. |
| HU-03 Publicar guía | ✅ | Modal desde la edición | 2027:1373, 2027:1176 | Exige los campos obligatorios (`REQUIRED_FIELDS_MISSING`). Queda en `v1.0` con fecha y responsable. Una guía publicada no se edita directamente. |
| HU-04 Configurar campos | ✅ | `/guias/estructura` | 2027:1559, 2027:1915 | Agregar, editar, reordenar (arrastre o teclado) y eliminar campos, con vista previa. Cada cambio crea una versión de estructura. Los borradores adoptan la nueva; las guías publicadas conservan la suya. |

Listado: 2025:26.

### HE-04 · Espacio del docente

| HU | Estado | Pantallas | Frame | Evidencia |
|---|---|---|---|---|
| HU-01 Consultar guías base | ✅ | `/mis-modulos`, `/mis-modulos/guias/:id` | 4002:26, 4002:328 | Solo guías **publicadas** de módulos **asignados**. Las demás se cuentan, pero no se muestran. Abrir una guía de otro módulo responde `GUIDE_NOT_ASSIGNED`. Solo lectura con «Documento institucional · solo lectura». |
| HU-02 Crear versión personalizada | ✅ | Modal «Crear mi versión» | 4002:738, 4002:842 | Copia física (`structuredClone`) del contenido y la estructura. El nombre es único por docente. Las pruebas comprueban que no comparte referencias con la guía ni con otras versiones y que cada docente ve y abre solo las suyas. |
| HU-03 Editar versión personalizada | ✅ | `/mis-versiones/:id` | 4002:1110 | Edición campo por campo. Autoguardado 1 s después de la última tecla, más «Guardar campo» y «Descartar». Marca «Adaptado» y muestra el progreso. Los campos con `teacherEditable: false` quedan bloqueados. La guía base nunca cambia. |

### HE-05 · Sugerencias y aprobación

| HU | Estado | Pantallas | Frame | Evidencia |
|---|---|---|---|---|
| HU-01 Enviar sugerencia (Docente) | ✅ | `/mis-modulos/guias/:id/sugerir`, `/mis-sugerencias/:id` | 5003:26, 5003:322 | Un campo por sugerencia, con contenido actual, cambio propuesto y justificación. Queda **Pendiente** con código `SUG-NNN` y plazo de 5 días hábiles. No admite un cambio vacío ni igual al actual, ni dos pendientes propias sobre el mismo campo. |
| HU-02 Revisar pendientes (Coordinador) | ✅ | `/sugerencias` | 5003:514 | Pestañas por estado con contadores, filtro por guía (de cualquier módulo), orden y plazo restante. El menú muestra el número de pendientes. |
| HU-03 Aprobar sugerencia | ✅ | `/sugerencias/:id` | 5003:831 | Previa confirmación, reemplaza el campo en la guía, sube la versión menor (v1.0 → v1.1), actualiza la fecha y registra el evento en el historial. No toca las versiones docentes. Se bloquea si el campo cambió desde que se envió (`GUIDE_CHANGED`). |
| HU-04 Rechazar con retroalimentación | ✅ | Modal de rechazo | 5003:1054 | Pide motivo (lista) y retroalimentación de 30 a 500 caracteres. La guía no cambia y el docente ve el motivo en «Mis sugerencias». |

---

## 5. Brechas de la verificación anterior

| Id | Situación |
|---|---|
| B-01 No existía el front de HE-02 a HE-05 | ✅ Resuelta (sección 4). |
| B-02 Coordinador y Docente volvían al login | ✅ Resuelta: inicio por rol (`role-home.ts`), página «Sin acceso» y `guestGuard` en `/login`. |
| B-03 Menú fijo de Administración | ✅ Resuelta: `shell/nav.ts` por rol, recuadro de programa o de módulos asignados, y miga de pan desde `route.data`. |
| B-04 Mocks separados del login y del listado | ✅ Resuelta en el mock (`MockDb` compartida + `refrescar`). Con el backend hará falta `GET /users/me` (8.5). |
| B-05 El interceptor no enviaba el token | ✅ Resuelta, con pruebas. |
| I-01 `UserApi` sin modo API | ⏳ Sigue pendiente, igual que el resto de servicios (8.6). |
| I-02 No hay pantalla de perfil | ⏳ Pendiente. No hay frame en Figma; «Ver perfil» queda deshabilitado. |
| I-03 Acceso a «Asignar rol» | ✅ Desde «Roles y permisos», como en Figma. |
| I-04 Permisos provisionales | ✅ Los textos de permisos salen de Figma. |
| I-05 Sin usuario Docente Autorizado | ✅ `autorizado@` (Paola Valencia). |

**Menores que siguen abiertos (HE-01):**
- «Guardar borrador» deshabilitado en el registro de usuario.
- El texto de desactivar dice que la cuenta «podrá reactivarse», pero no hay opción para hacerlo.
- El texto del registro sigue con «La usuaria deberá renovarla…».
- Las 4 advertencias de presupuesto de estilos.

---

## 6. Figma

### 6.1 Archivos usados

- HE-01: PanelDeAdministrador.
- HE-02: PanelCoordinador.
- HE-03: Guías base.
- HE-04: fileKey `xXoKUjpJJATuJIjjNKZFyo`.
- HE-05: fileKey `Znjy3CEcKLrbgXeQfiEguh`.

Los frames de cada HU están en la sección 4 y en un comentario al inicio de cada componente.

### 6.2 Diferencias aceptadas con Figma

**General**
- Los contadores muestran datos reales del mock. Por ejemplo, «Aprobadas 1» en lugar del 9 de Figma, y «3 guías publicadas de otros módulos» en lugar de 5.
- Se mantiene el menú de HE-02 en todas las pantallas del coordinador, aunque algunos frames de HE-03 muestran otros íconos.
- No se afirma que se envían notificaciones, porque no existen:
  - «Notificaciones enviadas» se cambió por «Quién verá el cambio»;
  - «Laura Muñoz recibirá una notificación…» se cambió por «Coordinación la verá en su bandeja».

**HE-02**
- Inhabilitar módulo y eliminar competencia son pantallas completas (como en Figma), con un motivo opcional agregado.
- Siglas según la regla del backend: `RC` y `ME`, en lugar de `RED` y `MTO`.
- «Seguridad informática y soporte» es `TS-MOD-06`.

**HE-03**
- La competencia es obligatoria al crear una guía.
- Los tipos «Opción múltiple» y «Archivo» no se ofrecen porque el backend no los tiene.
- El mensaje de publicación dice que los docentes «ya pueden consultarla».

**HE-04**
- «Intensidad horaria» no es editable por el docente (`teacherEditable: false` en la estructura); Figma muestra un lápiz.
- «Metodología» es una lista desplegable en la estructura de HE-03; Figma de HE-04 la muestra como texto libre.
- Un docente puede tener varias versiones de una guía, como en la tabla de Figma. La guía ofrece «Continuar mi versión» y «Crear otra versión».
- El ojo de la tabla «Mis versiones» abre la guía base de origen.
- Además de «Guardar campo», hay autoguardado 1 s después de escribir.

**HE-05**
- «3. Cambio propuesto» es el contenido completo que tendrá el campo. Viene precargado con el texto actual para editar sobre él, y lo agregado se resalta en la revisión.
- La columna «Propuesta» es un resumen calculado («Agrega «…»» o «Cambia a «…»»).
- En campos de lista solo se pueden proponer opciones existentes. El ejemplo de Figma «Ampliar de 40 a 48 horas» no es posible con la estructura actual.
- Aprobar pide confirmación, que no aparece en Figma.
- Al rechazar se vuelve a la bandeja con un aviso: Figma no tiene frame del resultado.

### 6.3 Pantallas que hay que revisar en el navegador

No hubo un navegador para comparar. Conviene revisar a 1440 px y 1280 px, en este orden:

1. Las pantallas **sin frame**, que siguen el estilo de las vecinas:
   - `/roles` (lista de Roles y permisos);
   - `/guias/:id` (guía publicada para el coordinador);
   - `/mis-sugerencias` (listado del docente);
   - los estados «aprobada» y «rechazada» de `/mis-sugerencias/:id`;
   - la revisión de una sugerencia ya decidida.
2. Las de **más densidad**:
   - el editor de versión (`/mis-versiones/:id`) con un campo abierto;
   - la revisión de sugerencia (las dos columnas pasan a una sola por debajo de 1280 px);
   - `/guias/estructura`.
3. **Sugerir cambio**: la lista de campos y el detalle pasan a una sola columna por debajo de 1280 px.

---

## 7. Cambios a pruebas heredadas (verificación del 11 oct)

Los arreglos de `user-list.spec.ts`, `user-form.spec.ts` y `app.spec.ts` están en el commit `8f79fa7`. `auth-interceptor.spec.ts` ya tiene pruebas reales: verifica que se agrega el encabezado con sesión y que no se agrega sin ella.

---

## 8. Pendiente para conectar el backend real

### 8.1 Decisión de autenticación: Keycloak o login propio

El backend (`gestion-guias`) valida JWT de Keycloak (`src/auth/keycloak.strategy.ts`) y no tiene `POST /auth/login`. **Recomendación:** usar Keycloak directamente desde el front, con el flujo *Authorization Code + PKCE*. Un login propio que reenvíe usuario y contraseña a Keycloak (*password grant*) está desaconsejado en OAuth 2.1.

**Pasos para integrar Keycloak** (el front ya está preparado):

1. **Cliente en Keycloak.** Crear un cliente **público** (sin secreto), por ejemplo `athenadev-frontend`:
   - *Standard flow* activado; *Direct access grants* desactivado;
   - **PKCE `S256`** obligatorio;
   - *Valid redirect URIs*: `http://localhost:4200/*`; *Web origins*: `http://localhost:4200`;
   - roles de realm `admin`, `coordinador`, `docente`, `docente_autorizado`, asignados a cada usuario.
2. **Librería.** Instalar `keycloak-angular` (usa `keycloak-js`). Una alternativa es `keycloak-js` sola con un servicio propio. Es un cambio de `package.json` que debe aprobar el equipo.
3. **Implementación.** Crear `core/auth/providers/keycloak-auth-provider.ts` que implemente `AuthProvider`:
   - `restaurarSesion()`: `keycloak.init({ onLoad: 'check-sso', pkceMethod: 'S256', silentCheckSsoRedirectUri: origin + '/silent-check-sso.html' })`.
   - `login()`: `keycloak.login({ redirectUri })`. El formulario lo muestra Keycloak (ver el paso 7).
   - `refrescar()`: `keycloak.updateToken(30)` y luego `GET /users/me`, para obtener nombre, estado y rol actualizados. Esto mantiene HE-01-HU-03 y HU-04: desactivación y cambio de rol sin cerrar sesión.
   - `token()`: `keycloak.token`.
   - `logout()`: `keycloak.logout({ redirectUri: origin + '/login' })`, que cierra también la sesión SSO.
   - El rol sale de `mapKeycloakRoles(keycloak.tokenParsed.realm_access.roles)`, en `core/auth/role-mapping.ts`, que ya tiene pruebas. Si los roles se definen por cliente, se leen de `resource_access['athenadev-frontend'].roles`.
4. **Activación.** En `core/auth/provide-auth.ts`, cambiar la fábrica de `AUTH_PROVIDER` por `inject(KeycloakAuthProvider)`. Es el único cambio necesario: `Auth`, los guards, el `Shell` y las pantallas no cambian.
5. **Token en las peticiones.** `core/interceptors/auth-interceptor.ts` ya agrega `Authorization: Bearer <token>` desde `Auth.token()`. Falta asegurar que el token esté vigente: llamar a `updateToken(30)` antes de cada petición o usar el `includeBearerTokenInterceptor` de `keycloak-angular`, configurado solo para la URL de la API.
6. **Cerrar sesión.** `Shell.salir()` ya llama a `auth.logout()` y navega a `/login`. Con Keycloak, la navegación la hace `keycloak.logout`.
7. **Pantalla de login de Figma como tema de Keycloak.** Con PKCE, la pantalla de login es la de Keycloak, así que el diseño de Figma se lleva a un **tema propio** `athenadev`:
   - Ubicación: `themes/athenadev/login/`, con `theme.properties` (`parent=keycloak.v2`, `import=common/keycloak`), `resources/css/login.css` y, si hace falta, `login.ftl`.
   - Correspondencia con Figma:
     - panel lateral morado con «System Plus Piendamó», logo «A+» y textos institucionales → plantilla y CSS;
     - «Mantener sesión iniciada» → *Remember me* del realm;
     - «¿Olvidaste tu contraseña?» → *Forgot password* (requiere SMTP);
     - el mensaje de error genérico → `invalidUserMessage` en `messages_es.properties`.
   - Se activa en *Realm settings → Themes → Login theme*.
   - Las imágenes y los colores salen de los tokens de `src/styles.scss`. La ruta `/login` del front queda solo como entrada que llama a `keycloak.login()`.

### 8.2 Adaptador de datos y roles

- **Usuario.** El backend usa `id: string`, `name`, `email`, `role` (`admin`, `coordinador`, `docente`, `docente_autorizado`) e `isActive`. El front usa `id: number`, `nombre`, `correo`, `rol` (`ADMINISTRADOR`…) y `activo`.
  - Hace falta un `user-adapter.ts` con `desdeApi` y `haciaApi`.
  - `role-mapping.ts` ya tiene `mapKeycloakRole` y `toBackendRole` para los roles.
  - Hay que cambiar `id` a `string` en el front, o mapearlo.
- **Contraseña.** `CreateUserDto` exige `password` (mínimo 8 caracteres). Eso contradice HE-01-HU-01, donde la genera el sistema. El backend debe generarla, o crear el usuario en Keycloak con *required action* `UPDATE_PASSWORD`.
- **Propiedades de campo.** Los campos de la estructura usan `help`, `maxLength` y `teacherEditable`, que no están en `guide-field.dto.ts`. El `ValidationPipe` con `whitelist` las descartaría. El backend debe agregarlas al DTO.

### 8.3 Prefijo `/api` y CORS

El backend escucha en `:3000` sin `setGlobalPrefix('api')` y sin `enableCors()`. Hay dos opciones:
- pedir `app.setGlobalPrefix('api')` y `app.enableCors({ origin: 'http://localhost:4200' })`;
- o agregar `proxy.conf.json` en Angular (`/api` → `http://localhost:3000`, `pathRewrite: { '^/api': '' }`) y usarlo con `ng serve --proxy-config`.

Además, hay que crear `src/environments/` con `apiUrl` y los datos de Keycloak (`url`, `realm`, `clientId`).

### 8.4 Doble API académica

El backend tiene `/programs`, `/modules` y `/competencies` y, en paralelo, `/academic/*`. Hay que confirmar con el equipo de backend cuál es la oficial para HE-02.

### 8.5 Endpoints que faltan en el backend

| Épica | Lo que usa el front y no existe |
|---|---|
| HE-01 | `GET /users/me`; historial de eventos de un usuario («Historial reciente»); disponibilidad de correo (`GET /users/email-availability`); conteo por rol para «Roles y permisos»; reactivar usuario. |
| HE-02 | Motivo opcional al inhabilitar; resumen del programa (tarjetas); número de guías publicadas por competencia antes de eliminar. Confirmar que existen `next-code` y `name-availability` en la API elegida (8.4). |
| HE-03 | Versionado de la estructura con cálculo de impacto (`version`, guías en borrador y publicadas afectadas); historial de eventos de la guía; docentes asignados al módulo para el modal de publicación; resumen del listado. |
| HE-04 | Guías visibles para el docente filtradas por asignación, con el conteo de guías ocultas; nombre de la versión (`name`) y su unicidad por docente; contenido base de la copia (`baseContent`) para marcar «Adaptado»; guardado campo por campo con fecha (`PATCH …/personalized-versions/:id/fields/:key`); resumen de aislamiento (número de versiones de otros docentes en el módulo). |
| HE-05 | **Todo.** Contrato propuesto: `POST /academic/guides/:guideId/suggestions`, `GET /academic/suggestions?status=&moduleId=&guideId=&order=`, `GET /academic/suggestions/mine`, `GET /academic/suggestions/:id`, `PATCH /academic/suggestions/:id/approve` (aplica el cambio, sube la versión y registra el evento en una sola transacción) y `PATCH /academic/suggestions/:id/reject` con `{ reason, feedback }`. Los errores esperados son los de `suggestion-api.ts` (`NO_CHANGES`, `SUGGESTION_ALREADY_PENDING`, `SUGGESTION_ALREADY_DECIDED`, `GUIDE_CHANGED`, `FEEDBACK_TOO_SHORT`…). |

### 8.6 Cambio de los servicios

Cada `*-api.ts` lee hoy `MockDb` dentro de `simular()`. Para conectarlos:
1. Inyectar `HttpClient`.
2. Reemplazar cada método por la llamada HTTP, con los mismos nombres, parámetros y tipos de retorno.
3. Traducir los errores HTTP a `ApiError(code)` con los mismos códigos, para que las pantallas no cambien.

Las pruebas de servicio actuales describen el comportamiento esperado. Sirven como especificación para las pruebas del backend o para pruebas con `HttpTestingController`.
