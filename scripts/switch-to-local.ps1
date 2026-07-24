# Switch Word add-in to local development manifest (localhost:3000)
# Run: double-click switch-to-local.bat in project root

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot "manifest.xml"

Write-Host ""
Write-Host "=== Switch to Local Development ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $manifestPath)) {
  Write-Host "ERROR: manifest not found:" -ForegroundColor Red
  Write-Host "  $manifestPath"
  exit 1
}

Write-Host "[1/2] Register local manifest..."
Write-Host "      $manifestPath"
Push-Location $projectRoot
npx office-addin-dev-settings register "$manifestPath"
if ($LASTEXITCODE -ne 0) {
  Pop-Location
  exit $LASTEXITCODE
}
Pop-Location

Write-Host "[2/2] Done" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. In project folder run: npm start"
Write-Host "  2. Close Word completely (no WINWORD.EXE in Task Manager)"
Write-Host "  3. Reopen Word -> Home tab -> AI Editor"
Write-Host ""
Write-Host "Notes:"
Write-Host "  - Local URL: https://localhost:3000/taskpane.html"
Write-Host "  - Proxy token can be left empty in Settings"
Write-Host "  - To switch back online, run AI编辑助手-安装包\安装.bat"
Write-Host ""
