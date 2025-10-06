# ============================================================================
# QUICK DXF VIEWER TEST
# ============================================================================

param([switch]$Verbose)

# Colors
$Red = [System.ConsoleColor]::Red
$Green = [System.ConsoleColor]::Green
$Yellow = [System.ConsoleColor]::Yellow
$Blue = [System.ConsoleColor]::Blue
$Cyan = [System.ConsoleColor]::Cyan

function Write-ColorText($Text, $Color) {
    Write-Host $Text -ForegroundColor $Color
}

function Write-Header($Text) {
    Write-Host ""
    Write-ColorText ("=" * 50) $Blue
    Write-ColorText " $Text" $Cyan
    Write-ColorText ("=" * 50) $Blue
    Write-Host ""
}

function Write-Step($Text) {
    Write-ColorText "Checking: $Text" $Yellow
}

function Write-Success($Text) {
    Write-ColorText "PASS: $Text" $Green
}

function Write-Error($Text) {
    Write-ColorText "FAIL: $Text" $Red
}

# Start
Clear-Host
Write-Header "DXF VIEWER - QUICK TEST"

# Variables
$totalTests = 0
$passedTests = 0
$failedTests = 0

# Navigate to project root
$currentPath = Get-Location
$projectRoot = (Get-Item $currentPath).Parent.Parent.Parent.FullName
Set-Location $projectRoot
Write-ColorText "Project root: $projectRoot" $Blue

Write-Header "1. ZUSTAND DEPENDENCY CHECK"

Write-Step "Zustand dependency..."
try {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    if ($packageJson.dependencies.zustand) {
        Write-Success "Zustand: $($packageJson.dependencies.zustand)"
        $totalTests++; $passedTests++
    } else {
        Write-Error "Zustand not found in dependencies!"
        $totalTests++; $failedTests++
    }
} catch {
    Write-Error "Error checking package.json"
    $totalTests++; $failedTests++
}

Write-Header "2. DXF STRUCTURE CHECK"

$dxfPath = "src\subapps\dxf-viewer"
Write-Step "Checking $dxfPath..."

# Critical files
$criticalFiles = @(
    "$dxfPath\stores\DxfSettingsStore.ts",
    "$dxfPath\config\settings-config.ts",
    "$dxfPath\adapters\ZustandToConsolidatedAdapter.ts"
)

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        Write-Success "$file ($size bytes)"
        $totalTests++; $passedTests++
    } else {
        Write-Error "$file MISSING!"
        $totalTests++; $failedTests++
    }
}

Write-Header "3. ZUSTAND CONFIGURATION CHECK"

$configFile = "$dxfPath\config\settings-config.ts"
if (Test-Path $configFile) {
    $configContent = Get-Content $configFile -Raw
    if ($configContent -match "USE_ZUSTAND_SETTINGS\s*=\s*true") {
        Write-Success "Zustand System: ACTIVE"
        $totalTests++; $passedTests++
    } else {
        Write-ColorText "Zustand System: INACTIVE" $Yellow
        $totalTests++; $passedTests++
    }
} else {
    Write-Error "Configuration file not found!"
    $totalTests++; $failedTests++
}

Write-Header "4. TYPESCRIPT CHECK"

Write-Step "TypeScript compilation..."
$tscResult = npm run typecheck --silent 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "TypeScript: OK"
    $totalTests++; $passedTests++
} else {
    Write-Error "TypeScript: ERRORS"
    if ($Verbose) {
        Write-Host $tscResult
    }
    $totalTests++; $failedTests++
}

Write-Header "5. DEV SERVER CHECK"

Write-Step "Dev server status..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Success "Dev server: RUNNING (Status: $($response.StatusCode))"
    $totalTests++; $passedTests++
} catch {
    Write-Error "Dev server: NOT RUNNING"
    Write-ColorText "Start with: npm run dev:fast" $Blue
    $totalTests++; $failedTests++
}

# Final Report
Write-Header "FINAL REPORT"

$successRate = if ($totalTests -gt 0) { ($passedTests / $totalTests * 100).ToString('F1') } else { "0" }

Write-ColorText "Total tests: $totalTests" $Blue
Write-Success "Passed: $passedTests"
if ($failedTests -gt 0) {
    Write-Error "Failed: $failedTests"
} else {
    Write-Success "Failed: $failedTests"
}

Write-Host ""
if ($failedTests -eq 0) {
    Write-ColorText "All tests passed! ($successRate%)" $Green
} else {
    Write-ColorText "Some tests failed ($successRate%)" $Yellow
}

# Return to original directory
Set-Location $currentPath

# Exit with appropriate code
exit $failedTests