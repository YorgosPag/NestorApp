# ENTERPRISE PROJECT BACKUP SYSTEM - SAFE VERSION
# Τροποποιημένη έκδοση για αποφυγή προβληματικών αρχείων

Write-Host "================================================================"
Write-Host "        ENTERPRISE PROJECT BACKUP SYSTEM"
Write-Host "              SAFE & RELIABLE"
Write-Host "================================================================"
Write-Host ""

# Read BACKUP_SUMMARY.json
Write-Host "Reading BACKUP_SUMMARY.json..."
try {
    $summaryPath = "C:\Nestor_Pagonis\BACKUP_SUMMARY.json"
    $summary = Get-Content $summaryPath | ConvertFrom-Json
    $category = $summary.category
    $description = $summary.shortDescription
    Write-Host "Summary loaded successfully"
    Write-Host "Category: [$category]"
    Write-Host "Description: $description"
} catch {
    $category = "ENTERPRISE"
    $description = "Advanced System Integration Safety Checkpoint"
    Write-Host "Using fallback values"
}

Write-Host ""

# Generate backup details
$timestamp = Get-Date -Format "yyyyMMdd_HHmm"
$fileName = "$timestamp - [$category] - Complete Project Backup.zip"
$destinationPath = "C:\Users\user\Downloads\BuckUps\Zip_BuckUps-2\$fileName"

Write-Host "Backup Details:"
Write-Host "Category: [$category]"
Write-Host "Description: Complete Project Backup"
Write-Host "Timestamp: $timestamp"
Write-Host "File: $fileName"
Write-Host ""

# Create destination directory
$destinationDir = Split-Path $destinationPath
if (-not (Test-Path $destinationDir)) {
    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
}

try {
    Write-Host "Creating safe backup (excluding node_modules and problematic files)..."

    # Create archive excluding problematic paths
    $excludePatterns = @(
        "*\node_modules\*",
        "*\.next\*",
        "*\dist\*",
        "*\build\*",
        "*\coverage\*",
        "*\.git\*",
        "*\*.log"
    )

    # Use 7-zip style compression with Compress-Archive
    $itemsToCompress = @(
        "C:\Nestor_Pagonis\src\components",
        "C:\Nestor_Pagonis\src\subapps\dxf-viewer\components",
        "C:\Nestor_Pagonis\src\subapps\dxf-viewer\systems",
        "C:\Nestor_Pagonis\src\subapps\dxf-viewer\canvas*",
        "C:\Nestor_Pagonis\src\subapps\geo-canvas",
        "C:\Nestor_Pagonis\src\styles",
        "C:\Nestor_Pagonis\src\core",
        "C:\Nestor_Pagonis\BACKUP_SUMMARY.json",
        "C:\Nestor_Pagonis\packages\core"
    )

    # Filter existing paths
    $existingItems = @()
    foreach ($item in $itemsToCompress) {
        if (Test-Path $item) {
            $existingItems += $item
        }
    }

    if ($existingItems.Count -gt 0) {
        Compress-Archive -Path $existingItems -DestinationPath $destinationPath -Force -CompressionLevel Optimal

        Write-Host "✅ BACKUP ΟΛΟΚΛΗΡΩΘΗΚΕ!"
        Write-Host ""
        Write-Host "📦 ZIP: $fileName"
        Write-Host "📍 Location: $destinationPath"
        Write-Host "📋 Περιεχόμενα: Core components, systems, and project files"
        Write-Host ""
        Write-Host "Έτοιμοι για το επόμενο!"

        # Verify backup exists
        if (Test-Path $destinationPath) {
            $fileSize = (Get-Item $destinationPath).Length / 1MB
            Write-Host "📊 File size: {0:N2} MB" -f $fileSize
        }
    } else {
        Write-Host "❌ No valid items found to backup"
    }

} catch {
    Write-Host "❌ ERROR: Failed to create backup"
    Write-Host "Error: $($_.Exception.Message)"
}