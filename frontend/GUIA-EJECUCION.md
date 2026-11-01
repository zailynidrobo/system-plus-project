# Guía de ejecución del frontend (Windows)

Frontend de la intranet AthenaDev · System Plus Piendamó. Usa Angular 21 con pnpm.

Esta guía explica cómo ejecutar el frontend y cómo probarlo. Tiene dos modos:

- **Modo completo (configuración por defecto del repositorio):** `auth: 'keycloak'`, `api: 'http'` y `apiAcademico: 'http'`. Usa Keycloak, el backend y PostgreSQL. Los pasos están en las secciones 11, 12 y 13, y en el [README principal](../README.md#7-puesta-en-marcha-completa-frontend--backend--keycloak).
- **Modo simulado:** sin backend ni Keycloak, con datos en memoria. Hay que cambiar `auth`, `api` y `apiAcademico` a `'mock'` en `src/environments/environment.ts` (solo en tu computador, sin hacer commit). Las secciones 3 a 8 describen este modo.

Estado de las épicas: HE-01, HE-02 y HE-03 usan el backend. Con `apiAcademico: 'http'`, HE-05 (sugerencias y campana de notificaciones) también usa el backend (sección 14).

## 1. Requisitos

| Herramienta | Versión | Cómo comprobarla |
|---|---|---|
| Node.js | `^20.19.0`, `^22.12.0` o `>=24.0.0` (recomendado: 22 LTS o 24) | `node -v` |
| pnpm | 12.8.1 (declarado en `package.json`) | `pnpm -v` |
| Git | Cualquier versión reciente | `git --version` |

Si no tienes Node o tu versión es antigua, instala la LTS:

```powershell
winget install OpenJS.NodeJS.LTS
```

Después **cierra y vuelve a abrir** la terminal para que tome la nueva versión.

> Usa **pnpm** para instalar dependencias y ejecutar los comandos del front.

## 2. Instalación

```powershell
cd system-plus-project\frontend
pnpm install --frozen-lockfile
```

- `pnpm install --frozen-lockfile` instala las versiones registradas en `pnpm-lock.yaml`. Úsalo la primera vez y después de cada `git pull`.
- Si cambian las dependencias, ejecuta `pnpm install` y confirma los cambios de `package.json` y `pnpm-lock.yaml`.

## 3. Ejecutar

```powershell
pnpm start
```

Abre <http://localhost:4200> y entra con uno de los usuarios de la sección 6. Para detener el servidor, pulsa `Ctrl + C`.

> **Importante: los datos viven en memoria.** Todo lo que crees o cambies se pierde al recargar la página (`F5`) o al escribir una dirección en la barra del navegador. Para cambiar de usuario sin perder datos, usa **Cerrar sesión** (menú del nombre, arriba a la derecha) y vuelve a entrar.

## 4. Compilar

```powershell
pnpm exec ng build --configuration development   # compilación rápida para depurar
pnpm build                                       # producción (sale en dist\frontend)
```

- La compilación de producción muestra 4 advertencias de *budget* en estilos de HE-01: `login`, `user-list`, `user-role` y `user-deactivate`. Pasan el aviso de 4 kB por pocos bytes, pero ninguno llega al límite de error de 8 kB.
- El *bundle* inicial pesa unos 520 kB y muestra la advertencia de 500 kB (el error es a 1 MB). La campana del encabezado y los adaptadores HTTP de HE-05 se cargan desde el inicio. Las pantallas de cada épica se cargan solo cuando se abren.

## 5. Pruebas

```powershell
pnpm exec ng test --watch=false   # una sola pasada
pnpm test                        # modo observación
```

Estado actual: **245 pruebas en 36 archivos, todas pasan.** Cubren:
- Servicios mock de todas las épicas:
  - módulos y competencias duplicados;
  - transiciones de estado;
  - aislamiento de las copias de guía;
  - aprobar y rechazar sugerencias, plazos de 5 a 8 días hábiles con festivos, fecha requerida y notificaciones.
- Adaptadores HTTP (`HttpTestingController`), incluidos los de sugerencias y notificaciones.
- Panel de la campana del encabezado.
- Guards y redirección por rol.
- Mapeo de roles de Keycloak.
- Interceptor HTTP.
- Formulario dinámico.
- Autoguardado del editor de versiones.

Para correr un solo archivo:

```powershell
pnpm exec ng test --watch=false --include src/app/features/suggestions/suggestion-api.spec.ts
```

## 6. Usuarios de prueba

Todos usan la contraseña **`123456`**.

| Correo | Nombre | Rol | Qué puede hacer | Entra a |
|---|---|---|---|---|
| `admin@example.com` | Diana Marcela Ruiz | Administrador | Registrar, editar y desactivar usuarios; asignar roles (HE-01). | `/usuarios` |
| `coordinador@example.com` | Laura Muñoz | Coordinador Académico | Módulos y competencias (HE-02); guías base y su estructura (HE-03); revisar, aprobar y rechazar sugerencias (HE-05). | `/modulos` |
| `docente@example.com` | Julián Andrés Ospina | Docente | Ver las guías de sus módulos (POO y Bases de Datos), crear y editar versiones propias (HE-04) y enviar sugerencias (HE-05). | `/mis-modulos` |
| `autorizado@example.com` | Paola Valencia | Docente Autorizado | Lo mismo que el docente, en POO y Redes y conectividad. | `/mis-modulos` |
| `inactivo@example.com` | Carlos Ramírez | Docente (desactivado) | No puede entrar: recibe el mensaje genérico de credenciales inválidas. | — |

**Los usuarios y los datos académicos salen de la misma base en memoria** (`src/app/core/mock/mock-db.ts`). Por eso:
- Si el administrador desactiva o cambia el rol de un usuario, el cambio aplica en su siguiente navegación, sin cerrar sesión.
- Los demás usuarios del listado (19 más) existen solo para mostrar datos. No tienen contraseña conocida y no pueden entrar.

**Datos de partida:**
- 6 módulos, de TS-MOD-01 a TS-MOD-06, con sus competencias.
- 8 guías base: 7 publicadas y GB-SIS-01 en borrador.
- 4 versiones docentes. Julián ya tiene «POO · Grupo 2026-1».
- 6 sugerencias:
  - SUG-011 a SUG-014 pendientes; SUG-014 es de Julián;
  - SUG-011 se envió hace 20 días: está **vencida, pero sigue pendiente**;
  - SUG-009 aprobada;
  - SUG-006 rechazada.
- Julián ya tiene leídas las notificaciones de SUG-009 y SUG-006.

## 7. Rutas

| Rol | Ruta | Pantalla |
|---|---|---|
| Todos | `/login` | Iniciar sesión (si ya hay sesión, redirige al inicio del rol) |
| Todos | `/sin-acceso` | Aviso cuando se abre una ruta de otro rol |
| Administrador | `/usuarios`, `/usuarios/nuevo`, `/usuarios/:id/editar`, `/usuarios/:id/desactivar` | Gestión de usuarios (HE-01) |
| Administrador | `/roles`, `/roles/:id` | Roles y permisos → Asignar rol (HE-01-HU-04) |
| Coordinador | `/modulos`, `/modulos/nuevo`, `/modulos/:id`, `/modulos/:id/editar`, `/modulos/:id/inhabilitar` | Programa académico (HE-02) |
| Coordinador | `/modulos/:id/competencias/nueva`, `/modulos/:id/competencias/:competenciaId/editar`, `…/eliminar` | Competencias (HE-02) |
| Coordinador | `/guias`, `/guias/nueva`, `/guias/:id`, `/guias/:id/editar`, `/guias/estructura` | Guías base y estructura del formulario (HE-03) |
| Coordinador | `/sugerencias`, `/sugerencias/:id` | Bandeja y revisión de sugerencias (HE-05) |
| Docente y Docente Autorizado | `/mis-modulos`, `/mis-modulos/guias/:id` | Guías base de mis módulos, en solo lectura (HE-04) |
| Docente y Docente Autorizado | `/mis-versiones`, `/mis-versiones/:id` | Mis versiones y editor con autoguardado (HE-04) |
| Docente y Docente Autorizado | `/mis-modulos/guias/:id/sugerir`, `/mis-sugerencias`, `/mis-sugerencias/:id` | Sugerir cambio y seguimiento (HE-05) |

En el menú, «Inicio», «Reportes», «Auditoría» y «Centro de ayuda» aparecen deshabilitados porque no tienen historia de usuario.

## 8. Recorrido de prueba manual

Hazlo en una sola pestaña y sin recargar (ver la nota de la sección 3).

### 8.1 Flujo completo entre roles

1. **Coordinador** (`coordinador@`):
   1. Ve a **Programa académico → Registrar módulo** y crea «Desarrollo web» (HE-02-HU-01). Si escribes un nombre que ya existe, verás el aviso de duplicado.
   2. En el detalle del módulo, usa **Asociar competencia** y registra una (HE-02-HU-04). El código se genera solo, con el formato `COMP-<SIGLA>-NN`.
   3. Ve a **Guías de aprendizaje → Configurar estructura**, elige POO, agrega o reordena un campo y guarda. La ventana de impacto avisa que las guías publicadas conservan su estructura (HE-03-HU-04).
   4. Usa **Nueva guía base**:
      - módulo *Programación Orientada a Objetos*, cualquier competencia;
      - llena los campos obligatorios;
      - pulsa **Guardar borrador**.

      Debe quedar como `GB-POO-04` en Borrador (HE-03-HU-01).
   5. Usa **Seguir editando → Publicar… → Sí, publicar guía** (HE-03-HU-02 y HU-03).
   6. Cierra sesión.
2. **Docente** (`docente@`):
   1. En **Guías base** aparece `GB-POO-04` junto a las demás guías de POO y Bases de Datos. Las guías de otros módulos no aparecen; solo se cuentan al pie (HE-04-HU-01).
   2. Abre la guía (**Consultar guía**). Es de solo lectura.
   3. Pulsa **Crear mi versión**, deja el nombre sugerido y confirma (HE-04-HU-02).
   4. En el editor:
      - pulsa el lápiz de un campo y cambia el texto;
      - después de 1 segundo el indicador pasa a «Todos los cambios guardados»;
      - pulsa **Guardar campo**: el campo queda marcado como «Adaptado» (HE-04-HU-03).

      «Intensidad horaria» no se puede editar porque coordinación la definió como no editable.
   5. Vuelve a **Mis versiones**. Las tarjetas confirman que la guía base y las versiones de otros docentes no cambiaron.
   6. Desde la guía, pulsa **Sugerir cambio**:
      - elige «Objetivos de aprendizaje»;
      - edita el texto;
      - escribe una justificación de al menos 20 caracteres;
      - en «5. Fecha en que necesitas el cambio» elige una fecha de al menos 14 días desde hoy (el calendario no deja elegir antes);
      - pulsa **Enviar sugerencia**.

      Queda **Pendiente**, con plazo de respuesta de 5 a 8 días hábiles (HE-05-HU-01).
   7. Cierra sesión.
3. **Coordinador**:
   1. El menú **Sugerencias** y la **campana** del encabezado muestran el contador de pendientes sin abrir nada. Abre la campana: primero la vencida (SUG-011), luego las por vencer y al final la nueva («nueva, recibida hoy»).
   2. Abre la sugerencia nueva desde la campana o con **Revisar** (HE-05-HU-02). Compara el contenido actual con el propuesto; el texto agregado aparece resaltado. La bandeja muestra la fecha requerida y el estado del plazo, y se puede filtrar por plazo.
   3. Pulsa **Aprobar y actualizar guía** y confirma. La guía pasa a `v1.1` y queda en su historial; el bloque «Notificaciones enviadas» indica a quién se avisó (HE-05-HU-03). SUG-011, aunque está vencida, también se puede aprobar o rechazar.
   4. Abre otra pendiente (por ejemplo SUG-013) y usa **Rechazar**:
      - elige un motivo;
      - escribe al menos 30 caracteres de retroalimentación;
      - pulsa **Rechazar y enviar retroalimentación** (HE-05-HU-04).
4. **Docente**: la campana muestra «Sugerencia … aprobada» sin leer; al abrirla queda leída y lleva al detalle. En **Mis sugerencias** ve su sugerencia aprobada, con la nueva versión. En la versión que creó en el paso 2.3, el editor avisa que la guía base cambió, pero su copia sigue igual.
5. **Docente Autorizado** (`autorizado@`, también asignada a POO): la campana muestra «Nueva versión v1.1 de GB-POO-01 disponible».

### 8.2 Pruebas por épica

- **HE-01 (Administrador):**
  - Registrar usuario: correo repetido y aviso «Correo disponible».
  - Editar usuario: subtítulo con código, historial reciente.
  - Desactivar a un docente y comprobar que ya no puede entrar.
  - En **Roles y permisos**, buscar a Julián y cambiarle el rol. Él verá el menú nuevo en su siguiente navegación.
- **HE-02:**
  - Editar módulo con nombre duplicado.
  - Inhabilitar un módulo (motivo opcional) y rehabilitarlo.
  - Editar una competencia: se guarda la versión anterior en el historial.
  - Eliminar una competencia: ya no se podrá usar en guías nuevas.
- **HE-03:**
  - Editar GB-SIS-01 (borrador).
  - Intentar publicarla con «Criterios de evaluación» vacío: la publicación se bloquea hasta completarlo.
- **HE-04:** con `autorizado@` (Paola) no se ve ninguna versión de Julián, y abrir `/mis-versiones/1` dice que la versión no existe.
- **HE-05:**
  - No se puede enviar otra sugerencia sobre un campo que ya tiene una pendiente propia.
  - La fecha requerida debe ser al menos 14 días después de hoy.
  - El rechazo exige motivo y 30 caracteres de retroalimentación. El docente recibe la notificación con el motivo.
  - Con `admin@`, la campana está vacía.

## 9. Qué falta por conectar al backend

Ya están conectados HE-01 (usuarios y roles, con Keycloak), HE-02 (programa académico) y HE-03 (guías base y estructura). Ver las secciones 11 a 13.

Siguen con datos simulados:

1. **HE-04, espacio docente:** `teacher-api.ts` lee `MockDb`. Hay que reescribirlo con `HttpClient` sobre las rutas `/academic/...` del backend, conservando los nombres de métodos y los códigos de error.
2. **HE-05, sugerencias:** ya tiene backend (sección 14). Con `apiAcademico: 'mock'` sigue funcionando con datos simulados y las mismas reglas.

El detalle de pendientes está en `docs/verificacion-front-HE01-HE05.md`.

## 10. Problemas comunes

**"node" no se reconoce, o Angular dice que la versión de Node no es compatible**
Instala Node 22 LTS (sección 1) y abre una terminal nueva.

**PowerShell: "la ejecución de scripts está deshabilitada en este sistema"**
Usa las versiones `.cmd`, que no dependen de la política de ejecución:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd start
```

También puedes usar la terminal *Command Prompt* o *Git Bash*. No hace falta cambiar la política de ejecución del sistema.

**El puerto 4200 ya está en uso**
Puedes arrancar en otro puerto:

```powershell
pnpm exec ng serve --port 4300
```

O puedes cerrar el proceso que ocupa el 4200:

```powershell
netstat -ano | findstr :4200
taskkill /PID <número_que_aparece_al_final> /F
```

**`pnpm install --frozen-lockfile` falla porque el lock no coincide**
Ejecuta `pnpm install` después de confirmar que los cambios de dependencias son intencionales y registra el `pnpm-lock.yaml` actualizado.

**Desaparecieron los módulos, guías o versiones que creé**
Recargaste la página o escribiste una URL en la barra del navegador. Los datos simulados vuelven al estado inicial. Navega con el menú y usa «Cerrar sesión» para cambiar de usuario.

**Entro con un rol y veo «Sin acceso»**
Abriste una ruta de otro rol, por ejemplo `/sugerencias` con el docente. Usa el menú lateral o vuelve a `/`, que lleva al inicio de tu rol.

## 11. Iniciar sesión con Keycloak

El modo de autenticación se elige en `src/environments/environment.ts`:

| `auth` | Qué hace |
|---|---|
| `'keycloak'` | Login real: `/login` redirige a Keycloak y vuelve con el token. Requiere Keycloak en Docker. |
| `'mock'` | Login simulado con los usuarios de la sección 6. No necesita Keycloak ni backend. |

Para usar Keycloak:

1. Tener Keycloak corriendo (`docker run ... quay.io/keycloak/keycloak:26.3 start-dev`) en `http://localhost:8080`.
2. Tener el realm `system-plus` con el client público `system-plus-front` (redirect URI y web origin `http://localhost:4200`), los roles `admin`, `coordinador`, `docente` y `docente_autorizado`, el mapper de audience `system-plus-api` y usuarios con un rol asignado.
3. Si los nombres del realm o del client cambian, ajustar el bloque `keycloak` de `environment.ts`.
4. Entrar a <http://localhost:4200>: la app lleva a la pantalla de Keycloak. Al cerrar sesión se cierra también en Keycloak.

Notas:
- Un usuario de Keycloak sin ninguno de los cuatro roles ve el aviso «Tu cuenta no tiene un rol asignado».
- Un cambio de rol hecho en Keycloak se aplica cuando el token se renueva.
- Las pantallas de gestión de usuarios usan el backend si `api` es `'http'` (sección 12); con `'mock'` siguen con datos simulados.

## 12. Gestión de usuarios con el backend real

En `src/environments/environment.ts`:

| `api` | Qué hace |
|---|---|
| `'http'` | Las pantallas de **Usuarios** y **Roles** leen y guardan en el backend (`apiUrl`, por defecto `http://localhost:3000`), que administra los usuarios en Keycloak. |
| `'mock'` | Datos simulados en memoria (sección 6). No necesita backend. |

Para usar `'http'`, juntos:

1. Keycloak encendido (`docker start keycloak`) y `auth: 'keycloak'`.
2. Postgres encendido y el backend (`gestion-guias`) corriendo con `pnpm start:dev`, con su `.env` completo (incluye el secreto de la cuenta de servicio `system-plus-api`; ver el README del backend).
3. Entrar al front con un usuario con rol **Administrador**: solo ese rol puede usar `/users` en el backend.

Cosas a tener en cuenta:
- Al registrar un usuario, la pantalla de confirmación muestra la **contraseña temporal** una sola vez: entrégala a la persona; Keycloak le pedirá cambiarla al primer ingreso.
- Los usuarios de Keycloak que no tienen uno de los cuatro roles no aparecen en el listado.
- El historial de «Editar usuario» solo muestra la fecha de registro; el backend aún no guarda eventos.
- Los ids de las rutas (`/usuarios/2863311530/editar`) son un número derivado del UUID de Keycloak.


## 13. Programa académico (módulos y competencias) con el backend real

En `src/environments/environment.ts`:

| `apiAcademico` | Qué hace |
|---|---|
| `'mock'` | Módulos y competencias simulados en memoria. Los datos de prueba se pierden al recargar. |
| `'http'` (por defecto) | Programa académico, estructura y guías base usan el backend y PostgreSQL. |

Para probar `'http'`: Keycloak + Postgres + backend encendidos (sección 12) y entrar con un usuario **Coordinador** (es el único rol que puede crear y editar; los demás solo consultan).

Las guías se crean como borradores en `POST /academic/guides` y aparecen en el listado desde `GET /academic/guides`. El listado envía los filtros `search`, `moduleId`, `competencyId` y `status`, además de `page` y `pageSize`; la API responde `{ items, total, page, pageSize }`. El resumen de tarjetas se consulta en `GET /academic/guides/summary` y devuelve `total`, `modulos`, `publicadas` y `borradores`. Cada guía incluye los nombres de `createdBy`, `updatedBy` y `publishedBy` cuando estén disponibles. La API asigna el código y guarda la guía, su estructura, autores e historial en PostgreSQL. Si un módulo aún no tiene una estructura configurada, se usa la estructura institucional por defecto.

Los ids visibles en las rutas son números derivados de los UUID del backend. Al abrir directamente una pantalla de detalle después de recargar, el front vuelve a consultar la API para resolver el UUID.

## 14. Sugerencias (HE-05) y campana con el backend real

Con `apiAcademico: 'http'`, `app.config.ts` registra `HttpSuggestionApi` y `HttpNotificationApi`, que llaman a `/academic/suggestions` y `/academic/notifications`. Las reglas y el contrato están en [`docs/he05-sugerencias.md`](../docs/he05-sugerencias.md).

Para probar con el back real (Keycloak + PostgreSQL + `gestion-guias` encendidos):

1. **Coordinador:** asigna el módulo a dos docentes (`docente@` y `autorizado@`) y publica una guía del módulo.
2. **Docente:** abre la guía, pulsa **Sugerir cambio**, elige un campo, escribe la justificación y una fecha requerida de al menos 14 días, y envía.
3. **Coordinador:** la campana muestra la alerta y el contador sin abrirla. Ábrela o ve a **Sugerencias** y aprueba. La guía pasa a `v1.1`.
4. **Docente:** la campana muestra «Sugerencia … aprobada»; al abrirla queda leída. La guía base está en `v1.1`.
5. **Docente Autorizado:** la campana muestra «Nueva versión v1.1 de … disponible».
6. Repite con otra sugerencia y recházala: el docente ve el motivo en la campana y en **Mis sugerencias**.

Notas:
- La campana se consulta al entrar, cada 60 s y después de aprobar o rechazar. Una sugerencia que llega mientras el coordinador está en otra pantalla aparece en la siguiente consulta.
- El docente autorizado también necesita tener asignado el módulo para enviar sugerencias.
- Una sugerencia vencida sigue pendiente: se ve como «Vencida · sigue pendiente» y se puede aprobar o rechazar.
- En el modo simulado (`'mock'`) todo funciona igual, con datos en memoria.
