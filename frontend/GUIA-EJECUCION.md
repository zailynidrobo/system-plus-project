# Guía de ejecución del frontend (Windows)

Frontend de la intranet AthenaDev · System Plus Piendamó. Usa Angular 21 con npm.

Incluye HE-01 a HE-05 con **datos simulados en memoria** (sin backend):
- usuarios y roles;
- programa académico;
- guías base;
- espacio docente;
- sugerencias.

## 1. Requisitos

| Herramienta | Versión | Cómo comprobarla |
|---|---|---|
| Node.js | `^20.19.0`, `^22.12.0` o `>=24.0.0` (recomendado: 22 LTS o 24) | `node -v` |
| npm | 11.x (el proyecto declara `npm@11.12.1`) | `npm -v` |
| Git | Cualquier versión reciente | `git --version` |

Si no tienes Node o tu versión es antigua, instala la LTS:

```powershell
winget install OpenJS.NodeJS.LTS
```

Después **cierra y vuelve a abrir** la terminal para que tome la nueva versión.

> Usa **npm**, no pnpm ni yarn. El proyecto trae `package-lock.json`.

## 2. Instalación

```powershell
cd system-plus-project\frontend
npm ci
```

- `npm ci` instala exactamente lo que dice `package-lock.json`. Úsalo siempre la primera vez y después de cada `git pull`.
- Puede salir el aviso `install-scripts ... not yet covered by allowScripts` (esbuild, lmdb…). Es normal con npm 11.19 y no impide compilar ni ejecutar.
- También puede aparecer `5 vulnerabilities`. Son dependencias internas de la herramienta de compilación. No ejecutes `npm audit fix` sin consultarlo antes con el equipo, porque modifica el lock.

## 3. Ejecutar

```powershell
npx ng serve
```

Abre <http://localhost:4200> y entra con uno de los usuarios de la sección 6. Para detener el servidor, pulsa `Ctrl + C`.

> **Importante: los datos viven en memoria.** Todo lo que crees o cambies se pierde al recargar la página (`F5`) o al escribir una dirección en la barra del navegador. Para cambiar de usuario sin perder datos, usa **Cerrar sesión** (menú del nombre, arriba a la derecha) y vuelve a entrar.

## 4. Compilar

```powershell
npx ng build --configuration development   # compilación rápida para depurar
npx ng build                               # producción (sale en dist\frontend)
```

- La compilación de producción muestra 4 advertencias de *budget* en estilos de HE-01: `login`, `user-list`, `user-role` y `user-deactivate`. Pasan el aviso de 4 kB por pocos bytes, pero ninguno llega al límite de error de 8 kB.
- El *bundle* inicial pesa unos 423 kB. Las pantallas de cada épica se cargan solo cuando se abren.

## 5. Pruebas

```powershell
npx ng test --watch=false   # una sola pasada
npx ng test                 # modo observación
```

Estado actual: **150 pruebas en 22 archivos, todas pasan.** Cubren:
- Servicios mock de todas las épicas:
  - módulos y competencias duplicados;
  - transiciones de estado;
  - aislamiento de las copias de guía;
  - aprobar y rechazar sugerencias.
- Guards y redirección por rol.
- Mapeo de roles de Keycloak.
- Interceptor HTTP.
- Formulario dinámico.
- Autoguardado del editor de versiones.

Para correr un solo archivo:

```powershell
npx ng test --watch=false --include src/app/features/suggestions/suggestion-api.spec.ts
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
  - SUG-009 aprobada;
  - SUG-006 rechazada.

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
      - pulsa **Enviar sugerencia**.

      Queda **Pendiente** (HE-05-HU-01).
   7. Cierra sesión.
3. **Coordinador**:
   1. El menú **Sugerencias** muestra el contador de pendientes.
   2. Abre la sugerencia nueva con **Revisar** (HE-05-HU-02). Compara el contenido actual con el propuesto; el texto agregado aparece resaltado.
   3. Pulsa **Aprobar y actualizar guía** y confirma. La guía pasa a `v1.1` y queda en su historial (HE-05-HU-03).
   4. Abre otra pendiente (por ejemplo SUG-013) y usa **Rechazar**:
      - elige un motivo;
      - escribe al menos 30 caracteres de retroalimentación;
      - pulsa **Rechazar y enviar retroalimentación** (HE-05-HU-04).
4. **Docente**: en **Mis sugerencias** ve su sugerencia aprobada, con la nueva versión. En la versión que creó en el paso 2.3, el editor avisa que la guía base cambió, pero su copia sigue igual.

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
  - El rechazo exige motivo y 30 caracteres de retroalimentación.

## 9. Conectar el backend real

No basta con cambiar un interruptor. La lista completa de pendientes está en `docs/verificacion-front-HE01-HE05.md`, sección 8. Lo principal:

1. **Autenticación:** decidir entre Keycloak y un login propio. El front ya está preparado:
   - `core/auth/provide-auth.ts` es el único punto donde se elige la implementación (`AuthProvider`);
   - `core/auth/role-mapping.ts` traduce los roles de Keycloak.
2. **Adaptador de datos:** el backend usa `name`, `email`, `role` en minúscula (`admin`…) e `isActive`.
3. **Prefijo `/api` y CORS** en el backend, o un `proxy.conf.json` en Angular.
4. **Servicios `*-api.ts`:** hoy todos leen `MockDb`. Hay que reescribirlos con `HttpClient`, conservando los nombres de métodos y los códigos de error.
5. **Endpoints que faltan:** en el backend no existen las sugerencias (HE-05) ni varios datos que usan HE-03 y HE-04. Algunos ejemplos:
   - las propiedades de campo `help`, `maxLength` y `teacherEditable`;
   - el nombre de la versión docente.

## 10. Problemas comunes

**"node" no se reconoce, o Angular dice que la versión de Node no es compatible**
Instala Node 22 LTS (sección 1) y abre una terminal nueva.

**PowerShell: "la ejecución de scripts está deshabilitada en este sistema"**
Usa las versiones `.cmd`, que no dependen de la política de ejecución:

```powershell
npm.cmd ci
npx.cmd ng serve
```

También puedes usar la terminal *Command Prompt* o *Git Bash*. No hace falta cambiar la política de ejecución del sistema.

**El puerto 4200 ya está en uso**
Puedes arrancar en otro puerto:

```powershell
npx ng serve --port 4300
```

O puedes cerrar el proceso que ocupa el 4200:

```powershell
netstat -ano | findstr :4200
taskkill /PID <número_que_aparece_al_final> /F
```

**`npm ci` falla diciendo que `package.json` y `package-lock.json` no coinciden**
Avisa al equipo antes de usar `npm install`, porque ese comando reescribe el lock.

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
- Con Keycloak activo, las pantallas de gestión siguen usando datos simulados hasta que se conecten con el backend (siguiente paso de HE-01).
