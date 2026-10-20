# Starts the portable PostgreSQL server set up by setup_portable_pg.ps1 (no-op if already running).
param([string]$Root = "$env:LOCALAPPDATA\PuneStay", [int]$Port = 5433)
$ErrorActionPreference = "Stop"
$pg = Join-Path $Root "pgsql"
$data = Join-Path $Root "pgdata"
$log = Join-Path $Root "pg.log"
$ctl = Join-Path $pg "bin\pg_ctl.exe"
if (-not (Test-Path $ctl)) { throw "Portable PostgreSQL not found at $pg. Run scripts\setup_portable_pg.ps1 first." }

# PostGIS needs these to find PROJ and GDAL data files.
$env:PROJ_LIB = (Get-ChildItem (Join-Path $pg "share\contrib") -Directory -Filter "postgis-*" | Select-Object -First 1 | ForEach-Object { Join-Path $_.FullName "proj" })
$env:GDAL_DATA = Join-Path $pg "gdal-data"

& $ctl -D $data status *> $null
if ($LASTEXITCODE -eq 0) { Write-Host "PostgreSQL already running on port $Port"; exit 0 }
& $ctl -D $data -l $log -o "-p $Port" -w start
Write-Host "PostgreSQL started on port $Port (log: $log)"
