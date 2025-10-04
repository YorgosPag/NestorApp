# FINAL DUPLICATE CHECKER - Στατικές ρυθμίσεις για σταθερά αποτελέσματα
# Αυτό το script θα χρησιμοποιείται μόνο για επαλήθευση

param(
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"
$Root = Get-Location

Write-Host "=== FINAL DUPLICATE CHECK ===" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

# Σταθερές ρυθμίσεις - ΔΕΝ αλλάζουν ποτέ
$JscpdConfig = @{
    threshold = 5        # Minimum 5 lines για duplicate
    minTokens = 50       # Minimum 50 tokens
    maxSize = "50kb"     # Skip files > 50kb
    gitignore = $true
    blame = $false
    silent = $false
}

$ReportDir = "reports/final-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null

try {
    # Τρέχουμε ΜΟΝΟ το jscpd με σταθερές ρυθμίσεις
    Write-Host "Running jscpd with stable configuration..." -ForegroundColor Yellow
    
    $jscpdArgs = @(
        "--threshold", $JscpdConfig.threshold
        "--min-tokens", $JscpdConfig.minTokens  
        "--max-size", $JscpdConfig.maxSize
        "--reporters", "json,console"
        "--output", $ReportDir
        "--gitignore"
        "."
    )
    
    $jscpdResult = & npx jscpd @jscpdArgs 2>&1
    
    # Parse JSON results
    $jsonFile = Join-Path $ReportDir "jscpd-report.json"
    if (Test-Path $jsonFile) {
        $jsonContent = Get-Content $jsonFile -Raw | ConvertFrom-Json
        $duplicateCount = $jsonContent.duplicates.Count
        
        Write-Host ""
        Write-Host "=== FINAL RESULTS ===" -ForegroundColor Green
        Write-Host "Total Duplicates Found: $duplicateCount" -ForegroundColor White
        Write-Host "Report saved in: $ReportDir" -ForegroundColor Gray
        
        # Εμφάνιση top 10 duplicates
        if ($duplicateCount -gt 0) {
            Write-Host ""
            Write-Host "Top duplicates:" -ForegroundColor Yellow
            $jsonContent.duplicates | 
                Sort-Object { $_.fragment.loc } -Descending |
                Select-Object -First 10 |
                ForEach-Object {
                    $file1 = [System.IO.Path]::GetRelativePath($Root, $_.duplication.A.name)
                    $file2 = [System.IO.Path]::GetRelativePath($Root, $_.duplication.B.name)
                    Write-Host "  $($_.fragment.loc) lines: $file1 <-> $file2" -ForegroundColor Gray
                }
        }
    } else {
        Write-Host "No JSON report generated - checking console output" -ForegroundColor Yellow
        $jscpdResult | Write-Host
    }
    
} catch {
    Write-Error "Error during duplicate check: $_"
    exit 1
}

Write-Host ""
Write-Host "=== CHECK COMPLETE ===" -ForegroundColor Cyan