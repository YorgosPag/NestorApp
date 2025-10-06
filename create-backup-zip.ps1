$zipName = "20251005_1928 - [REFACTOR] - Eliminate 'as any' type assertions - Enterprise type safety (35+ fixes).zip"
$destination = "C:\Users\user\Downloads\BuckUps\Zip_BuckUps-2\$zipName"

Write-Host "Creating ZIP: $zipName"
Compress-Archive -Path "src\subapps\dxf-viewer", "CHANGELOG.md", "BACKUP_SUMMARY.json" -DestinationPath $destination -Force -CompressionLevel Fastest
Write-Host "✅ ZIP created successfully!"
