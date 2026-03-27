# =============================================================================
# QA Clean Runner - Restarts emulator + dev server, then runs QA tests
# =============================================================================
# Usage: powershell -ExecutionPolicy Bypass -File scripts/qa-tests/run-qa-clean.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot/../..

Write-Host ""
Write-Host "[Step 1] Killing existing processes on ports 8080, 4000, 3000..." -ForegroundColor Cyan

# Kill processes on ports
Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 3
Write-Host "  OK - Ports cleared" -ForegroundColor Green

# Step 2: Start Firebase emulator
Write-Host ""
Write-Host "[Step 2] Starting Firebase emulator (clean)..." -ForegroundColor Cyan
$emulatorJob = Start-Process -FilePath "npx" -ArgumentList "firebase emulators:start --only firestore,auth,storage --project pagonis-87766" -PassThru -WindowStyle Minimized

Write-Host "  Waiting for emulator (port 8080)..." -ForegroundColor Yellow
$maxWait = 30
for ($i = 1; $i -le $maxWait; $i++) {
  try {
    $null = Invoke-WebRequest -Uri "http://localhost:8080/" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "  OK - Emulator ready" -ForegroundColor Green
    break
  } catch {
    if ($i -eq $maxWait) {
      Write-Host "  FAIL - Emulator did not start" -ForegroundColor Red
      exit 1
    }
    Start-Sleep -Seconds 2
  }
}

# Step 3: Start dev server
Write-Host ""
Write-Host "[Step 3] Starting Next.js dev server (emulator mode)..." -ForegroundColor Cyan
$env:FIRESTORE_EMULATOR_HOST = "localhost:8080"
$env:NEXT_PUBLIC_USE_FIREBASE_EMULATOR = "true"
$env:NODE_OPTIONS = "--max-old-space-size=8192"

$devJob = Start-Process -FilePath "npx" -ArgumentList "next dev --turbopack" -PassThru -WindowStyle Minimized

Write-Host "  Waiting for dev server (port 3000, max 2min)..." -ForegroundColor Yellow
$maxWait = 24
for ($i = 1; $i -le $maxWait; $i++) {
  try {
    $null = Invoke-WebRequest -Uri "http://127.0.0.1:3000/" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  OK - Dev server ready" -ForegroundColor Green
    break
  } catch {
    if ($i -eq $maxWait) {
      Write-Host "  FAIL - Dev server did not start" -ForegroundColor Red
      exit 1
    }
    Start-Sleep -Seconds 5
  }
}

# Step 4: Run QA tests
Write-Host ""
Write-Host "[Step 4] Running QA tests..." -ForegroundColor Cyan
Write-Host ""
$env:FIRESTORE_EMULATOR_HOST = "localhost:8080"
npx tsx scripts/qa-tests/contact-individual.qa.ts
$qaExit = $LASTEXITCODE

# Cleanup
Write-Host ""
Write-Host "[Cleanup] Stopping processes..." -ForegroundColor Yellow
if ($devJob -and !$devJob.HasExited) { Stop-Process -Id $devJob.Id -Force -ErrorAction SilentlyContinue }
if ($emulatorJob -and !$emulatorJob.HasExited) { Stop-Process -Id $emulatorJob.Id -Force -ErrorAction SilentlyContinue }

if ($qaExit -eq 0) {
  Write-Host ""
  Write-Host "QA tests completed successfully" -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "QA tests finished with failures (exit code: $qaExit)" -ForegroundColor Yellow
}

exit $qaExit
