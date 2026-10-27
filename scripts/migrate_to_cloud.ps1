# Copies the local PuneStay database (portable PostgreSQL on port 5433) into a hosted PostgreSQL with PostGIS,
# for example Neon. Run it yourself with the connection string from the provider's dashboard:
#
#   powershell -ExecutionPolicy Bypass -File scripts\migrate_to_cloud.ps1 -Url "postgresql://user:password@host/dbname?sslmode=require"
#
# It dumps everything (schema, data, the listings_public view), creates the PostGIS and pg_trgm extensions on the
# target, restores the dump, and prints the row counts on both sides so you can compare them.
param(
    [Parameter(Mandatory = $true)][string]$Url,
    [string]$Root = "$env:LOCALAPPDATA\PuneStay",
    [int]$LocalPort = 5433
)
$ErrorActionPreference = "Stop"
$bin = Join-Path $Root "pgsql\bin"
$dump = Join-Path $Root "punestay.backup"
$env:PGPASSWORD = "punestay"

Write-Host "1/4 Dumping the local database to $dump"
& "$bin\pg_dump.exe" -Fc --no-owner --no-privileges -h localhost -p $LocalPort -U punestay -d punestay -f $dump
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }

Write-Host "2/4 Creating the PostGIS and pg_trgm extensions on the target"
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
# Options must come before the URL: psql on Windows ignores options that follow the database argument.
& "$bin\psql.exe" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_trgm;" "$Url"
if ($LASTEXITCODE -ne 0) { throw "could not create the extensions; check the connection string and that the provider supports PostGIS" }

Write-Host "3/4 Restoring (existing PuneStay tables on the target are replaced)"
& "$bin\pg_restore.exe" --no-owner --no-privileges --clean --if-exists --exit-on-error -d "$Url" $dump
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed" }

Write-Host "4/4 Row counts, local then target"
$counts = "SELECT 'listings' AS t, count(*) FROM listings UNION ALL SELECT 'pois', count(*) FROM pois UNION ALL SELECT 'destinations', count(*) FROM destinations UNION ALL SELECT 'rent_observations', count(*) FROM rent_observations UNION ALL SELECT 'users', count(*) FROM users;"
$env:PGPASSWORD = "punestay"
& "$bin\psql.exe" -h localhost -p $LocalPort -U punestay -d punestay -At -c $counts
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
& "$bin\psql.exe" -At -c $counts "$Url"
Write-Host "Done. Put the same connection string into DATABASE_URL on Render."
