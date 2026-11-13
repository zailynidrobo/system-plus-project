#!/bin/sh
# Igual que preparar-paquete.ps1, para Linux o macOS. Requiere internet y Docker.
set -e
cd "$(dirname "$0")/../.."

VERSION=1.0
export VERSION
docker pull postgres:16-alpine
docker pull quay.io/keycloak/keycloak:26.3.5
docker compose --env-file intranet.env.example build

SALIDA=paquete-systemplus
mkdir -p "$SALIDA/keycloak"
docker save -o "$SALIDA/imagenes-systemplus.tar" \
  postgres:16-alpine quay.io/keycloak/keycloak:26.3.5 \
  "systemplus/api:$VERSION" "systemplus/web:$VERSION"
cp docker-compose.yml intranet.env.example "$SALIDA/"
cp -r deploy "$SALIDA/"
cp keycloak/system-plus-realm.json "$SALIDA/keycloak/"
echo "Listo. Copie la carpeta $SALIDA a una USB y llévela al servidor."
