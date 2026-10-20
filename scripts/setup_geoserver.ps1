# Unpacks the GeoServer platform-independent binary into %LOCALAPPDATA%\PuneStay\geoserver (outside OneDrive),
# gives it its own data directory, starts it, and publishes the PostGIS layers (scripts\configure_geoserver.py).
#
# Needs: the zip in %LOCALAPPDATA%\PuneStay\downloads\geoserver (from https://geoserver.org/download/),
#        Java 17 or 21 (C:\Program Files\Java\jdk-21 is used by default), the portable PostGIS running.
# Usage (from the project root):
#   powershell -ExecutionPolicy Bypass -File scripts\setup_geoserver.ps1

param([string]$Root = "$env:LOCALAPPDATA\PuneStay", [int]$Port = 8080)
$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $PSScriptRoot
$gs = Join-Path $Root "geoserver"
$data = Join-Path $Root "geoserver_data"

if (-not (Test-Path (Join-Path $gs "start.jar"))) {
    $zip = Get-ChildItem (Join-Path $Root "downloads\geoserver") -Filter "geoserver-*-bin.zip" | Sort-Object Name -Descending | Select-Object -First 1
    if (-not $zip) { throw "GeoServer zip not found in $Root\downloads\geoserver" }
    Write-Host "Unpacking $($zip.Name)..."
    $tmp = Join-Path $Root "gs_tmp"
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    Expand-Archive -Path $zip.FullName -DestinationPath $tmp -Force
    # The zip may or may not have a single top-level folder.
    $inner = if (Test-Path (Join-Path $tmp "start.jar")) { $tmp } else { (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName }
    Move-Item $inner $gs
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
}
if (-not (Test-Path $data)) {
    Write-Host "Creating data directory $data from the bundled default..."
    Copy-Item (Join-Path $gs "data_dir") $data -Recurse
}

& (Join-Path $PSScriptRoot "geoserver_start.ps1") -Root $Root -Port $Port

Write-Host "Publishing PostGIS layers..."
& (Join-Path $project ".venv\Scripts\python.exe") (Join-Path $PSScriptRoot "configure_geoserver.py")
Write-Host ""
Write-Host "Done. Layers: http://localhost:$Port/geoserver/punestay/wms  (admin UI: http://localhost:$Port/geoserver, admin / geoserver)"
