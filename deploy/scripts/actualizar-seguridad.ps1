# Aplica la política de contraseñas acordada con el cliente en una instalación que ya existe.
# Keycloak solo importa el realm la primera vez; este script actualiza el realm ya creado.
# Ejecutar una vez después de instalar una versión nueva:
#   powershell -ExecutionPolicy Bypass -File deploy\scripts\actualizar-seguridad.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..')

$politica = 'length(8) and upperCase(1) and lowerCase(1) and digits(1) and notUsername and notEmail'
$kcadm = '/opt/keycloak/bin/kcadm.sh'
$login = "$kcadm config credentials --config /tmp/kcadm.config --server http://localhost:8080 --realm master --user `"`$KC_BOOTSTRAP_ADMIN_USERNAME`" --password `"`$KC_BOOTSTRAP_ADMIN_PASSWORD`""
$cambio = "$kcadm update realms/system-plus --config /tmp/kcadm.config -s 'passwordPolicy=$politica'"

docker compose exec -T keycloak bash -c "$login && $cambio"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo actualizar la política de contraseñas en Keycloak.' }
Write-Host 'Listo: las contraseñas nuevas deben tener mínimo 8 caracteres, con mayúscula, minúscula y número.'
