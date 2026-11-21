# Se ejecuta en el SERVIDOR de la sala (no necesita internet).
# Requisitos: Docker Desktop instalado y abierto.
#
# Uso (PowerShell, dentro de la carpeta paquete-systemplus copiada de la USB):
#   powershell -ExecutionPolicy Bypass -File deploy\scripts\instalar-servidor.ps1
#
# La primera vez crea el archivo .env con claves aleatorias y lo abre para llenar los datos
# del primer administrador. La segunda vez instala y muestra con qué cuenta entrar.

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..')
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Nueva-Clave {
  $letras = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  $bytes = New-Object byte[] 20
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { $letras[$_ % $letras.Length] })
}

function Leer-Env {
  $valores = @{}
  foreach ($linea in [System.IO.File]::ReadAllLines((Resolve-Path '.env'), $utf8)) {
    if ($linea -match '^\s*([A-Z_]+)=(.*)$') { $valores[$Matches[1]] = $Matches[2].Trim() }
  }
  $valores
}

if (-not (Test-Path '.env')) {
  $texto = [System.IO.File]::ReadAllText((Resolve-Path 'intranet.env.example'), $utf8)
  while ($texto.Contains('se-genera-al-instalar')) {
    $i = $texto.IndexOf('se-genera-al-instalar')
    $texto = $texto.Substring(0, $i) + (Nueva-Clave) + $texto.Substring($i + 'se-genera-al-instalar'.Length)
  }
  [System.IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $texto, $utf8)
  Write-Host 'Se creó el archivo .env con claves aleatorias.'
  Write-Host 'Llene ADMIN_CORREO, ADMIN_NOMBRE y ADMIN_APELLIDO, guarde y vuelva a ejecutar este script.'
  notepad .env
  exit 0
}

$envActual = Leer-Env
foreach ($campo in 'ADMIN_CORREO', 'ADMIN_NOMBRE', 'ADMIN_APELLIDO') {
  if (-not $envActual[$campo]) {
    Write-Host "Falta $campo en el archivo .env. Llénelo y vuelva a ejecutar el script."
    notepad .env
    exit 1
  }
}
if ($envActual['ADMIN_CORREO'] -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
  Write-Host 'ADMIN_CORREO no parece un correo válido. Corríjalo en .env y vuelva a ejecutar el script.'
  exit 1
}
if ((Get-Content .env -Raw) -match 'cambiar-esta-clave|se-genera-al-instalar|dev-secret') {
  Write-Host 'El archivo .env todavía tiene claves de ejemplo. Bórrelo y vuelva a ejecutar el script para generarlas.'
  exit 1
}

# Imágenes: del paquete (sin internet), en .tar o .tar.gz. Si no hay archivo y está el código
# fuente, se construyen aquí mismo (necesita internet).
$imagenes = @('imagenes-systemplus.tar', 'imagenes-systemplus.tar.gz') | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($imagenes) {
  Write-Host "Cargando imágenes desde $imagenes (sin internet)..."
  docker load -i $imagenes
  Write-Host 'Iniciando System Plus...'
  docker compose up -d --no-build
} elseif ((Test-Path 'gestion-guias\Dockerfile') -and (Test-Path 'frontend\Dockerfile')) {
  Write-Host 'No hay archivo de imágenes: se construyen desde el código (necesita internet, 10 a 20 minutos)...'
  docker compose up -d --build
} else {
  Write-Host 'Falta imagenes-systemplus.tar.gz en esta carpeta. Cópielo del paquete y vuelva a ejecutar el script.'
  exit 1
}

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
  Write-Host ''
  Write-Host "Primer ingreso:  $($envActual['ADMIN_CORREO'])"
  Write-Host "Clave temporal:  $($envActual['ADMIN_CLAVE_TEMPORAL'])  (el sistema pide cambiarla al entrar)"
} else {
  Write-Host 'Todavía no responde. Revise con: docker compose logs api'
}
