Write-Host "=== AppData\Local - Large Folders (>100MB) ==="
Get-ChildItem 'C:\Users\user\AppData\Local' -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $s = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    if($s -gt 100MB) {
        [PSCustomObject]@{ SizeGB = [math]::Round($s/1GB,2); Folder = $_.Name }
    }
} | Sort-Object SizeGB -Descending | Format-Table -AutoSize

Write-Host "`n=== AppData\Roaming - Large Folders (>100MB) ==="
Get-ChildItem 'C:\Users\user\AppData\Roaming' -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $s = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    if($s -gt 100MB) {
        [PSCustomObject]@{ SizeGB = [math]::Round($s/1GB,2); Folder = $_.Name }
    }
} | Sort-Object SizeGB -Descending | Format-Table -AutoSize

Write-Host "`n=== Temp Folders ==="
$tempSize = (Get-ChildItem $env:TEMP -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
Write-Host ("TEMP folder: {0:N2} GB" -f ($tempSize/1GB))

$winTemp = (Get-ChildItem 'C:\Windows\Temp' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
Write-Host ("Windows\Temp: {0:N2} GB" -f ($winTemp/1GB))

Write-Host "`n=== npm/yarn/pnpm Caches ==="
$npmCache = 'C:\Users\user\AppData\Local\npm-cache'
if(Test-Path $npmCache) {
    $s = (Get-ChildItem $npmCache -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    Write-Host ("npm-cache: {0:N2} GB" -f ($s/1GB))
}

Write-Host "`n=== Other Large Locations ==="
$downloads = (Get-ChildItem 'C:\Users\user\Downloads' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
Write-Host ("Downloads: {0:N2} GB" -f ($downloads/1GB))

$recycle = & cmd /c "dir /s /a C:\`$Recycle.Bin 2>nul" | Select-String "File\(s\)" | Select-Object -Last 1
Write-Host ("Recycle Bin: $recycle")
