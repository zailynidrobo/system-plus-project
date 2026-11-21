# Instalación de System Plus en la intranet de la sala

Guía para dejar System Plus funcionando en una sala de práctica **sin conexión a internet**,
con la pantalla interactiva OneScreen T7 como punto de acceso principal.

## 1. Resumen

- Todo el sistema (base de datos, Keycloak, API y pantallas) corre en **un solo equipo servidor** con Docker.
- La sala tiene su **propia red local**: un router sin cable de internet que reparte direcciones a los equipos.
- La pantalla, los computadores y los celulares de la sala abren el navegador en `http://192.168.50.10`.
  No se instala nada en ellos.
- Las imágenes de Docker se preparan **una vez** en un computador con internet y se llevan en USB.

```
                      Router Wi-Fi de la sala (sin internet)
                      192.168.50.1  -  DHCP 192.168.50.100 a .200
                                      |
         +----------------------------+-----------------------------+
         |                            |                             |
  OneScreen T7 (RJ45 IN)        Computadores de la sala       Celulares / portátiles
  192.168.50.20                 (cable o Wi-Fi)               (Wi-Fi)
    +-- Módulo OPS = SERVIDOR
        192.168.50.10
        Docker: web (Nginx :80) -> api -> keycloak -> db
```

## 2. La pantalla OneScreen T7 y el servidor

Según la ficha técnica del fabricante, la OneScreen T7 trae **Android 15**, procesador ARM de 8 núcleos,
8 GB de RAM, 128 GB de almacenamiento, 2 puertos de red RJ45 (entrada y salida) y **una ranura OPS**.

El sistema Android de la pantalla **no puede ser el servidor**: Docker, Keycloak y PostgreSQL no corren en Android.
Hay dos formas de tener el servidor dentro de la sala:

| Opción | Qué es | Recomendado |
|---|---|---|
| **A. Módulo OPS** | Un mini computador que se inserta en la ranura OPS de la pantalla y trae Windows. La pantalla lo muestra como una entrada más ("PC" u "OPS"). | Sí, si el módulo ya está instalado o se puede conseguir |
| **B. Mini PC externo** | Un mini computador conectado al router por cable. Puede ir detrás de la pantalla. | Sí, si no hay módulo OPS |

En ambos casos la parte Android de la pantalla sigue siendo útil: su navegador abre el sistema como cualquier otro equipo.

**Cómo saber si la pantalla tiene módulo OPS:** en el control remoto o en el menú de entradas de la pantalla,
busque una fuente llamada **PC**, **OPS** o **Windows**. Si al elegirla aparece un escritorio de Windows, tiene módulo OPS.

**Servidor confirmado en la sala:** la OneScreen T7 de System Plus tiene módulo OPS con Windows 11.
Datos tomados del Administrador de tareas:

| Componente | Módulo OPS de la sala | ¿Cumple? |
|---|---|---|
| Procesador | Intel Core i7-1195G7 (11.ª gen), 4 núcleos y 8 hilos | Sí |
| Memoria RAM | 16 GB DDR4 (4,6 GB en uso sin el sistema) | Sí (recomendado) |
| Disco | SSD SATA Kingston de 239 GB | Sí |
| Virtualización | Habilitada | Sí |
| Red | Ethernet y Wi-Fi 6 (Intel AX101) | Sí |

Con la carga del sistema (unos 2,5 GB) le quedan más de 8 GB libres a Windows y a la pantalla.

**Requisitos mínimos del servidor (OPS o mini PC):**

| Componente | Mínimo | Recomendado |
|---|---|---|
| Procesador | 4 núcleos, x86-64 (Intel o AMD) | Intel Core i5 |
| Memoria RAM | 8 GB | 16 GB |
| Disco | 64 GB libres, SSD | 128 GB SSD |
| Sistema | Windows 10/11 Pro de 64 bits o Ubuntu Server 24.04 | |
| Otros | Virtualización activada en la BIOS (VT-x / AMD-V) | |

## 3. Material necesario

- Router Wi-Fi sencillo (cualquier marca). **No se conecta a internet**: se usa solo como red local.
- Cables de red: uno del router a la pantalla (RJ45 IN) y los que hagan falta para los computadores.
- Una USB de 16 GB o más.
- Un computador **con internet** para preparar el paquete (el de cualquier integrante del equipo).

## 4. Preparar el paquete (computador con internet)

Se hace una sola vez, y de nuevo cada vez que haya una versión nueva del sistema.

1. Instalar **Docker Desktop** en ese computador y abrirlo.
2. Descargar para llevar en la USB (servirán para instalar el servidor sin internet):
   - El instalador de Docker Desktop (`Docker Desktop Installer.exe`).
   - El instalador de WSL (`wsl.x.x.x.x64.msi`), desde la página de versiones de WSL en GitHub.
3. Abrir PowerShell en la carpeta del proyecto y ejecutar:
   ```powershell
   powershell -ExecutionPolicy Bypass -File deploy\scripts\preparar-paquete.ps1
   ```
4. Se crea la carpeta `paquete-systemplus` (unos 2 GB) con:
   - `imagenes-systemplus.tar`: las cuatro imágenes de Docker (también sirve comprimido, `.tar.gz`).
   - `docker-compose.yml`, `intranet.env.example`, `deploy/` y `keycloak/`.
5. Copiar la carpeta `paquete-systemplus` y los dos instaladores a la USB.

### Alternativa: armar el paquete en GitHub (sin Docker en ningún computador del equipo)

GitHub construye las imágenes en sus servidores (flujo `.github/workflows/paquete-sala.yml`).

1. En GitHub Desktop, estando en `develop` actualizado, crear la rama `paquete-sala`
   (Branch → New branch) y darle **Publish branch**. Si ya existe, subirle los cambios con
   **Push origin**.
2. En GitHub, pestaña **Actions**, esperar a que "Paquete de la sala" termine en verde (10 a 20 minutos).
3. En la página principal del repositorio, sección **Releases**, abrir "Paquete de la sala" y descargar
   `paquete-systemplus.zip` e `imagenes-systemplus.tar.gz`.
4. Descomprimir `paquete-systemplus.zip` en una carpeta `paquete-systemplus` y poner
   `imagenes-systemplus.tar.gz` dentro de ella, sin descomprimirlo: el instalador lo carga así.
5. Si las imágenes salieron divididas (`.part-aa`, `.part-ab`), unirlas en esa carpeta con:
   ```
   copy /b imagenes-systemplus.tar.gz.part-aa + imagenes-systemplus.tar.gz.part-ab imagenes-systemplus.tar.gz
   ```
6. Seguir con el paso 5 de la lista anterior (copiar a la USB con los dos instaladores).

## 5. Configurar la red de la sala

> **Red existente:** el día de la revisión, el módulo OPS estaba conectado por Wi-Fi a la red
> `DOMOTICA 1` con la dirección `192.168.0.10`. Si los computadores de la sala pueden conectarse a esa
> misma red y el equipo puede administrar su router, se puede usar en lugar de montar una red nueva:
> basta reservar `192.168.0.10` para el servidor en el DHCP de ese router y entrar a `http://192.168.0.10`.
> En ese caso, cambie `192.168.50.x` por `192.168.0.x` en esta guía. Para el servidor se recomienda
> conectarlo por cable (Ethernet) en lugar de Wi-Fi.

1. Conectar el router a la corriente. **No** conectar nada al puerto WAN o Internet del router.
2. Desde un computador conectado al router, entrar a su página de administración
   (suele ser `http://192.168.0.1` o `http://192.168.1.1`, viene en la etiqueta del router) y configurar:

   | Parámetro | Valor |
   |---|---|
   | IP del router (LAN) | `192.168.50.1` |
   | Máscara | `255.255.255.0` |
   | DHCP | Activado, de `192.168.50.100` a `192.168.50.200` |
   | Nombre de la red Wi-Fi | `SystemPlus-Sala` |
   | Contraseña Wi-Fi | Una clave de al menos 12 caracteres |
   | Seguridad Wi-Fi | WPA2-Personal o WPA3 (nunca red abierta) |
   | Aislamiento de clientes (AP isolation) | **Desactivado**: si está activo, los celulares no ven al servidor |
   | Contraseña de administración del router | Cambiar la que trae de fábrica |

3. Conectar con cable el router a la entrada **RJ45 IN** de la OneScreen T7.
   El módulo OPS recibe la red a través de la pantalla.
4. En el servidor (Windows) poner la IP fija:
   *Configuración → Red e Internet → Ethernet → Asignación de IP → Editar → Manual → IPv4*

   | Campo | Valor |
   |---|---|
   | Dirección IP | `192.168.50.10` |
   | Máscara | `255.255.255.0` |
   | Puerta de enlace | `192.168.50.1` |
   | DNS | `192.168.50.1` |

   Como alternativa, se puede reservar `192.168.50.10` para el servidor en el DHCP del router.

### Tabla de direcciones

| Equipo | Dirección | Cómo la obtiene |
|---|---|---|
| Router | 192.168.50.1 | Fija |
| Servidor (OPS o mini PC) | 192.168.50.10 | Fija |
| OneScreen T7 (Android) | 192.168.50.20 | Fija o reservada en el router |
| Computadores, celulares | 192.168.50.100 a .200 | Automática (DHCP) |

### Celulares y computadores de la sala

No se instala nada en ellos. Basta con estar en la red de la sala y abrir el navegador en
`http://192.168.50.10`. **No hace falta internet**: el celular habla directo con el servidor por el Wi-Fi.

1. Conectarse al Wi-Fi `SystemPlus-Sala` con su contraseña.
2. **Android** muestra "Esta red no tiene acceso a internet". Elegir **Mantener conexión**
   (o "Conectar de todas formas"); si no, el celular vuelve a los datos móviles y no encuentra el servidor.
   Si aun así no abre, apagar los datos móviles mientras se usa el sistema.
3. **iPhone**: funciona igual; si aparece el aviso de "sin conexión a internet", tocar *Usar sin internet*.
4. Abrir Chrome, Safari o Edge, entrar a `http://192.168.50.10` y guardar la página como favorito
   o en la pantalla de inicio (*Agregar a pantalla principal*).
5. Computadores con cable: conectarlos a un puerto LAN del router; reciben la dirección solos.

Desde fuera de la sala (otra red o datos móviles) el sistema **no** se ve: solo existe dentro de esta red.

### Seguridad de la red

- La clave del Wi-Fi (WPA2/WPA3) cifra todo lo que viaja por el aire, incluidas las contraseñas del
  sistema. Por eso la red **nunca** debe quedar abierta y su clave solo se entrega a quien use el sistema.
- El sistema usa `http://` (sin candado). Dentro de una red cerrada con clave es aceptable; si más adelante
  la red de la sala se comparte con otros usuarios o se conecta a la red institucional, se debe activar
  HTTPS en Nginx con un certificado de la institución.
- No conectar el router a internet ni a la red institucional sin revisar primero este punto.

## 6. Preparar el servidor (sin internet)

**Windows (módulo OPS o mini PC con Windows):**

1. Entrar a la BIOS y verificar que la virtualización esté activada.
2. Instalar WSL con el `.msi` de la USB y reiniciar.
3. Instalar Docker Desktop con el instalador de la USB y reiniciar.
4. Abrir Docker Desktop. En *Settings → General* activar **Start Docker Desktop when you sign in**.
5. Evitar que el equipo se suspenda: *Configuración → Sistema → Energía → Suspender: Nunca*.
6. Abrir el puerto 80 en el firewall (PowerShell como administrador):
   ```powershell
   New-NetFirewallRule -DisplayName "System Plus" -Direction Inbound -Protocol TCP -LocalPort 80 -RemoteAddress LocalSubnet -Profile Any -Action Allow
   ```
   `LocalSubnet` permite la entrada solo desde la red de la sala. `-Profile Any` es necesario porque
   Windows suele clasificar como *Pública* una red sin internet.

**Ubuntu Server (mini PC con Linux):** instalar Docker Engine con los paquetes `.deb` descargados
previamente (docker-ce, docker-ce-cli, containerd.io y docker-compose-plugin) usando `sudo dpkg -i *.deb`,
y abrir el puerto con `sudo ufw allow 80/tcp`.

## 7. Instalar System Plus

1. Copiar la carpeta `paquete-systemplus` de la USB al servidor, por ejemplo en `C:\SystemPlus`.
2. Abrir PowerShell en esa carpeta y ejecutar:
   ```powershell
   powershell -ExecutionPolicy Bypass -File deploy\scripts\instalar-servidor.ps1
   ```
3. La primera vez el script crea el archivo `.env` con **claves aleatorias** (base de datos, consola de
   Keycloak, secreto de la API y clave temporal del administrador) y lo abre en el Bloc de notas.
   Solo hay que llenar los datos del primer administrador, sin comillas:
   ```
   ADMIN_CORREO=coordinacion@institucion.edu.co
   ADMIN_NOMBRE=Laura
   ADMIN_APELLIDO=Gómez
   ```
   Guardar y ejecutar el mismo comando otra vez.
4. El script carga las imágenes, inicia los cuatro servicios y al final muestra la dirección para entrar,
   el correo del administrador y su **clave temporal**. La primera vez tarda entre 1 y 3 minutos.
5. Guardar una copia del archivo `.env` en un lugar seguro (por ejemplo, una USB que guarde la coordinación).
   Sin él no se pueden recuperar las claves de la base de datos ni de la consola de Keycloak.

La instalación de la sala **no trae usuarios de prueba**: usa `keycloak/system-plus-realm.produccion.json`,
que solo crea al administrador indicado en `.env`. Las tablas de la base de datos se crean con las
migraciones de la API (no con la sincronización automática de desarrollo), y la documentación técnica
de la API (`/docs`) queda apagada.

Desde ese momento el sistema arranca solo cada vez que se enciende el servidor.

## 8. Después de instalar

1. Entrar desde la pantalla a `http://192.168.50.10` con el correo del administrador y la clave temporal.
   El sistema pide crear una contraseña propia (mínimo 8 caracteres, distinta del correo).
2. Crear los usuarios reales (coordinadores y docentes) con sus correos. Cada uno recibe una clave
   temporal y la cambia al entrar por primera vez.
3. En la pantalla OneScreen, abrir el navegador, entrar a `http://192.168.50.10` y guardarlo como favorito
   o como acceso directo en el inicio.
4. La consola de Keycloak (`http://localhost:8080`) solo abre desde el propio servidor. Su usuario y clave
   están en `.env` (`KEYCLOAK_ADMIN_USER` y `KEYCLOAK_ADMIN_PASSWORD`).

## 9. Pruebas de aceptación

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | Abrir `http://192.168.50.10` desde la OneScreen T7 | Aparece la pantalla de inicio de sesión |
| 2 | Abrirlo desde un computador por cable y desde un celular por Wi-Fi (sin datos móviles) | Igual que en la prueba 1 |
| 3 | Iniciar sesión con cada uno de los cuatro roles | Cada rol ve su menú |
| 4 | Crear una guía en un equipo y consultarla en otro | La guía aparece en ambos |
| 5 | Descargar una guía en PDF y en DOCX | Se descargan los archivos |
| 6 | Desconectar el router de cualquier internet y repetir la prueba 3 | Todo funciona igual |
| 7 | Reiniciar el servidor y esperar 3 minutos | El sistema vuelve a funcionar solo |
| 8 | Ejecutar el respaldo y revisar la carpeta `respaldos` | Hay dos archivos `.sql` con la fecha |

## 10. Mantenimiento

- **Ver el estado:** `docker compose ps` (los cuatro servicios deben decir *running* o *healthy*).
- **Ver errores de la API:** `docker compose logs --tail 100 api`.
- **Respaldo de la base de datos:** `powershell -ExecutionPolicy Bypass -File deploy\scripts\respaldo-bd.ps1`.
  Se recomienda programarlo a diario en el *Programador de tareas* de Windows y copiar la carpeta
  `respaldos` a una USB cada semana.
- **Instalar una versión nueva:** preparar el paquete otra vez (paso 4), copiar `imagenes-systemplus.tar`
  al servidor y ejecutar `instalar-servidor.ps1`. Los datos se conservan.
- **Apagar el sistema:** `docker compose down`. **No** usar `docker compose down -v`: borra la base de datos.

## 11. Problemas frecuentes

| Problema | Causa probable | Solución |
|---|---|---|
| Desde la sala no abre `http://192.168.50.10` | Firewall o IP del servidor | Revisar la regla del puerto 80 y que el servidor tenga la IP fija (`ipconfig`) |
| Abre en el servidor pero no en otros equipos | El equipo está en otra red | Conectarlo al Wi-Fi `SystemPlus-Sala` o al router por cable |
| Abre en computadores pero no en celulares | Aislamiento de clientes del router, o el celular usa datos móviles | Desactivar *AP isolation* en el router; en el celular elegir *Mantener conexión* o apagar los datos |
| El administrador no puede entrar con la clave temporal | El `.env` se cambió después de la primera instalación | Keycloak solo lee los datos del administrador la primera vez; cambiar la clave desde la consola de Keycloak |
| "No pudimos conectar con el servicio de acceso" | Keycloak todavía arranca | Esperar 2 minutos; revisar `docker compose ps` |
| Docker Desktop no inicia | Virtualización desactivada | Activarla en la BIOS |
| La exportación a PDF falla | Error de LibreOffice en la API | `docker compose logs api` y reiniciar con `docker compose restart api` |

## 12. Archivos de la instalación

| Archivo | Para qué sirve |
|---|---|
| `docker-compose.yml` | Define los cuatro servicios y cómo se conectan |
| `intranet.env.example` | Plantilla de parámetros; el instalador la copia como `.env` y genera las claves |
| `keycloak/system-plus-realm.produccion.json` | Realm de la sala: roles y clientes, sin usuarios de prueba (se genera con `deploy/scripts/generar-realm-produccion.mjs`) |
| `gestion-guias/src/database/migrations/` | Migraciones que crean y actualizan las tablas |
| `gestion-guias/Dockerfile` | Imagen de la API, con LibreOffice para exportar PDF |
| `frontend/Dockerfile` | Imagen de las pantallas, servidas con Nginx |
| `deploy/nginx/default.conf` | Única entrada por el puerto 80; pasa `/api` a la API |
| `deploy/postgres/01-crear-bd-keycloak.sh` | Crea la base de datos de Keycloak la primera vez |
| `deploy/scripts/preparar-paquete.ps1` / `.sh` | Construye y empaqueta las imágenes (con internet) |
| `deploy/scripts/instalar-servidor.ps1` / `.sh` | Instala y arranca el sistema (sin internet) |
| `deploy/scripts/respaldo-bd.ps1` / `.sh` | Copia de seguridad de las bases de datos |

Cambios en el frontend para funcionar sin internet:

- La fuente Inter se incluye en el proyecto (`@fontsource/inter`) en lugar de descargarse de Google Fonts.
- La configuración de compilación `intranet` (`environment.intranet.ts`) usa la dirección relativa `/api`,
  así que funciona con cualquier IP del servidor sin volver a compilar.
