# ===================================================================
# SCRIPT: vres_nekro_kodika_&_delete.ps1
# Dead Code Detection and Cleanup for dxf-viewer folder
# ===================================================================

param(
    [switch]$DryRun = $false,
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"
$TargetFolder = $PSScriptRoot

Write-Host "Dead Code Detection in: $TargetFolder" -ForegroundColor Cyan
Write-Host "Dry Run Mode: $DryRun" -ForegroundColor Yellow

# Get all TypeScript/JavaScript files
$AllFiles = Get-ChildItem -Path $TargetFolder -Recurse -Include "*.ts", "*.tsx", "*.js", "*.jsx" | 
    Where-Object { 
        $_.FullName -notmatch "\\node_modules\\" -and 
        $_.FullName -notmatch "\\\.next\\" -and
        $_.FullName -notmatch "\\reports\\" -and
        $_.FullName -notmatch "\\dist\\" 
    }

Write-Host "Found $($AllFiles.Count) files to analyze" -ForegroundColor Green

# Initialize collections
$AllExports = @{}
$AllImports = @{}
$DeadCode = @{
    UnusedExports = @()
    UnusedImports = @()
    EmptyFiles = @()
}

Write-Host "Collecting exports and imports..." -ForegroundColor Cyan

foreach ($File in $AllFiles) {
    $Content = Get-Content -Path $File.FullName -Raw -Encoding UTF8
    $RelativePath = $File.FullName.Replace($TargetFolder + "\", "")
    
    # Find exports
    $ExportMatches = [regex]::Matches($Content, 'export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)|export\s+\{\s*([^}]+)\s*\}|export\s+default\s+(\w+)')
    foreach ($Match in $ExportMatches) {
        $ExportName = ($Match.Groups[1].Value + $Match.Groups[2].Value + $Match.Groups[3].Value).Trim()
        if ($ExportName -and $ExportName -ne "") {
            if ($Match.Groups[2].Success) {
                # Named exports in {} format
                $Names = $ExportName -split "," | ForEach-Object { $_.Trim() -replace "\s+as\s+\w+", "" }
                foreach ($Name in $Names) {
                    if ($Name) { $AllExports[$Name] = $RelativePath }
                }
            } else {
                $AllExports[$ExportName] = $RelativePath
            }
        }
    }
    
    # Find imports
    $ImportMatches = [regex]::Matches($Content, 'import\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))\s+from')
    foreach ($Match in $ImportMatches) {
        $ImportName = ($Match.Groups[1].Value + $Match.Groups[2].Value + $Match.Groups[3].Value).Trim()
        if ($ImportName) {
            if ($Match.Groups[1].Success) {
                # Named imports
                $Names = $ImportName -split "," | ForEach-Object { $_.Trim() -replace "\s+as\s+\w+", "" }
                foreach ($Name in $Names) {
                    if ($Name) {
                        if (-not $AllImports.ContainsKey($Name)) { $AllImports[$Name] = @() }
                        $AllImports[$Name] += $RelativePath
                    }
                }
            } else {
                if (-not $AllImports.ContainsKey($ImportName)) { $AllImports[$ImportName] = @() }
                $AllImports[$ImportName] += $RelativePath
            }
        }
    }
    
    # Check for empty files
    if ($Content.Trim().Length -lt 10 -or $Content.Trim() -match "^(/\*.*\*/|//.*|\s)*$") {
        $DeadCode.EmptyFiles += $File.FullName
    }
}

Write-Host "Found $($AllExports.Count) exports and $($AllImports.Count) unique imports" -ForegroundColor Green

# Find unused exports
Write-Host "Finding unused exports..." -ForegroundColor Cyan

foreach ($Export in $AllExports.Keys) {
    $IsUsed = $false
    
    # Check if used in imports
    if ($AllImports.ContainsKey($Export)) {
        $IsUsed = $true
    } else {
        # Check if used in code (not in import statements)
        foreach ($File in $AllFiles) {
            $Content = Get-Content -Path $File.FullName -Raw -Encoding UTF8
            # Remove import statements for clean check
            $CleanContent = $Content -replace 'import.*?from.*?[;"\n]', ''
            
            if ($CleanContent -match "\b$Export\b") {
                $IsUsed = $true
                break
            }
        }
    }
    
    if (-not $IsUsed) {
        $DeadCode.UnusedExports += @{
            Name = $Export
            File = $AllExports[$Export]
        }
    }
}

# Find unused imports
Write-Host "Finding unused imports..." -ForegroundColor Cyan

foreach ($File in $AllFiles) {
    $Content = Get-Content -Path $File.FullName -Raw -Encoding UTF8
    $RelativePath = $File.FullName.Replace($TargetFolder + "\", "")
    
    # Simple regex for import statements
    $ImportMatches = [regex]::Matches($Content, 'import\s+\{([^}]+)\}\s+from\s+["'']([^"'']+)["'']')
    foreach ($Match in $ImportMatches) {
        $ImportedNames = $Match.Groups[1].Value -split "," | ForEach-Object { $_.Trim() -replace "\s+as\s+\w+", "" }
        $ImportSource = $Match.Groups[2].Value
        
        foreach ($ImportName in $ImportedNames) {
            if ($ImportName) {
                # Remove import statements for clean check
                $CleanContent = $Content -replace 'import.*?from.*?[;"\n]', ''
                
                if (-not ($CleanContent -match "\b$ImportName\b")) {
                    $DeadCode.UnusedImports += @{
                        Name = $ImportName
                        File = $RelativePath
                        Source = $ImportSource
                    }
                }
            }
        }
    }
}

# Display results
Write-Host "`nDEAD CODE DETECTION RESULTS:" -ForegroundColor Yellow
Write-Host "=============================" -ForegroundColor Yellow

Write-Host "`nUnused Exports ($($DeadCode.UnusedExports.Count)):" -ForegroundColor Red
foreach ($Export in $DeadCode.UnusedExports) {
    Write-Host "  - $($Export.Name) in $($Export.File)" -ForegroundColor Gray
}

Write-Host "`nUnused Imports ($($DeadCode.UnusedImports.Count)):" -ForegroundColor Red
foreach ($Import in $DeadCode.UnusedImports) {
    Write-Host "  - $($Import.Name) from '$($Import.Source)' in $($Import.File)" -ForegroundColor Gray
}

Write-Host "`nEmpty Files ($($DeadCode.EmptyFiles.Count)):" -ForegroundColor Red
foreach ($EmptyFile in $DeadCode.EmptyFiles) {
    $RelPath = $EmptyFile.Replace($TargetFolder + "\", "")
    Write-Host "  - $RelPath" -ForegroundColor Gray
}

$TotalDead = $DeadCode.UnusedExports.Count + $DeadCode.UnusedImports.Count + $DeadCode.EmptyFiles.Count

Write-Host "`nTOTAL DEAD CODE ITEMS: $TotalDead" -ForegroundColor Magenta

# Automatic cleanup (if not DryRun)
if (-not $DryRun -and $TotalDead -gt 0) {
    if (-not $Force) {
        $Confirm = Read-Host "`nDo you want to automatically delete all dead code items? (y/N)"
        if ($Confirm -ne 'y' -and $Confirm -ne 'Y') {
            Write-Host "Deletion cancelled by user" -ForegroundColor Yellow
            exit 0
        }
    }
    
    Write-Host "`nSTARTING AUTOMATIC CLEANUP..." -ForegroundColor Red
    $DeletedCount = 0
    
    # Delete empty files
    foreach ($EmptyFile in $DeadCode.EmptyFiles) {
        try {
            Remove-Item -Path $EmptyFile -Force
            Write-Host "Deleted empty file: $($EmptyFile.Replace($TargetFolder + '\', ''))" -ForegroundColor Green
            $DeletedCount++
        } catch {
            Write-Host "Failed to delete: $($EmptyFile.Replace($TargetFolder + '\', ''))" -ForegroundColor Red
        }
    }
    
    # Clean unused imports from files
    $ProcessedFiles = @{}
    foreach ($Import in $DeadCode.UnusedImports) {
        $FilePath = Join-Path $TargetFolder $Import.File
        
        if (-not $ProcessedFiles.ContainsKey($FilePath)) {
            $ProcessedFiles[$FilePath] = Get-Content -Path $FilePath -Raw -Encoding UTF8
        }
        
        # Remove the unused import
        $EscapedImportName = [regex]::Escape($Import.Name)
        $EscapedSource = [regex]::Escape($Import.Source)
        
        # Single import removal
        $SingleImportRegex = "import\s+\{\s*$EscapedImportName\s*\}\s+from\s+[""']$EscapedSource[""'][;]?\s*\n?"
        $ProcessedFiles[$FilePath] = $ProcessedFiles[$FilePath] -replace $SingleImportRegex, ""
        
        # Multiple import removal (remove only the specific import)
        $MultipleImportRegex = "(\{\s*)([^}]*?)$EscapedImportName\s*,?\s*([^}]*?)(\s*\})"
        $ProcessedFiles[$FilePath] = $ProcessedFiles[$FilePath] -replace $MultipleImportRegex, '$1$2$3$4' -replace '\{\s*,', '{' -replace ',\s*\}', '}'
    }
    
    # Save processed files
    foreach ($FilePath in $ProcessedFiles.Keys) {
        try {
            Set-Content -Path $FilePath -Value $ProcessedFiles[$FilePath] -Encoding UTF8
            $RelPath = $FilePath.Replace($TargetFolder + "\", "")
            Write-Host "Cleaned unused imports from: $RelPath" -ForegroundColor Green
            $DeletedCount++
        } catch {
            Write-Host "Failed to update: $($FilePath.Replace($TargetFolder + '\', ''))" -ForegroundColor Red
        }
    }
    
    Write-Host "`nCOMPLETED: Deleted $DeletedCount dead code items!" -ForegroundColor Green
}

Write-Host "`nSCRIPT COMPLETED" -ForegroundColor Cyan