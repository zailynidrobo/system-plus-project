#!/bin/sh
# Igual que instalar-servidor.ps1, para un servidor Linux. No necesita internet.
set -e
cd "$(dirname "$0")/../.."

if [ ! -f .env ]; then
  cp intranet.env.example .env
  echo "Se creó .env. Cambie las contraseñas (nano .env) y vuelva a ejecutar este script."
  exit 0
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
