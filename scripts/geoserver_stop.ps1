# Stops the portable GeoServer started by geoserver_start.ps1.
param([string]$Root = "$env:LOCALAPPDATA\PuneStay")
$pidFile = Join-Path $Root "geoserver.pid"
if (Test-Path $pidFile) {
    $gpid = Get-Content $pidFile
    $p = Get-Process -Id $gpid -ErrorAction SilentlyContinue
    if ($p) { Stop-Process -Id $gpid -Force; Write-Host "GeoServer (pid $gpid) stopped." } else { Write-Host "GeoServer was not running." }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
} else { Write-Host "No pid file; GeoServer not started by the script." }
