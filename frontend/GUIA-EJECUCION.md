# Guía de ejecución del frontend (Windows)

Frontend de la intranet AthenaDev · System Plus Piendamó. Usa Angular 21 con npm.

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

Abre <http://localhost:4200>. La app se recarga sola al guardar cambios. Para detenerla, pulsa `Ctrl + C`.

## 4. Compilar

```powershell
npx ng build --configuration development   # compilación rápida para depurar
npx ng build                               # producción (sale en dist\frontend)
```

La compilación de producción muestra advertencias de *budget* en algunos `.scss`. Son solo avisos: el límite de error es 8 kB y ninguno lo alcanza.

## 5. Pruebas

```powershell
npx ng test --watch=false   # una sola pasada
npx ng test                 # modo observación
```

Estado actual: 9 de 9 pruebas pasan. El archivo `src/app/core/interceptors/auth-interceptor.spec.ts` falla con "No test suite found" porque contiene código del interceptor en lugar de pruebas. Está documentado en `docs/verificacion-front-HE01-HE05.md`.

## 6. Usuarios de prueba (mock)

Están definidos en `src/app/core/auth/auth.ts`.

| Correo | Contraseña | Rol | Notas |
|---|---|---|---|
| `admin@systemplus.edu.co` | `123456` | Administrador | Entra a la gestión de usuarios. |
| `coordinador@systemplus.edu.co` | `123456` | Coordinador Académico | ⚠️ Hoy vuelve al login: aún no hay pantallas para este rol. |
| `docente@systemplus.edu.co` | `123456` | Docente | ⚠️ Igual que el coordinador. |
| `inactivo@systemplus.edu.co` | `123456` | Docente (desactivado) | Sirve para probar que un usuario desactivado no puede entrar. |

Los usuarios que aparecen en el listado `/usuarios` son **otro mock** (`src/app/features/users/user-api.ts`). Esos usuarios no pueden iniciar sesión y los cambios se pierden al recargar la página.

## 7. Pasar de los mocks al backend real

Hoy **no basta con cambiar un interruptor**. Estos son los pasos:

1. **Login.** En `src/app/core/auth/auth.ts` cambia `USE_MOCK` a `false` y ajusta `API_URL`. El front espera `POST {API_URL}/auth/login` con `{ correo, contrasena }` y una respuesta `{ token, usuario }`.
   - El backend NestJS (`gestion-guias`, rama `develop`) **no tiene ese endpoint**: autentica con Keycloak. Hay que acordar el flujo con el equipo de backend.
2. **Token.** `src/app/core/interceptors/auth-interceptor.ts` todavía no agrega el encabezado `Authorization`. Hay que completarlo.
3. **Usuarios.** `src/app/features/users/user-api.ts` es solo mock. Hay que reescribir sus métodos con `HttpClient` contra `/users` del backend.
4. **Formato de datos.** El backend usa `name`, `email`, `role` (`admin`, `coordinador`…) e `isActive`. El front usa `nombre`, `correo`, `rol` (`ADMINISTRADOR`…) y `activo`. Hace falta un adaptador.
5. **Ruta y CORS.** El backend escucha en `http://localhost:3000`, sin el prefijo `/api` y sin CORS habilitado. Hay dos opciones:
   - Pedir al backend `app.setGlobalPrefix('api')` y `app.enableCors({ origin: 'http://localhost:4200' })`.
   - Crear un `proxy.conf.json` en Angular.

## 8. Problemas comunes

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

**Después de iniciar sesión vuelvo a la pantalla de login**
Si entraste con el coordinador o el docente, es el comportamiento actual (ver la sección 6). Prueba con `admin@systemplus.edu.co`.
