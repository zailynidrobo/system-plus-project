# Casos de prueba — HE-01 Gestión de usuarios, roles y permisos

Sprint 1 · Historias SYS-6 a SYS-10 · Tarea SYS-24.

## Entorno de las pruebas

Todo corre en local siguiendo [gestion-guias/README.md](../gestion-guias/README.md) (sección «Arranque rápido») y [keycloak/README.md](../keycloak/README.md):

- Keycloak 26.3 con el realm `system-plus` importado.
- PostgreSQL 16 con la base `gestion_guias`.
- Backend (`pnpm start:dev`) en <http://localhost:3000> y front (`npx ng serve`) en <http://localhost:4200>.

Usuarios de prueba (contraseña `12345678`): `admin@example.com` (Administrador), `coordinador@example.com` (Coordinador Académico), `docente@example.com` (Docente) y `autorizado@example.com` (Docente Autorizado).

**Columna «Estado»:** `Pasó` indica que el caso se ejecutó a mano el 14 de octubre de 2026 en un entorno limpio levantado desde `develop`. `Pendiente` indica que aún no se ha ejecutado a mano; los casos marcados con `Auto` además están cubiertos por pruebas automáticas (`pnpm test` en el backend y `ng test` en el front).

## HU-05 · Iniciar sesión (SYS-10)

| ID | Caso | Pasos | Resultado esperado | Estado |
|---|---|---|---|---|
| CP-05-01 | Inicio de sesión válido | Abrir el front → entrar a Keycloak con `admin@example.com` | Vuelve al front y muestra el inicio del Administrador | Pasó |
| CP-05-02 | Contraseña incorrecta | En Keycloak escribir una contraseña errónea | Keycloak rechaza el acceso y no entra al front | Pendiente |
| CP-05-03 | Primer ingreso con contraseña temporal | Entrar con un usuario recién creado y su contraseña temporal | Keycloak obliga a definir una contraseña nueva y luego entra a su pantalla de rol | Pasó |
| CP-05-04 | La sesión sobrevive a F5 | Con sesión iniciada, pulsar F5 | Sigue dentro, sin volver a pedir credenciales | Pasó |
| CP-05-05 | Cerrar sesión | Usar «Cerrar sesión» | Vuelve a la pantalla de acceso y se cierra la sesión en Keycloak | Pasó |
| CP-05-06 | Usuario desactivado | Intentar entrar con un usuario desactivado | Keycloak no lo deja entrar | Pasó |
| CP-05-07 | API sin token | `GET /users` sin cabecera `Authorization` | `401 Unauthorized` | Pasó · Auto |
| CP-05-08 | Rol sin permiso en la API | `GET /users` con un token sin el rol `admin` | `403 Forbidden` | Auto |
| CP-05-09 | Cuenta sin rol de la app | Entrar con un usuario de Keycloak sin ninguno de los cuatro roles | Aviso «Tu cuenta no tiene un rol asignado» | Pendiente |

## HU-01 · Registrar usuario (SYS-6)

| ID | Caso | Pasos | Resultado esperado | Estado |
|---|---|---|---|---|
| CP-01-01 | Registro válido | Usuarios → Registrar usuario → nombre `Prueba Final`, correo `pfinal@example.com`, rol Docente | «Registro completado»; el usuario existe en Keycloak con su rol | Pasó |
| CP-01-02 | Contraseña temporal | Tras registrar, mirar la pantalla de confirmación | Muestra una contraseña temporal una sola vez | Pasó |
| CP-01-03 | La contraseña temporal no se vuelve a mostrar | Recargar la pantalla de confirmación o abrir el usuario después | No aparece la contraseña | Pendiente |
| CP-01-04 | Correo repetido | Registrar con un correo que ya existe | Aviso «Este correo ya está registrado»; no se crea | Pendiente · Auto |
| CP-01-05 | Correo inválido | Escribir `correo-sin-arroba` | Mensaje de correo inválido; no deja registrar | Pendiente |
| CP-01-06 | Nombre muy corto | Escribir un nombre de menos de 5 caracteres | Mensaje «Escribe nombres y apellidos» | Pendiente |
| CP-01-07 | Sin rol | Dejar el rol sin elegir | Mensaje «Selecciona un rol» | Pendiente |
| CP-01-08 | Aparece en el listado | Volver a Usuarios | El usuario nuevo está en la lista, activo | Pasó |

## HU-02 · Editar usuario (SYS-7)

| ID | Caso | Pasos | Resultado esperado | Estado |
|---|---|---|---|---|
| CP-02-01 | Editar nombre | Editar el usuario → cambiar el nombre → Guardar | Se guarda y el listado muestra el nombre nuevo | Pasó |
| CP-02-02 | Recarga en la pantalla de edición | Pulsar F5 estando en «Editar usuario» | La pantalla sigue funcionando y muestra los datos del usuario | Pasó |
| CP-02-03 | Correo de otro usuario | Cambiar el correo por uno que ya usa otro usuario | Aviso de correo ya registrado; no se guarda | Pendiente · Auto |
| CP-02-04 | Sin cambios | Abrir la edición sin modificar nada | El botón «Guardar cambios» está desactivado | Pendiente |
| CP-02-05 | El rol no cambia al editar | Editar nombre o correo | El rol del usuario sigue igual | Auto |

## HU-03 · Desactivar usuario (SYS-8)

| ID | Caso | Pasos | Resultado esperado | Estado |
|---|---|---|---|---|
| CP-03-01 | Desactivar | Desactivar a `pfinal@example.com` y confirmar | Pantalla de confirmación; el usuario queda en estado Desactivado | Pasó |
| CP-03-02 | No puede volver a entrar | Cerrar su sesión e intentar entrar de nuevo | Keycloak lo rechaza | Pasó |
| CP-03-03 | No se borra | Revisar el listado y Keycloak después de desactivar | El usuario sigue existiendo con sus datos, marcado como desactivado | Pendiente · Auto |
| CP-03-04 | Cierra sus sesiones abiertas | Desactivar a un usuario con sesión iniciada | Su sesión se cierra en Keycloak | Auto |

## HU-04 · Asignar rol (SYS-9)

| ID | Caso | Pasos | Resultado esperado | Estado |
|---|---|---|---|---|
| CP-04-01 | Cambiar el rol | Roles y permisos → elegir al usuario → Coordinador Académico → Guardar | Se guarda el rol nuevo | Pasó |
| CP-04-02 | El rol nuevo se aplica | Entrar con ese usuario | Ve la pantalla del rol Coordinador | Pasó |
| CP-04-03 | Un solo rol | Revisar el usuario en Keycloak tras el cambio | Solo tiene el rol nuevo, no el anterior | Pendiente · Auto |
| CP-04-04 | Usuario inexistente | Abrir `/roles/<id que no existe>` | Muestra «usuario no encontrado» | Pendiente |
| CP-04-05 | Conteo por rol | Abrir Roles y permisos | Las tarjetas suman el total de usuarios con rol | Pendiente |

## Listado y permisos de pantalla

| ID | Caso | Pasos | Resultado esperado | Estado |
|---|---|---|---|---|
| CP-L-01 | Listado desde Keycloak | Entrar como admin → Usuarios | Aparecen los usuarios del realm con su rol y estado | Pasó |
| CP-L-02 | Búsqueda y filtros | Buscar por nombre o correo; filtrar por rol y por estado | La lista y los totales se ajustan | Pendiente · Auto |
| CP-L-03 | Backend caído | Detener el backend y abrir Usuarios | Aviso «No se pudieron cargar los usuarios» con botón «Reintentar», sin quedarse cargando | Auto |
| CP-L-04 | Docente sin acceso a gestión | Entrar como `docente@example.com` y abrir `/usuarios` | Pantalla «Sin acceso» | Pendiente |

## Cómo repetir las pruebas automáticas

```bash
cd gestion-guias && pnpm test    # backend: 52 pruebas
cd frontend && npx ng test --watch=false
```
