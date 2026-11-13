#!/bin/sh
# Copia de seguridad de las dos bases (programarla con cron, por ejemplo a diario).
set -e
cd "$(dirname "$0")/../.."
USUARIO=$(grep '^DB_USER=' .env | cut -d= -f2)
BASE_APP=$(grep '^DB_NAME=' .env | cut -d= -f2)
FECHA=$(date +%Y-%m-%d_%H%M)
mkdir -p respaldos
for BD in "$BASE_APP" keycloak; do
  docker compose exec -T db pg_dump -U "$USUARIO" "$BD" > "respaldos/${BD}_${FECHA}.sql"
  echo "Respaldo creado: respaldos/${BD}_${FECHA}.sql"
done
ls -t respaldos/*.sql | tail -n +29 | xargs -r rm --
