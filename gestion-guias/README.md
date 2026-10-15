<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Authentication and authorization

All API routes except `GET /` require a valid Keycloak access token in
`Authorization: Bearer <token>`. The routes under `/users` additionally require
the Keycloak realm role `admin`. The API validates JWT signatures using the
realm's JWKS endpoint and checks both the issuer and audience.

To configure the API:

1. In the Keycloak Admin Console, create a realm by importing `keycloak/system-plus-realm.json`.
   This creates the `system-plus` realm, roles `admin`, `coordinador`, `docente`, and
   `docente_autorizado`, and the `system-plus-client` and `system-plus-api` clients.
2. Copy `.env.example` to `.env`. Its `KEYCLOAK_ISSUER_URL` and `KEYCLOAK_AUDIENCE`
   values already match the imported realm and API client.
3. Create users in the imported realm and assign the needed realm role under **Role mapping**.
   For local Postman testing, `system-plus-client` has Direct Access Grants enabled; use its
   client ID with the user's credentials to request a token.
4. Create a confidential OIDC client `system-plus-user-admin` in the realm. Enable **Client
   authentication** and **Service accounts roles**, then open its service account's **Role
   mapping**. From client roles → `realm-management`, assign `manage-users`, `view-users`,
   `query-users`, and `view-realm`. The realm import includes this service-account client; if
   it is already present, open that client instead of creating a duplicate. Copy the client's
   secret from its **Credentials** tab.
5. Put that secret in `.env` as `KEYCLOAK_ADMIN_CLIENT_SECRET` (keep the ID
   `system-plus-user-admin` in `KEYCLOAK_ADMIN_CLIENT_ID`). Never commit or share this secret.
6. Start the API. It loads `.env` from the `gestion-guias` package directory, even if the
   command is launched from the repository root. It fails at startup if the issuer or audience
   is missing; user-management requests also require the administrative client credentials
   above.

To import into the Keycloak instance already running locally, open
`http://localhost:8080/admin`, sign in as an administrator, choose **Create realm**, and select
the `keycloak/system-plus-realm.json` file using the import option. If the `system-plus` realm
already exists, do not import again; assign the required roles to its users or delete/recreate
the realm only if you are sure it contains no data you need.

The API does not implement the browser login flow: the client application signs in through
Keycloak and sends the resulting access token to this API.

### HE-01 — Usuarios, roles y permisos (sobre Keycloak)

Los usuarios **viven en Keycloak**; `/users` es un puente hacia la API de administración de Keycloak
(no hay tabla de usuarios en PostgreSQL). Crear, editar, desactivar y cambiar el rol desde `/users`
modifica directamente el usuario en Keycloak. El rol es un *realm role* (`admin`, `coordinador`,
`docente`, `docente_autorizado`); cada usuario tiene uno solo.

Para que la API pueda administrar usuarios necesita su propia cuenta de servicio:

1. En el realm, **Clients → Create client**: Client ID `system-plus-api`, *Client authentication* ON,
   *Service accounts roles* ON, y *Standard flow* OFF.
2. En la pestaña **Credentials** copia el *Client secret* a `KEYCLOAK_ADMIN_CLIENT_SECRET` en `.env`.
3. En **Service accounts roles → Assign role → Filter by clients**, asigna del client
   `realm-management`: `manage-users`, `view-users`, `query-users` y `view-realm`.
4. Asegúrate de que existen los realm roles `admin`, `coordinador`, `docente` y `docente_autorizado`.

Variables: `KEYCLOAK_ADMIN_CLIENT_ID` (por defecto `system-plus-api`), `KEYCLOAK_ADMIN_CLIENT_SECRET`
y `CORS_ORIGIN` (orígenes del front separados por coma; por defecto `http://localhost:4200`).

Contraseñas: toda contraseña queda como **temporal** (el usuario debe cambiarla al primer ingreso).
Si `POST /users` no recibe `password`, la API genera una y la devuelve una sola vez en
`temporaryPassword`.

## HE-02 — Gestión del programa académico (módulos y competencias)

Implementado en [src/academic-program](src/academic-program) (componente "Programa, módulos y competencias" del diagrama de componentes) con PostgreSQL + TypeORM.

### Configuración

1. Copia `.env.example` como `.env` y ajusta Keycloak y las credenciales de tu PostgreSQL local. Crea la base vacía (`gestion_guias`); con `DB_SYNCHRONIZE=true` las tablas se crean solas al arrancar.
2. Para las pruebas e2e copia `.env.example` como `.env.test` con una base distinta cuyo nombre termine en `_test` (las pruebas la reinician).
3. Al arrancar se crea el programa **Técnico en Sistemas · Sede Piendamó** (código `TS`).

```powershell
pnpm.cmd install
pnpm.cmd run start:dev
pnpm.cmd run test        # unitarias
pnpm.cmd run test:e2e    # requiere .env.test
```

`DB_SYNCHRONIZE=true` crea las tablas de persistencia de guías al iniciar en desarrollo. Las
pruebas e2e reinician la base configurada, por lo que `DB_NAME` en `.env.test` debe terminar
en `_test` y apuntar a una base distinta de la de desarrollo.

### Autenticación

Usa la autenticación con Keycloak descrita arriba. Lecturas: cualquier usuario con token válido. Escrituras: rol de realm `coordinador`. Para la auditoría ("Creado por …") se toma `name`, `preferred_username` o `email` del token.

### Endpoints

| HU    | Método y ruta                                                                                                | Descripción                                                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| —     | `GET /programs`                                                                                              | Programas activos                                                                                                                                                  |
| —     | `GET /programs/:programId`                                                                                   | Resumen: plan vigente, módulos por estado, guías                                                                                                                   |
| HU-01 | `POST /programs/:programId/modules`                                                                          | `{ name, description, draft? }` → código `TS-MOD-NN`. Nombre duplicado (sin distinguir mayúsculas ni espacios) → 409 `MODULE_NAME_DUPLICATED` con `existingModule` |
| HU-01 | `GET /programs/:programId/modules/name-availability?name=&excludeModuleId=`                                  | Validación en vivo del nombre                                                                                                                                      |
| —     | `GET /programs/:programId/modules?search=&status=&sort=name\|code\|updatedAt&order=&availableForGuides=true` | Listado con conteo de competencias y guías                                                                                                                         |
| —     | `GET /modules/:moduleId`                                                                                     | Detalle con competencias activas, resumen y auditoría                                                                                                              |
| HU-02 | `PATCH /modules/:moduleId`                                                                                   | `{ name?, description? }`; el código y las competencias no cambian                                                                                                 |
| HU-01 | `PATCH /modules/:moduleId/register`                                                                          | Pasa un borrador a activo (exige descripción)                                                                                                                      |
| HU-03 | `PATCH /modules/:moduleId/deactivate`                                                                        | `{ reason? }`; sin borrado físico, conserva competencias y guías                                                                                                   |
| HU-03 | `PATCH /modules/:moduleId/reactivate`                                                                        | Revierte la inhabilitación                                                                                                                                         |
| HU-04 | `POST /modules/:moduleId/competencies`                                                                       | `{ text }` → código `COMP-<SIGLA>-NN` (p. ej. `COMP-POO-05`)                                                                                                       |
| HU-04 | `GET /modules/:moduleId/competencies/next-code`                                                              | Vista previa del próximo código                                                                                                                                    |
| —     | `GET /modules/:moduleId/competencies`, `GET /competencies/:id`                                               | Consulta                                                                                                                                                           |
| HU-05 | `PATCH /competencies/:id`                                                                                    | `{ text }`; crea una nueva versión y devuelve `previousText`                                                                                                       |
| HU-06 | `DELETE /competencies/:id`                                                                                   | Borrado lógico; el código nunca se reutiliza                                                                                                                       |
| —     | `GET /competencies/:id/history`, `GET /competencies/:id/versions/:version`                                   | Trazabilidad (incluye competencias eliminadas)                                                                                                                     |

### Reglas de negocio

- Solo los módulos **activos** admiten competencias; los borradores e inhabilitados responden 409.
- Un módulo está disponible para nuevas guías (`availableForGuides`) si está activo y tiene al menos una competencia activa. `CurricularModulesService.assertAvailableForGuides()` está exportado para HE-03.
- Las guías publicadas deben guardar `competencyId` + `version`; `CompetenciesService.findVersion()` devuelve esa redacción aunque la competencia se haya editado o eliminado después.
- Los conteos de guías vienen de `GuideStatsProvider`, implementado por `TypeOrmGuideStatsProvider` (módulo de guías): cuenta las guías reales por módulo y las publicadas por competencia.

## Guías, formularios y versiones docentes (HE-03 / HE-04)

> Los módulos y competencias son los de **HE-02** (tablas `curricular_modules` y `competencies`).
> Las guías guardan su `moduleId` y `competencyId` (UUID de HE-02); no existen rutas
> `/academic/modules` ni `/academic/competencies`: se administran con las rutas de HE-02 (arriba).
> Una guía nueva solo se crea sobre un módulo **activo con al menos una competencia activa**
> (`MODULE_NOT_ACTIVE` / `MODULE_WITHOUT_COMPETENCIES`), y la competencia debe pertenecer a ese módulo.
> Al crear la guía se guarda una copia del nombre del módulo y del código y texto de la competencia
> (`COMP-POO-01 · …`), de modo que las guías existentes no cambian si luego se edita o elimina.

The academic endpoints are available under `/academic`. HE-03 guide administration and
configurable forms require the Keycloak realm role `coordinador`. HE-04 consultation and
personalized versions require `docente`. A teacher's module assignments are keyed by their
Keycloak `sub`; coordinators manage assignments using the routes below.

1. Create the module and its competencies with the HE-02 routes described above
   (`POST /programs/:programId/modules` and `POST /modules/:moduleId/competencies`).
2. Assign a teacher with `PUT /academic/modules/:moduleId/teachers/:teacherId`.
3. Configure module form fields with `PUT /academic/modules/:moduleId/guide-fields`, or use
   `PUT /academic/modules/:moduleId/competencies/:competencyId/guide-fields`.
4. As coordinator, preview the next code with
   `GET /academic/modules/:moduleId/guides/next-code`, then create a draft using
   `POST /academic/guides` with `{ "moduleId", "competencyId", "content" }`. The API requires
   a competency from that module and generates the title (`Guía base · <module>`), code,
   structure version, and initial content version. Edit it with `PATCH /academic/guides/:id`
   and publish it with `PATCH /academic/guides/:id/publish`.
5. Read a guide's audit history with `GET /academic/guides/:id/events`. Events include the
   action, actor, and timestamp; their visibility follows the same coordinator/assigned-teacher
   access rules as the guide.
6. As an assigned teacher, list published guides with `GET /academic/guides?moduleId=:moduleId`,
   then create a personal copy with `POST /academic/guides/:guideId/personalized-versions`.
7. Read and progressively edit only your copies with
   `GET /academic/personalized-versions`, `GET /academic/personalized-versions/:id`, and
   `PATCH /academic/personalized-versions/:id` using `{ "content": { "fieldKey": "value" } }`.
8. Configure the teacher-form fields independently with
   `PUT /academic/modules/:moduleId/teacher-guide-fields`. Form fields accept `section` and
   `description` so exports remain grouped into the configurable document sections.
9. As coordinator, upload one supporting PDF or DOCX per request to
   `POST /academic/guides/:guideId/support-materials` as multipart form data with the file in
   the `file` field (maximum 10 MB). The original file is stored in PostgreSQL and is not
   editable by the API.
10. Coordinators and assigned teachers can list materials with
   `GET /academic/guides/:guideId/support-materials`; teachers can only access materials for
   published guides in their assigned modules. Download an original file with
   `GET /academic/guides/:guideId/support-materials/:materialId/download`.
11. Download the current guide or teacher version in either format:
    `GET /academic/guides/:id/export?format=docx|pdf` and
    `GET /academic/personalized-versions/:id/export?format=docx|pdf`.

Module and competency read/update/deactivation/deletion operations belong to HE-02 (`/modules/...` and `/competencies/...`). Deactivating a module retains its competencies and existing guide snapshots. Deleting a competency is a soft delete in HE-02, while existing guides retain their copied names and form definitions. Published guides cannot be edited. These records and teacher assignments persist in PostgreSQL and survive API restarts.

Guide definitions keep a snapshot of their configured field definitions and entered values,
the structure version used at creation, and a content version (`v0` for drafts, `v1.0` when
published), so later form changes do not alter existing guides. Field configurations increment
their version each time they are changed. A guide reports `competencyDeleted` when its linked
competency is later soft-deleted, while retaining its copied competency name. Personalized versions similarly snapshot
the published guide's fields and content; editing a copy never writes to its base guide.
Guide and personalized-version snapshots, content, and configured fields are stored as JSONB;
module/competency metadata, field configurations, teacher assignments, and supporting file
contents (PostgreSQL `bytea`) are also persisted in dedicated tables. During local development,
`DB_SYNCHRONIZE=true` creates or updates the tables from the TypeORM entities on startup. For
environments where synchronization is disabled, apply equivalent database migrations before
starting the API.
DOCX and PDF exports use the institutional Word templates in
`src/academic/templates/guia-base-modulo.docx` (Plantilla A) and
`src/academic/templates/guia-docente.docx` (Plantilla B), fill supported module, competency,
topic, and teacher fields, and keep additional configured fields in a final section. PDF export
converts the populated DOCX template with LibreOffice, so LibreOffice must be installed on the API
server and `soffice` must be available on `PATH` (`soffice.com` on Windows). Set
`LIBREOFFICE_PATH` to the executable path if it is installed elsewhere; on Windows, use
`soffice.com` so the API waits for the conversion to finish. The source template files are copied
into `dist` during builds and are never modified by an export.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

To add it to this project:

```bash
$ pnpm install @nestjs/observe
```

Then follow the [setup guide](https://docs.nestjs.com/observability/overview) - it takes a single import and an app key.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
