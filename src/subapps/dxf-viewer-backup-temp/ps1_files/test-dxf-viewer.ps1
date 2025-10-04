# ============================================================================
# DXF VIEWER COMPREHENSIVE TEST SCRIPT
# ============================================================================
#
# 🚀 ΕΝΤΟΛΗ ΓΙΑ ΕΚΤΕΛΕΣΗ (Copy-Paste):
#
# cd F:\Pagonis_Nestor\src\subapps\dxf-viewer && powershell -ExecutionPolicy Bypass -File .\test-dxf-viewer.ps1
#
# ή απλά:
# .\test-dxf-viewer.ps1
#
# ============================================================================

param(
    [switch]$Quick,          # Τρέχει μόνο γρήγορα tests
    [switch]$E2EOnly,        # Τρέχει μόνο E2E tests
    [switch]$Verbose,        # Εμφανίζει detailed output
    [switch]$SkipInstall     # Παραλείπει npm install check
)

# Colors for output
$Red = [System.ConsoleColor]::Red
$Green = [System.ConsoleColor]::Green
$Yellow = [System.ConsoleColor]::Yellow
$Blue = [System.ConsoleColor]::Blue
$Cyan = [System.ConsoleColor]::Cyan

function Write-ColorText {
    param($Text, $Color)
    Write-Host $Text -ForegroundColor $Color
}

function Write-Header {
    param($Text)
    Write-Host ""
    Write-ColorText "=" * 60 $Blue
    Write-ColorText " $Text" $Cyan
    Write-ColorText "=" * 60 $Blue
    Write-Host ""
}

function Write-Step {
    param($Text)
    Write-ColorText "🔍 $Text" $Yellow
}

function Write-Success {
    param($Text)
    Write-ColorText "✅ $Text" $Green
}

function Write-Error {
    param($Text)
    Write-ColorText "❌ $Text" $Red
}

function Write-Info {
    param($Text)
    Write-ColorText "ℹ️  $Text" $Blue
}

# Start
Clear-Host
Write-Header "DXF VIEWER - COMPREHENSIVE TEST SUITE"

# Check current directory
$currentPath = Get-Location
Write-Info "Τρέχει από: $currentPath"

# Navigate to project root (3 levels up από dxf-viewer)
$projectRoot = (Get-Item $currentPath).Parent.Parent.Parent.FullName
Set-Location $projectRoot
Write-Info "Project root: $projectRoot"

# Variables
$startTime = Get-Date
$testResults = @()
$totalTests = 0
$passedTests = 0
$failedTests = 0

# ============================================================================
# 1. ENVIRONMENT CHECK
# ============================================================================
Write-Header "1. ENVIRONMENT CHECK"

Write-Step "Έλεγχος Node.js..."
try {
    $nodeVersion = node --version
    Write-Success "Node.js: $nodeVersion"
    $totalTests++; $passedTests++
} catch {
    Write-Error "Node.js δεν βρέθηκε!"
    $totalTests++; $failedTests++
}

Write-Step "Έλεγχος npm..."
try {
    $npmVersion = npm --version
    Write-Success "npm: $npmVersion"
    $totalTests++; $passedTests++
} catch {
    Write-Error "npm δεν βρέθηκε!"
    $totalTests++; $failedTests++
}

# ============================================================================
# 2. DEPENDENCIES CHECK
# ============================================================================
Write-Header "2. DEPENDENCIES CHECK"

if (-not $SkipInstall) {
    Write-Step "Έλεγχος dependencies..."

    # Check if node_modules exists
    if (-not (Test-Path "node_modules")) {
        Write-Info "Εγκατάσταση dependencies..."
        npm install --silent
    }

    # Check critical packages
    $criticalPackages = @("zustand", "react", "next", "@playwright/test")
    foreach ($package in $criticalPackages) {
        try {
            $packageInfo = npm list $package --depth=0 2>$null
            if ($packageInfo -match $package) {
                Write-Success "$package εγκατεστημένο"
                $totalTests++; $passedTests++
            } else {
                Write-Error "$package ΛΕΙΠΕΙ!"
                $totalTests++; $failedTests++
            }
        } catch {
            Write-Error "Σφάλμα ελέγχου $package"
            $totalTests++; $failedTests++
        }
    }
}

# ============================================================================
# 3. DXF VIEWER STRUCTURE CHECK
# ============================================================================
Write-Header "3. DXF VIEWER STRUCTURE CHECK"

$dxfViewerPath = "src\subapps\dxf-viewer"
Write-Step "Έλεγχος δομής $dxfViewerPath..."

# Critical directories
$criticalDirs = @(
    "$dxfViewerPath\stores",
    "$dxfViewerPath\ui\components\dxf-settings",
    "$dxfViewerPath\settings-core",
    "$dxfViewerPath\config",
    "$dxfViewerPath\adapters"
)

foreach ($dir in $criticalDirs) {
    if (Test-Path $dir) {
        $fileCount = (Get-ChildItem $dir -Recurse -File).Count
        Write-Success "$dir ($fileCount αρχεία)"
        $totalTests++; $passedTests++
    } else {
        Write-Error "$dir ΛΕΙΠΕΙ!"
        $totalTests++; $failedTests++
    }
}

# Critical files
$criticalFiles = @(
    "$dxfViewerPath\stores\DxfSettingsStore.ts",
    "$dxfViewerPath\ui\components\dxf-settings\DxfSettingsPanel.tsx",
    "$dxfViewerPath\settings-core\types.ts",
    "$dxfViewerPath\config\settings-config.ts",
    "$dxfViewerPath\adapters\ZustandToConsolidatedAdapter.ts"
)

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        Write-Success "$file ($size bytes)"
        $totalTests++; $passedTests++
    } else {
        Write-Error "$file ΛΕΙΠΕΙ!"
        $totalTests++; $failedTests++
    }
}

# ============================================================================
# 4. TYPESCRIPT CHECK
# ============================================================================
if (-not $Quick) {
    Write-Header "4. TYPESCRIPT CHECK"

    Write-Step "TypeScript compilation check..."
    $tscResult = npm run typecheck --silent 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "TypeScript: ΟΚ"
        $totalTests++; $passedTests++
    } else {
        Write-Error "TypeScript: ΣΦΑΛΜΑΤΑ"
        if ($Verbose) {
            Write-Host $tscResult
        }
        $totalTests++; $failedTests++
    }
}

# ============================================================================
# 5. UNIT TESTS (Jest)
# ============================================================================
if (-not $E2EOnly) {
    Write-Header "5. UNIT TESTS (Jest)"

    Write-Step "Εκτέλεση unit tests..."
    try {
        $jestResult = npm test --silent -- --passWithNoTests --testPathPattern="dxf-viewer" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Unit Tests: PASSED"
            $totalTests++; $passedTests++
        } else {
            Write-Error "Unit Tests: FAILED"
            if ($Verbose) {
                Write-Host $jestResult
            }
            $totalTests++; $failedTests++
        }
    } catch {
        Write-Error "Unit Tests: ERROR"
        $totalTests++; $failedTests++
    }
}

# ============================================================================
# 6. ZUSTAND INTEGRATION CHECK
# ============================================================================
Write-Header "6. ZUSTAND INTEGRATION CHECK"

Write-Step "Έλεγχος Zustand configuration..."

# Check if USE_ZUSTAND_SETTINGS is enabled
$configFile = "$dxfViewerPath\config\settings-config.ts"
if (Test-Path $configFile) {
    $configContent = Get-Content $configFile -Raw
    if ($configContent -match "USE_ZUSTAND_SETTINGS\s*=\s*true") {
        Write-Success "Zustand System: ΕΝΕΡΓΟ"
        $totalTests++; $passedTests++
    } else {
        Write-Info "Zustand System: ΑΝΕΝΕΡΓΟ (χρησιμοποιεί legacy)"
        $totalTests++; $passedTests++
    }
} else {
    Write-Error "Configuration file δεν βρέθηκε!"
    $totalTests++; $failedTests++
}

# Check store structure
$storeFile = "$dxfViewerPath\stores\DxfSettingsStore.ts"
if (Test-Path $storeFile) {
    $storeContent = Get-Content $storeFile -Raw
    $storeChecks = @(
        @("create", "Zustand create function"),
        @("general.*line", "General line settings"),
        @("overrides", "Override system"),
        @("setOverride", "Override setter"),
        @("getEffective", "Effective settings getter")
    )

    foreach ($check in $storeChecks) {
        if ($storeContent -match $check[0]) {
            Write-Success $check[1] + ": ΟΚ"
            $totalTests++; $passedTests++
        } else {
            Write-Error $check[1] + ": ΛΕΙΠΕΙ"
            $totalTests++; $failedTests++
        }
    }
} else {
    Write-Error "Store file δεν βρέθηκε!"
    $totalTests++; $failedTests++
}

# ============================================================================
# 7. E2E TESTS (Playwright)
# ============================================================================
if (-not $Quick) {
    Write-Header "7. E2E TESTS (Playwright)"

    Write-Step "Εκτέλεση E2E tests..."

    # Check if dev server is running
    Write-Step "Έλεγχος dev server..."
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Write-Success "Dev server: ΤΡΕΧΕΙ"

        # Run E2E tests
        try {
            $e2eResult = npx playwright test tests/e2e/dxf-settings-zustand.spec.ts --reporter=line 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Success "E2E Tests: PASSED"
                $totalTests++; $passedTests++
            } else {
                Write-Error "E2E Tests: FAILED"
                if ($Verbose) {
                    Write-Host $e2eResult
                }
                $totalTests++; $failedTests++
            }
        } catch {
            Write-Error "E2E Tests: ERROR"
            $totalTests++; $failedTests++
        }

    } catch {
        Write-Error "Dev server: ΔΕΝ ΤΡΕΧΕΙ"
        Write-Info "Ξεκίνησε με: npm run dev:fast"
        $totalTests++; $failedTests++
    }
}

# ============================================================================
# 8. FINAL REPORT
# ============================================================================
Write-Header "8. FINAL REPORT"

$endTime = Get-Date
$duration = $endTime - $startTime

Write-Info "Συνολικός χρόνος: $($duration.TotalSeconds.ToString('F1')) seconds"
Write-Info "Συνολικά tests: $totalTests"
Write-Success "Passed: $passedTests"

if ($failedTests -gt 0) {
    Write-Error "Failed: $failedTests"
} else {
    Write-Success "Failed: $failedTests"
}

$successRate = if ($totalTests -gt 0) { ($passedTests / $totalTests * 100).ToString('F1') } else { "0" }

Write-Host ""
if ($failedTests -eq 0) {
    Write-ColorText "🎉 ΟΛΑ ΤΑ TESTS ΠΕΡΑΣΑΝ! ($successRate%)" $Green
    Write-ColorText "✅ Η εφαρμογή είναι έτοιμη για το συνέδριο!" $Green
} else {
    Write-ColorText "⚠️  ΚΑΠΟΙΑ TESTS ΑΠΕΤΥΧΑΝ ($successRate% success rate)" $Yellow
    Write-ColorText "🔧 Ελέγξε τα σφάλματα παραπάνω" $Yellow
}

Write-Host ""
Write-ColorText "📋 ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ:" $Blue
Write-ColorText "• Αν όλα OK: npm run dev:fast και δοκίμασε το UI" $Blue
Write-ColorText "• Για E2E tests: npm run test:e2e:headed" $Blue
Write-ColorText "• Για debugging: .\test-dxf-viewer.ps1 -Verbose" $Blue

# Return to original directory
Set-Location $currentPath

# Exit with appropriate code
exit $failedTests