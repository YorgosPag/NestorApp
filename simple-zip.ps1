$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipName = "F:\Pagonis_Nestor_$timestamp.zip"

# Get all items except problematic system files
$items = Get-ChildItem -Path "F:\Pagonis_Nestor" -Force | Where-Object { $_.Name -ne "nul" -and $_.Name -ne "con" -and $_.Name -ne "prn" -and $_.Name -ne "aux" }
$itemPaths = $items | ForEach-Object { $_.FullName }

Compress-Archive -Path $itemPaths -DestinationPath $zipName -Force -CompressionLevel Optimal
Write-Host "Done: $zipName"