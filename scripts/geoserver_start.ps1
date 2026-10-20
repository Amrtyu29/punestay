# Starts the portable GeoServer (set up by setup_geoserver.ps1) on port 8080 in the background.
param([string]$Root = "$env:LOCALAPPDATA\PuneStay", [int]$Port = 8080, [string]$JavaHome = "C:\Program Files\Java\jdk-21")
$ErrorActionPreference = "Stop"
$gs = Join-Path $Root "geoserver"
$data = Join-Path $Root "geoserver_data"
$pidFile = Join-Path $Root "geoserver.pid"
$log = Join-Path $Root "geoserver.log"
if (-not (Test-Path (Join-Path $gs "start.jar"))) { throw "GeoServer not found at $gs. Run scripts\setup_geoserver.ps1 first." }

if (Test-Path $pidFile) {
    $old = Get-Content $pidFile
    if (Get-Process -Id $old -ErrorAction SilentlyContinue) { Write-Host "GeoServer already running (pid $old) on http://localhost:$Port/geoserver"; exit 0 }
}
$java = Join-Path $JavaHome "bin\java.exe"
if (-not (Test-Path $java)) { $java = "java" }
$args = @("-Xms256m", "-Xmx1g", "-DGEOSERVER_DATA_DIR=$data", "-Djetty.http.port=$Port", "-DSTOP.PORT=8079", "-DSTOP.KEY=punestay", "-jar", "start.jar")
$p = Start-Process -FilePath $java -ArgumentList $args -WorkingDirectory $gs -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError "$log.err" -PassThru
Set-Content $pidFile $p.Id
Write-Host "GeoServer starting (pid $($p.Id)). Admin UI: http://localhost:$Port/geoserver  (log: $log)"
# Wait up to 90 s for it to answer.
for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 2
    try { $r = Invoke-WebRequest -Uri "http://localhost:$Port/geoserver/rest/about/version.json" -UseBasicParsing -TimeoutSec 5 -Headers @{ Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:geoserver")) }; if ($r.StatusCode -eq 200) { Write-Host "GeoServer is up."; exit 0 } } catch {}
}
Write-Host "GeoServer did not answer within 90 s; check $log"
