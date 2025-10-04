# ZIP DXF-VIEWER ONLY (excluding large directories)
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipName = "F:\Pagonis_Nestor\dxf-viewer_$timestamp.zip"
$sourcePath = "F:\Pagonis_Nestor\src\subapps\dxf-viewer"

Write-Host "Creating ZIP: $zipName"
Write-Host "Source: $sourcePath"

# Exclude patterns (node_modules, backups, test outputs, etc.)
$excludePatterns = @(
    "*node_modules*",
    "*backups*",
    "*.next*",
    "*__tests__*",
    "*test-results*",
    "*playwright-report*",
    "*e2e*",
    "*.git*",
    "*coverage*",
    "*dist*",
    "*build*",
    "*.cache*"
)

# Get all items except excluded ones
Write-Host "Scanning files..."
$allItems = Get-ChildItem -Path $sourcePath -Recurse -Force -ErrorAction SilentlyContinue

$itemsToZip = $allItems | Where-Object {
    $item = $_
    $shouldExclude = $false

    foreach ($pattern in $excludePatterns) {
        if ($item.FullName -like $pattern) {
            $shouldExclude = $true
            break
        }
    }

    -not $shouldExclude
}

Write-Host "Found $($itemsToZip.Count) files to compress..."

# Create temporary directory structure
$tempDir = "$env:TEMP\dxf-viewer-zip-temp"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Copy files to temp directory
foreach ($item in $itemsToZip) {
    $relativePath = $item.FullName.Substring($sourcePath.Length + 1)
    $targetPath = Join-Path $tempDir $relativePath

    if ($item.PSIsContainer) {
        New-Item -ItemType Directory -Path $targetPath -Force | Out-Null
    } else {
        $targetDir = Split-Path $targetPath -Parent
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        Copy-Item $item.FullName $targetPath -Force
    }
}

# Create ZIP
Write-Host "Compressing..."
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipName -Force -CompressionLevel Optimal

# Cleanup temp directory
Remove-Item $tempDir -Recurse -Force

Write-Host "Done: $zipName"
Write-Host "Size: $([math]::Round((Get-Item $zipName).Length / 1MB, 2)) MB"
