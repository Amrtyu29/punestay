# Sets up a self-contained PostgreSQL 16 + PostGIS 3.6 server WITHOUT Docker and without admin rights.
# Everything lives under %LOCALAPPDATA%\PuneStay (outside OneDrive, so large files are not synced):
#   downloads\   the two official zips (EDB PostgreSQL binaries, OSGeo PostGIS bundle)
#   pgsql\       the PostgreSQL + PostGIS program files
#   pgdata\      the database cluster
#   pg.log       server log
#
# Usage (from the project root):
#   powershell -ExecutionPolicy Bypass -File scripts\setup_portable_pg.ps1
# Afterwards:  scripts\pg_start.ps1  /  scripts\pg_stop.ps1
#
# The connection details match .env.example: user punestay / password punestay, db punestay, port 5433.

param(
    [string]$Root = "$env:LOCALAPPDATA\PuneStay",
    [int]$Port = 5433,
    [string]$User = "punestay",
    [string]$Password = "punestay",
    [string]$Db = "punestay",
    [string]$PgZip = "",
    [string]$BundleDir = ""
)

$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $PSScriptRoot
$pg = Join-Path $Root "pgsql"
$data = Join-Path $Root "pgdata"
$log = Join-Path $Root "pg.log"

if (-not $PgZip) {
    $PgZip = Get-ChildItem (Join-Path $Root "downloads\postgresql") -Filter "postgresql-16*-windows-x64-binaries.zip" |
        Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $BundleDir) {
    $BundleDir = Get-ChildItem (Join-Path $Root "downloads\postgis\unzipped") -Directory -Filter "postgis-bundle-pg16*" |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not (Test-Path $PgZip)) { throw "PostgreSQL zip not found. Download from https://www.enterprisedb.com/download-postgresql-binaries into $Root\downloads\postgresql" }
if (-not (Test-Path $BundleDir)) { throw "PostGIS bundle not found. Download from https://download.osgeo.org/postgis/windows/pg16/ and unzip into $Root\downloads\postgis\unzipped" }

# 1. Program files
if (-not (Test-Path (Join-Path $pg "bin\pg_ctl.exe"))) {
    Write-Host "Unpacking PostgreSQL binaries..."
    $tmp = Join-Path $Root "pg_tmp"
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    Expand-Archive -Path $PgZip -DestinationPath $tmp -Force
    Move-Item (Join-Path $tmp "pgsql") $pg
    Remove-Item $tmp -Recurse -Force
}
if (-not (Test-Path (Join-Path $pg "share\extension\postgis.control"))) {
    Write-Host "Adding PostGIS bundle (postgis, pgrouting, ogr_fdw, ...)..."
    foreach ($d in "bin", "lib", "share", "gdal-data", "utils") {
        $src = Join-Path $BundleDir $d
        if (Test-Path $src) { Copy-Item "$src\*" (Join-Path $pg $d) -Recurse -Force }
    }
}
& (Join-Path $pg "bin\postgres.exe") --version

# 2. Cluster
if (-not (Test-Path (Join-Path $data "PG_VERSION"))) {
    Write-Host "Creating database cluster in $data ..."
    $pwfile = Join-Path $Root "pwfile.txt"
    [IO.File]::WriteAllText($pwfile, $Password)
    & (Join-Path $pg "bin\initdb.exe") -D $data -U $User --auth=scram-sha-256 --pwfile=$pwfile -E UTF8 --locale=C | Out-Null
    Remove-Item $pwfile
    Add-Content (Join-Path $data "postgresql.conf") "`r`n# PuneStay`r`nport = $Port`r`nlisten_addresses = 'localhost'`r`nshared_buffers = 256MB`r`nwork_mem = 32MB`r`nmax_connections = 50`r`n"
}

# 3. Start
& (Join-Path $PSScriptRoot "pg_start.ps1") -Root $Root -Port $Port

# 4. Database + schema
$env:PGPASSWORD = $Password
$psql = Join-Path $pg "bin\psql.exe"
$exists = & $psql -h localhost -p $Port -U $User -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$Db'"
if (-not $exists) {
    Write-Host "Creating database $Db ..."
    & $psql -h localhost -p $Port -U $User -d postgres -c "CREATE DATABASE $Db" | Out-Null
}
$hasTables = & $psql -h localhost -p $Port -U $User -d $Db -tAc "SELECT to_regclass('public.listings') IS NOT NULL"
if ($hasTables -ne "t") {
    Write-Host "Applying schema db\init\01_schema.sql ..."
    & $psql -h localhost -p $Port -U $User -d $Db -v ON_ERROR_STOP=1 -q -f (Join-Path $project "db\init\01_schema.sql")
}
& $psql -h localhost -p $Port -U $User -d $Db -c "SELECT postgis_full_version()"
& $psql -h localhost -p $Port -U $User -d $Db -c "\dt"
Write-Host ""
Write-Host "Ready. Connection: host=localhost port=$Port user=$User dbname=$Db"
Write-Host "Stop with:  powershell -ExecutionPolicy Bypass -File scripts\pg_stop.ps1"
