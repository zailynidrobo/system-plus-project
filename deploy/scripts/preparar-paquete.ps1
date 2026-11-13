# Se ejecuta UNA vez en un computador CON internet y con Docker Desktop.
# Construye las imágenes y las guarda en un solo archivo para llevarlo en USB al servidor de la sala.
#
# Uso (PowerShell, en la carpeta del proyecto):
#   powershell -ExecutionPolicy Bypass -File deploy\scripts\preparar-paquete.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..')

$version = '1.0'
$imagenes = @(
  'postgres:16-alpine',
  'quay.io/keycloak/keycloak:26.3.5',
  "systemplus/api:$version",
  "systemplus/web:$version"
)

Write-Host 'Descargando imágenes base...'
docker pull postgres:16-alpine
docker pull quay.io/keycloak/keycloak:26.3.5

Write-Host 'Construyendo API y pantallas (tarda varios minutos la primera vez)...'
$env:VERSION = $version
docker compose --env-file intranet.env.example build

$salida = 'paquete-systemplus'
New-Item -ItemType Directory -Force -Path $salida | Out-Null

Write-Host 'Guardando imágenes en un archivo...'
docker save -o "$salida\imagenes-systemplus.tar" $imagenes

Write-Host 'Copiando archivos de configuración...'
Copy-Item docker-compose.yml, intranet.env.example $salida -Force
Copy-Item deploy $salida -Recurse -Force
New-Item -ItemType Directory -Force -Path "$salida\keycloak" | Out-Null
Copy-Item keycloak\system-plus-realm.json "$salida\keycloak\" -Force

Write-Host ''
Write-Host "Listo. Copie la carpeta '$salida' completa a una USB y llévela al servidor."
