# ENTERPRISE PROJECT BACKUP SYSTEM - FINAL VERSION

Write-Host "================================================================"
Write-Host "        ENTERPRISE PROJECT BACKUP SYSTEM"
Write-Host "              SAFE & RELIABLE"
Write-Host "================================================================"

# Read BACKUP_SUMMARY.json
$summaryPath = "C:\Nestor_Pagonis\BACKUP_SUMMARY.json"
if (Test-Path $summaryPath) {
    try {
        $summary = Get-Content $summaryPath | ConvertFrom-Json
        $category = $summary.category
        Write-Host "Category: [$category]"
    } catch {
        $category = "ENTERPRISE"
    }
} else {
    $category = "ENTERPRISE"
}

# Generate backup details
$timestamp = Get-Date -Format "yyyyMMdd_HHmm"
$fileName = "$timestamp - [$category] - Advanced System Integration Safety Checkpoint.zip"
$destinationPath = "C:\Users\user\Downloads\BuckUps\Zip_BuckUps-2\$fileName"

Write-Host "Creating backup: $fileName"

# Create destination directory
$destinationDir = Split-Path $destinationPath
if (-not (Test-Path $destinationDir)) {
    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
}

# Items to compress (safe paths)
$itemsToCompress = @()

# Check and add existing paths
$pathsToCheck = @(
    "C:\Nestor_Pagonis\src\components",
    "C:\Nestor_Pagonis\src\subapps\dxf-viewer\components",
    "C:\Nestor_Pagonis\src\subapps\dxf-viewer\systems",
    "C:\Nestor_Pagonis\src\subapps\dxf-viewer\canvas",
    "C:\Nestor_Pagonis\src\subapps\dxf-viewer\canvas-v2",
    "C:\Nestor_Pagonis\src\subapps\geo-canvas",
    "C:\Nestor_Pagonis\src\styles",
    "C:\Nestor_Pagonis\src\core",
    "C:\Nestor_Pagonis\BACKUP_SUMMARY.json"
)

foreach ($path in $pathsToCheck) {
    if (Test-Path $path) {
        $itemsToCompress += $path
        Write-Host "✓ Found: $path"
    }
}

if ($itemsToCompress.Count -gt 0) {
    try {
        Compress-Archive -Path $itemsToCompress -DestinationPath $destinationPath -Force -CompressionLevel Optimal

        if (Test-Path $destinationPath) {
            $fileSize = (Get-Item $destinationPath).Length / 1MB

            Write-Host ""
            Write-Host "✅ BACKUP ΟΛΟΚΛΗΡΩΘΗΚΕ!"
            Write-Host ""
            Write-Host "📦 ZIP: $fileName"
            Write-Host "📍 Location: $destinationPath"
            Write-Host "📊 File size: {0:N2} MB" -f $fileSize
            Write-Host "📋 Περιεχόμενα: Core components, systems, and project files"
            Write-Host ""
            Write-Host "Έτοιμοι για το επόμενο!"
        }
    } catch {
        Write-Host "❌ ERROR: $($_.Exception.Message)"
    }
} else {
    Write-Host "❌ No valid items found to backup"
}