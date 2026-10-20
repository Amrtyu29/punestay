# Downloads the OpenStreetMap western India extract from Geofabrik and clips it to Pune.
# Needs Docker Desktop running (osmium runs inside a container so nothing else is installed).
#
# Usage (from the project root):
#   powershell -ExecutionPolicy Bypass -File scripts\download_osm.ps1
#
# Output: data\pune.osm.pbf

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$data = Join-Path $root "data"
New-Item -ItemType Directory -Force $data | Out-Null

$zoneUrl  = "https://download.geofabrik.de/asia/india/western-zone-latest.osm.pbf"
$zoneFile = Join-Path $data "western-zone-latest.osm.pbf"
$puneFile = Join-Path $data "pune.osm.pbf"

# Bounding box: west,south,east,north (osmium order)
$bbox = "73.70,18.40,74.00,18.70"

if (-not (Test-Path $zoneFile)) {
    Write-Host "Downloading $zoneUrl (several hundred MB, be patient)..."
    Invoke-WebRequest -Uri $zoneUrl -OutFile $zoneFile
} else {
    Write-Host "Already have $zoneFile"
}

Write-Host "Clipping to Pune bbox $bbox with osmium (Docker)..."
docker run --rm -v "${data}:/data" stefda/osmium-tool `
    osmium extract -b $bbox --overwrite -o /data/pune.osm.pbf /data/western-zone-latest.osm.pbf

if (Test-Path $puneFile) {
    $mb = [math]::Round((Get-Item $puneFile).Length / 1MB, 1)
    Write-Host "Done: $puneFile ($mb MB)"
} else {
    throw "Clip failed, pune.osm.pbf was not created."
}
