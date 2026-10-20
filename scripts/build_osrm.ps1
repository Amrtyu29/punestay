# Builds the OSRM routing graph for Pune from data\pune.osm.pbf.
# Needs Docker Desktop running. Takes a few minutes and about 2 GB RAM.
#
# Usage (from the project root):
#   powershell -ExecutionPolicy Bypass -File scripts\build_osrm.ps1            # car profile
#   powershell -ExecutionPolicy Bypass -File scripts\build_osrm.ps1 -Profile foot
#
# Output: data\osrm\pune.osrm*   (used by the osrm service in docker-compose.yml)

param(
    [ValidateSet("car", "bicycle", "foot")]
    [string]$Profile = "car"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$data = Join-Path $root "data"
$osrm = Join-Path $data "osrm"
$src  = Join-Path $data "pune.osm.pbf"

if (-not (Test-Path $src)) { throw "Missing $src. Run scripts\download_osm.ps1 first." }

New-Item -ItemType Directory -Force $osrm | Out-Null
Copy-Item $src (Join-Path $osrm "pune.osm.pbf") -Force

$img = "osrm/osrm-backend:latest"
$vol = "${osrm}:/data"

Write-Host "osrm-extract ($Profile profile)..."
docker run --rm -t -v $vol $img osrm-extract -p /opt/$Profile.lua /data/pune.osm.pbf

Write-Host "osrm-partition..."
docker run --rm -t -v $vol $img osrm-partition /data/pune.osrm

Write-Host "osrm-customize..."
docker run --rm -t -v $vol $img osrm-customize /data/pune.osrm

Write-Host ""
Write-Host "Done. Start the router with:  docker compose --profile routing up -d"
Write-Host "Test:  http://localhost:5000/route/v1/driving/73.8567,18.5204;73.8077,18.5308?overview=false"
