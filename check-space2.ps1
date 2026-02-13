Write-Host "=== AppData\Local\Microsoft - Subfolders ==="
Get-ChildItem 'C:\Users\user\AppData\Local\Microsoft' -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $s = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    if($s -gt 50MB) {
        [PSCustomObject]@{ SizeGB = [math]::Round($s/1GB,2); Folder = $_.Name }
    }
} | Sort-Object SizeGB -Descending | Format-Table -AutoSize

Write-Host "`n=== node_modules folders on C: (top-level projects) ==="
Get-ChildItem 'C:\' -Directory -Depth 2 -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'node_modules' } | ForEach-Object {
    $s = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    if($s -gt 100MB) {
        [PSCustomObject]@{ SizeGB = [math]::Round($s/1GB,2); Path = $_.FullName }
    }
} | Sort-Object SizeGB -Descending | Format-Table -AutoSize

Write-Host "`n=== Large folders at C:\ root (>1GB) ==="
Get-ChildItem 'C:\' -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -notin @('Windows','Program Files','Program Files (x86)','Users','PerfLogs','Recovery') } | ForEach-Object {
    $s = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    if($s -gt 1GB) {
        [PSCustomObject]@{ SizeGB = [math]::Round($s/1GB,2); Folder = $_.Name }
    }
} | Sort-Object SizeGB -Descending | Format-Table -AutoSize

Write-Host "`n=== C:\Users\user top-level folders (>500MB) ==="
Get-ChildItem 'C:\Users\user' -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'AppData' } | ForEach-Object {
    $s = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    if($s -gt 500MB) {
        [PSCustomObject]@{ SizeGB = [math]::Round($s/1GB,2); Folder = $_.Name }
    }
} | Sort-Object SizeGB -Descending | Format-Table -AutoSize
