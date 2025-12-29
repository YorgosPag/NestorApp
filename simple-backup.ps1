Write-Host "Creating Enterprise Backup..."

$timestamp = Get-Date -Format "yyyyMMdd_HHmm"
$fileName = "$timestamp - [ENTERPRISE] - Advanced System Integration Safety Checkpoint.zip"
$destinationPath = "C:\Users\user\Downloads\BuckUps\Zip_BuckUps-2\$fileName"

# Create destination directory
$destinationDir = "C:\Users\user\Downloads\BuckUps\Zip_BuckUps-2"
if (-not (Test-Path $destinationDir)) {
    New-Item -ItemType Directory -Path $destinationDir -Force
}

# Compress only safe directories
try {
    $paths = @(
        "C:\Nestor_Pagonis\BACKUP_SUMMARY.json",
        "C:\Nestor_Pagonis\src\subapps\dxf-viewer\systems",
        "C:\Nestor_Pagonis\src\subapps\dxf-viewer\components",
        "C:\Nestor_Pagonis\src\subapps\geo-canvas\components",
        "C:\Nestor_Pagonis\src\core",
        "C:\Nestor_Pagonis\src\styles\design-tokens"
    )

    $existingPaths = @()
    foreach ($path in $paths) {
        if (Test-Path $path) {
            $existingPaths += $path
        }
    }

    if ($existingPaths.Count -gt 0) {
        Compress-Archive -Path $existingPaths -DestinationPath $destinationPath -Force

        Write-Host "Backup completed successfully!"
        Write-Host "File: $fileName"
        Write-Host "Location: $destinationPath"

        if (Test-Path $destinationPath) {
            $size = (Get-Item $destinationPath).Length / 1MB
            Write-Host "Size: $([math]::Round($size, 2)) MB"
        }
    } else {
        Write-Host "No valid paths found"
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}