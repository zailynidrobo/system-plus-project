#!/usr/bin/env bash
# Aplica la política de contraseñas acordada con el cliente en una instalación que ya existe.
# Keycloak solo importa el realm la primera vez; este script actualiza el realm ya creado.
#   bash deploy/scripts/actualizar-seguridad.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

POLITICA='length(8) and upperCase(1) and lowerCase(1) and digits(1) and notUsername and notEmail'
docker compose exec -T keycloak bash -c '
  /opt/keycloak/bin/kcadm.sh config credentials --config /tmp/kcadm.config \
    --server http://localhost:8080 --realm master \
    --user "$KC_BOOTSTRAP_ADMIN_USERNAME" --password "$KC_BOOTSTRAP_ADMIN_PASSWORD"
  /opt/keycloak/bin/kcadm.sh update realms/system-plus --config /tmp/kcadm.config \
    -s "passwordPolicy='"$POLITICA"'"
'
echo "Listo: las contraseñas nuevas deben tener mínimo 8 caracteres, con mayúscula, minúscula y número."
