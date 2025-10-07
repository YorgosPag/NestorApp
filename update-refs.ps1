# Update centralized_systems.md references to docs/CENTRALIZED_SYSTEMS.md

$rootPath = "F:\Pagonis_Nestor\src\subapps\dxf-viewer"

# Pattern 1: ./centralized_systems.md → ./docs/CENTRALIZED_SYSTEMS.md
# Pattern 2: ../centralized_systems.md → ../docs/CENTRALIZED_SYSTEMS.md
# Pattern 3: src/subapps/dxf-viewer/centralized_systems.md → src/subapps/dxf-viewer/docs/CENTRALIZED_SYSTEMS.md

$files = Get-ChildItem -Path $rootPath -Recurse -Include *.md,*.ts,*.tsx -File

$count = 0
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content

    # Replace all patterns
    $content = $content -replace '\./centralized_systems\.md', './docs/CENTRALIZED_SYSTEMS.md'
    $content = $content -replace '\.\./centralized_systems\.md', '../docs/CENTRALIZED_SYSTEMS.md'
    $content = $content -replace 'src/subapps/dxf-viewer/centralized_systems\.md', 'src/subapps/dxf-viewer/docs/CENTRALIZED_SYSTEMS.md'

    # Only write if changed
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $count++
        Write-Host "Updated: $($file.FullName)"
    }
}

Write-Host "`n✅ Updated $count files successfully!"
