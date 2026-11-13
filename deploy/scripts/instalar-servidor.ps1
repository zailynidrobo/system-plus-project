# Se ejecuta en el SERVIDOR de la sala (no necesita internet).
# Requisitos: Docker Desktop instalado y abierto.
#
# Uso (PowerShell, dentro de la carpeta paquete-systemplus copiada de la USB):
#   powershell -ExecutionPolicy Bypass -File deploy\scripts\instalar-servidor.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..')

if (-not (Test-Path '.env')) {
  Copy-Item intranet.env.example .env
  Write-Host 'Se creó el archivo .env. Ábralo con el Bloc de notas, cambie las contraseñas y vuelva a ejecutar este script.'
  notepad .env
  exit 0
}

Write-Host 'Cargando imágenes desde el archivo (sin internet)...'
docker load -i imagenes-systemplus.tar

Write-Host 'Iniciando System Plus...'
docker compose up -d --no-build

Write-Host 'Esperando a que todo arranque (puede tardar 1 a 3 minutos)...'
$listo = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost/api/' -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $listo = $true; break }
  } catch { }
  Start-Sleep -Seconds 5
}

docker compose ps
if ($listo) {
  $ips = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' }).IPAddress
  Write-Host ''
  Write-Host 'System Plus está funcionando. Desde los equipos de la sala entre a:'
  $ips | ForEach-Object { Write-Host "  http://$_" }
} else {
  Write-Host 'Todavía no responde. Revise con: docker compose logs api'
}
