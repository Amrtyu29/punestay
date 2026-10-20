# Stops the portable PostgreSQL server.
param([string]$Root = "$env:LOCALAPPDATA\PuneStay")
$ctl = Join-Path $Root "pgsql\bin\pg_ctl.exe"
$data = Join-Path $Root "pgdata"
if (-not (Test-Path $ctl)) { Write-Host "Portable PostgreSQL not installed."; exit 0 }
& $ctl -D $data -m fast stop
