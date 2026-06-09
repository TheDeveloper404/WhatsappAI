# scripts/db-up.ps1 — asigură un Postgres local sănătos înainte de teste.
#
# De ce există: pe Windows, Postgres dă intermitent "could not reserve shared memory region
# (error code 487)" — ASLR/DLL injectată (antivirus) ocupă adresa la care fiecare backend nou
# (proces per conexiune) trebuie să mapeze memoria partajată. `pg_ctl status` zice "running",
# dar conexiunile pică cu "server closed the connection unexpectedly". Fix-ul = restart curat.
#
# Scriptul e IDEMPOTENT: dacă DB-ul răspunde deja, nu face nimic; repornește DOAR când e bolnav.
# Rulează: pnpm db:up   (sau direct: powershell -File scripts/db-up.ps1)

$ErrorActionPreference = 'SilentlyContinue'
$PgBin  = 'C:\dev\apps\postgresql\current\bin'
$PgData = 'C:/dev/apps/postgresql/current/data'
$env:Path += ";$PgBin"
$env:PGPASSWORD = 'postgres'

function Test-Pg {
  $out = & psql -h 127.0.0.1 -p 5432 -U postgres -tAc 'SELECT 1;' 2>$null
  return ($LASTEXITCODE -eq 0 -and "$out".Trim() -eq '1')
}

if (Test-Pg) {
  Write-Host "[db:up] Postgres OK pe 127.0.0.1:5432 — nimic de făcut."
  exit 0
}

Write-Host "[db:up] Postgres nu răspunde curat (probabil error 487) — restart -m fast..."
& pg_ctl -D $PgData -l "$PgData/server.log" -m fast restart | Out-Null
Start-Sleep -Seconds 3

if (Test-Pg) {
  Write-Host "[db:up] Postgres pornit curat pe 127.0.0.1:5432 — gata de teste."
  exit 0
}

Write-Host "[db:up] Postgres TOT nu răspunde. Verifică $PgData/server.log."
Write-Host "[db:up] Dacă error 487 revine des: exclude folderul Postgres din antivirus (cauza-rădăcină)."
exit 1
