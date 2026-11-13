# Copia de seguridad de la base de datos (guías, módulos, sugerencias y usuarios de Keycloak).
# Se recomienda programarlo a diario con el Programador de tareas de Windows.
#   powershell -ExecutionPolicy Bypass -File deploy\scripts\respaldo-bd.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..')

function Leer($clave) { (Select-String -Path .env -Pattern "^$clave=(.*)$").Matches[0].Groups[1].Value.Trim() }
$usuario = Leer 'DB_USER'
$baseApp = Leer 'DB_NAME'
$fecha = Get-Date -Format 'yyyy-MM-dd_HHmm'
New-Item -ItemType Directory -Force -Path respaldos | Out-Null

foreach ($bd in @($baseApp, 'keycloak')) {
  $archivo = "respaldos\$bd`_$fecha.sql"
  # Se redirige con cmd para que PowerShell no cambie la codificación del archivo.
  cmd /c "docker compose exec -T db pg_dump -U $usuario $bd > $archivo"
  if ($LASTEXITCODE -ne 0) { throw "Falló el respaldo de $bd" }
  Write-Host "Respaldo creado: $archivo"
}

# Conserva solo los últimos 14 respaldos de cada base.
Get-ChildItem respaldos\*.sql | Sort-Object LastWriteTime -Descending | Select-Object -Skip 28 | Remove-Item
