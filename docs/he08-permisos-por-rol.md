# HE-08-HU-02 Consultar permisos autorizados por rol

Permite al Administrador consultar qué acciones del sistema puede realizar cada rol.

## Cómo funciona

Los permisos no se escriben a mano en una lista aparte: el servicio lee, al iniciar la API,
los decoradores `@Roles` de todos los controladores. Así la consulta muestra exactamente las
reglas que la API hace cumplir.

- Una ruta sin `@Roles` la puede usar cualquier usuario con sesión, por eso aparece en todos los roles.
- Las rutas públicas (`/auth/*`) no se listan.
- El nombre legible de cada acción está en `src/audit/permissions/permission-catalog.ts`.
  Si alguien agrega una ruta nueva y no la describe ahí, la prueba unitaria falla y lo indica.

## Endpoints

Solo rol `admin`. Sin sesión responde 401 y con otro rol 403.

### `GET /audit/permissions`

Resumen de los cuatro roles.

```json
[
  { "role": "admin", "label": "Administrador", "totalPermissions": 17, "areas": ["Auditoría", "..."] },
  { "role": "coordinador", "label": "Coordinador Académico", "totalPermissions": 50, "areas": ["..."] }
]
```

### `GET /audit/permissions/:role`

Detalle de un rol (`admin`, `coordinador`, `docente`, `docente_autorizado`). Los permisos vienen
ordenados por área para que el frontend los agrupe. Un rol que no existe responde 404.

```json
{
  "role": "docente",
  "label": "Docente",
  "totalPermissions": 31,
  "permissions": [
    { "area": "Guías base", "action": "Descargar guías (PDF o DOCX)", "method": "GET", "path": "/academic/guides/:id/export" }
  ]
}
```

## Archivos

| Archivo | Contenido |
|---|---|
| `src/audit/permissions/route-permissions.ts` | Lee rutas y roles de los decoradores |
| `src/audit/permissions/permission-catalog.ts` | Área y nombre legible de cada ruta |
| `src/audit/permissions/role-permissions.service.ts` | Arma el resumen y el detalle por rol |
| `src/audit/permissions/role-permissions.controller.ts` | Endpoints `/audit/permissions` |
| `src/audit/permissions/role-permissions.service.spec.ts` | 12 pruebas unitarias |
