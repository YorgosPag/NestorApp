# Cleanup script για τα προβληματικά 'nul' files
Write-Host "Cleaning up NUL files that prevent ZIP creation..."

$nullFiles = Get-ChildItem 'C:\Nestor_Pagonis\src' -Recurse -Name 'nul'
$count = $nullFiles.Count

Write-Host "Found $count NUL files to remove"

if ($count -gt 0) {
    foreach ($file in $nullFiles) {
        $fullPath = Join-Path 'C:\Nestor_Pagonis\src' $file
        try {
            Remove-Item $fullPath -Force
            Write-Host "Removed: $fullPath"
        } catch {
            Write-Host "Failed to remove: $fullPath - $($_.Exception.Message)"
        }
    }
    Write-Host "Cleanup completed."
} else {
    Write-Host "No NUL files found."
}