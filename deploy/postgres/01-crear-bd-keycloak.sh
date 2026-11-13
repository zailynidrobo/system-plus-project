#!/bin/sh
# Crea la base de datos de Keycloak la primera vez que arranca PostgreSQL.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE DATABASE keycloak;
SQL
