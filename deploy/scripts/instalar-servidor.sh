#!/bin/sh
# Igual que instalar-servidor.ps1, para un servidor Linux. No necesita internet.
# La primera vez crea .env con claves aleatorias; la segunda instala.
set -e
cd "$(dirname "$0")/../.."

nueva_clave() { tr -dc 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789' </dev/urandom | head -c 20; }

if [ ! -f .env ]; then
  cp intranet.env.example .env
  while grep -q 'se-genera-al-instalar' .env; do
    sed -i "0,/se-genera-al-instalar/s//$(nueva_clave)/" .env
  done
  chmod 600 .env
  echo "Se creó .env con claves aleatorias. Llene ADMIN_CORREO, ADMIN_NOMBRE y ADMIN_APELLIDO (nano .env) y vuelva a ejecutar este script."
  exit 0
fi

valor() { sed -n "s/^$1=//p" .env | head -n 1; }
for campo in ADMIN_CORREO ADMIN_NOMBRE ADMIN_APELLIDO; do
  [ -n "$(valor $campo)" ] || { echo "Falta $campo en .env. Llénelo y vuelva a ejecutar el script."; exit 1; }
done
if grep -Eq 'cambiar-esta-clave|se-genera-al-instalar|dev-secret' .env; then
  echo "El archivo .env todavía tiene claves de ejemplo. Bórrelo y vuelva a ejecutar el script para generarlas."
  exit 1
fi

docker load -i imagenes-systemplus.tar
docker compose up -d --no-build

echo "Esperando a que todo arranque (1 a 3 minutos)..."
i=0
until curl -fs http://localhost/api/ >/dev/null 2>&1; do
  i=$((i+1)); [ $i -gt 60 ] && { echo "No responde. Revise: docker compose logs api"; exit 1; }
  sleep 5
done
docker compose ps
echo "System Plus está funcionando. Desde la sala entre a: http://$(hostname -I | awk '{print $1}')"
echo "Primer ingreso: $(valor ADMIN_CORREO)"
echo "Clave temporal: $(valor ADMIN_CLAVE_TEMPORAL) (el sistema pide cambiarla al entrar)"
