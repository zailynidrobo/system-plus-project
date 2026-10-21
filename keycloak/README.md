# Keycloak para desarrollo local

`system-plus-realm.json` es el realm **system-plus** listo para importar. Crea todo lo que necesitan el front y el backend:

| Qué | Detalle |
|---|---|
| Roles del realm | `admin`, `coordinador`, `docente`, `docente_autorizado` |
| Client `system-plus-front` | Público, flujo de código con PKCE (S256). Redirect URI y web origin: `http://localhost:4200`. Incluye el mapper que agrega `system-plus-api` al `aud` del token |
| Client `system-plus-api` | Confidencial, con cuenta de servicio. Es la que usa el backend para administrar usuarios; tiene los roles `manage-users`, `view-users`, `query-users` y `view-realm` de `realm-management` |
| Usuarios de prueba | `admin@example.com`, `coordinador@example.com`, `docente@example.com` y `autorizado@example.com`, todos con la contraseña `12345678` |

> **Solo para desarrollo.** El secreto del client `system-plus-api` (`dev-secret-system-plus-api`) y las contraseñas de prueba están escritos en este archivo y son públicos. No los uses en un entorno real: ahí crea el client y sus claves por tu cuenta.

## Levantar Keycloak con el realm

Desde la raíz del repositorio, en Git Bash:

```bash
docker run --name keycloak -p 8080:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  -v "$(pwd -W)/keycloak:/opt/keycloak/data/import" \
  quay.io/keycloak/keycloak:26.3 start-dev --import-realm
```

(En Linux o macOS usa `$(pwd)` en lugar de `$(pwd -W)`.) La consola de administración queda en <http://localhost:8080/admin> con `admin` / `admin`.

El realm solo se importa la primera vez. Para volver a empezar de cero, borra el contenedor con `docker rm -f keycloak` y repite el comando. Las veces siguientes usa `docker start keycloak`.

## Configurar el backend

En `gestion-guias/.env`:

```
KEYCLOAK_ISSUER_URL=http://localhost:8080/realms/system-plus
KEYCLOAK_AUDIENCE=system-plus-api
KEYCLOAK_ADMIN_CLIENT_ID=system-plus-api
KEYCLOAK_ADMIN_CLIENT_SECRET=dev-secret-system-plus-api
```

## Si cambias algo en Keycloak

Si agregas roles, clients o ajustes que el resto del equipo necesite, expórtalo desde **Realm settings → Action → Partial export** y actualiza este archivo. La exportación parcial oculta los secretos y no incluye usuarios: conserva el secreto de desarrollo y la sección `users` de la versión actual.
