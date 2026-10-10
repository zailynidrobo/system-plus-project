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

1. Create a Keycloak realm and configure your client application to obtain access tokens from it.
2. Add an Audience protocol mapper so the access token's `aud` claim includes the API audience.
3. Assign the realm role `admin` to administrators who need `/users` access.
4. Copy `.env.example` to `.env` and set `KEYCLOAK_ISSUER_URL` to the realm issuer URL and
   `KEYCLOAK_AUDIENCE` to the audience configured in Keycloak.
5. Start the API. It fails at startup if either Keycloak setting is missing.

The API does not implement the browser login flow: the client application signs in through
Keycloak and sends the resulting access token to this API. The existing `/users` operations
manage in-memory application user records; they do not create or update Keycloak identities.
Manage Keycloak accounts in Keycloak itself.

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

### Autenticación

Usa la autenticación con Keycloak descrita arriba. Lecturas: cualquier usuario con token válido. Escrituras: rol de realm `coordinador`. Para la auditoría ("Creado por …") se toma `name`, `preferred_username` o `email` del token.

### Endpoints

| HU | Método y ruta | Descripción |
| --- | --- | --- |
| — | `GET /programs` | Programas activos |
| — | `GET /programs/:programId` | Resumen: plan vigente, módulos por estado, guías |
| HU-01 | `POST /programs/:programId/modules` | `{ name, description, draft? }` → código `TS-MOD-NN`. Nombre duplicado (sin distinguir mayúsculas ni espacios) → 409 `MODULE_NAME_DUPLICATED` con `existingModule` |
| HU-01 | `GET /programs/:programId/modules/name-availability?name=&excludeModuleId=` | Validación en vivo del nombre |
| — | `GET /programs/:programId/modules?search=&status=&sort=name\|code\|updatedAt&order=&availableForGuides=true` | Listado con conteo de competencias y guías |
| — | `GET /modules/:moduleId` | Detalle con competencias activas, resumen y auditoría |
| HU-02 | `PATCH /modules/:moduleId` | `{ name?, description? }`; el código y las competencias no cambian |
| HU-01 | `PATCH /modules/:moduleId/register` | Pasa un borrador a activo (exige descripción) |
| HU-03 | `PATCH /modules/:moduleId/deactivate` | `{ reason? }`; sin borrado físico, conserva competencias y guías |
| HU-03 | `PATCH /modules/:moduleId/reactivate` | Revierte la inhabilitación |
| HU-04 | `POST /modules/:moduleId/competencies` | `{ text }` → código `COMP-<SIGLA>-NN` (p. ej. `COMP-POO-05`) |
| HU-04 | `GET /modules/:moduleId/competencies/next-code` | Vista previa del próximo código |
| — | `GET /modules/:moduleId/competencies`, `GET /competencies/:id` | Consulta |
| HU-05 | `PATCH /competencies/:id` | `{ text }`; crea una nueva versión y devuelve `previousText` |
| HU-06 | `DELETE /competencies/:id` | Borrado lógico; el código nunca se reutiliza |
| — | `GET /competencies/:id/history`, `GET /competencies/:id/versions/:version` | Trazabilidad (incluye competencias eliminadas) |

### Reglas de negocio

- Solo los módulos **activos** admiten competencias; los borradores e inhabilitados responden 409.
- Un módulo está disponible para nuevas guías (`availableForGuides`) si está activo y tiene al menos una competencia activa. `CurricularModulesService.assertAvailableForGuides()` está exportado para HE-03.
- Las guías publicadas deben guardar `competencyId` + `version`; `CompetenciesService.findVersion()` devuelve esa redacción aunque la competencia se haya editado o eliminado después.
- Los conteos de guías vienen de `GuideStatsProvider`. Hasta que HE-03 persista sus guías se usa `EmptyGuideStatsProvider` (todo en 0); basta con registrar la implementación real en `AcademicProgramModule`.

## Academic API (legacy, en memoria)

> Las rutas `/academic/modules` y `/academic/competencies` son la versión preliminar en memoria y quedan reemplazadas por HE-02 (arriba). Se mantienen mientras las guías (`/academic/guides`) dependan de ellas.


The academic endpoints are available under `/academic`. Example workflow:

1. `POST /academic/modules` with `{ "name": "Matemáticas" }`.
2. `POST /academic/competencies` with `{ "name": "Álgebra" }`.
3. `POST /academic/modules/:moduleId/competencies/:competencyId` to associate them.
4. Configure guide fields with `PUT /academic/modules/:moduleId/guide-fields`, or use the competency-specific route:
   `PUT /academic/modules/:moduleId/competencies/:competencyId/guide-fields`.
5. Create a draft using `POST /academic/guides`, edit it with `PATCH /academic/guides/:id`, and publish it with `PATCH /academic/guides/:id/publish`.

Additional module and competency read/update/deactivation/deletion operations are available under `/academic/modules` and `/academic/competencies`. Module deactivation retains its competencies and existing guide snapshots. Competency deletion removes its module associations and field configuration, while existing guides retain their copied names and form definitions. Published guides cannot be edited. Data is stored in memory and is cleared when the server restarts.

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
