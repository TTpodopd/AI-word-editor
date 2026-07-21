# AI Word Editor - one-click installer (no Node.js required)
# Run: double-click install.bat

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$manifestUrl = "https://milei.dpdns.org/manifest.xml"
$addinId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
$installDir = Join-Path $env:USERPROFILE "Documents\AI-Word-Editor"
$manifestPath = Join-Path $installDir "manifest.xml"
$registryPath = "HKCU:\Software\Microsoft\Office\16.0\WEF\Developer"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$localManifest = Join-Path $scriptDir "manifest.xml"

Write-Host ""
Write-Host "=== AI Word Editor Setup ===" -ForegroundColor Cyan
Write-Host ""

New-Item -ItemType Directory -Force -Path $installDir | Out-Null

if (Test-Path $localManifest) {
  Write-Host "[1/3] Copy manifest.xml from package..."
  Copy-Item -Path $localManifest -Destination $manifestPath -Force
} else {
  Write-Host "[1/3] Download manifest.xml..."
  Invoke-WebRequest -Uri $manifestUrl -OutFile $manifestPath -UseBasicParsing
}
Write-Host "      Saved to: $manifestPath"

if (-not (Test-Path $registryPath)) {
  New-Item -Path $registryPath -Force | Out-Null
}

Set-ItemProperty -Path $registryPath -Name $addinId -Value $manifestPath -Type String
Write-Host "[2/3] Registered in Word"
Write-Host "[3/3] Done" -ForegroundColor Green

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Close Word completely (no WINWORD.EXE in Task Manager)"
Write-Host "  2. Reopen Word"
Write-Host "  3. Home tab -> click 'AI Editor' button on the right"
Write-Host "  4. Settings -> fill proxy token (see install-token.txt) and API Key"
Write-Host ""
Write-Host "For Chinese guide, open: install-guide.txt"
Write-Host ""
