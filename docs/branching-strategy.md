# Estrategia de ramas

Este repositorio usa una estrategia basada en Git Flow simplificado para separar claramente desarrollo/pruebas de producción.

## Ramas principales

- `main`: producción. Solo código estable y desplegable.
- `develop`: integración de desarrollo. Base para nuevas funcionalidades.

## Ramas de trabajo

- `feature/<JIRA-ID>-<descripcion-corta>`: nuevas funcionalidades.
  - Nacen desde `develop`.
  - Se integran a `develop` vía Pull Request.
- `fix/<JIRA-ID>-<descripcion-corta>`: correcciones no urgentes.
  - Nacen desde `develop`.
  - Se integran a `develop` vía Pull Request.
- `release/<version>`: estabilización para salida a producción.
  - Nacen desde `develop`.
  - Solo se permiten fixes de estabilización/documentación.
  - Se integran a `main` y luego de vuelta a `develop`.
- `hotfix/<JIRA-ID>-<descripcion-corta>`: correcciones urgentes en producción.
  - Nacen desde `main`.
  - Se integran a `main` y a `develop`.

## Flujo recomendado

1. Crear rama de trabajo desde `develop`.
2. Abrir PR hacia `develop`.
3. Exigir checks de CI en verde y al menos 1 aprobación.
4. Para liberar: crear `release/<version>` desde `develop`.
5. Al aprobar QA/UAT, hacer PR de `release/<version>` a `main`.
6. Etiquetar versión (`vX.Y.Z`) en `main`.
7. Sincronizar cambios a `develop`.

## Calidad obligatoria

- Lint en verde.
- Tests unitarios en verde.
- (Recomendado) Tests e2e/integración en ramas `release/*` y `main`.
- Sin pushes directos a `main` ni `develop`.

## Convenciones

- Branches vinculadas a Jira cuando aplique.
- Commits recomendados con Conventional Commits:
  - `feat:` nueva funcionalidad
  - `fix:` corrección
  - `chore:` mantenimiento
  - `test:` pruebas
  - `docs:` documentación
