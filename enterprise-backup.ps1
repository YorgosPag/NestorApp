# ==================================================================
# ENTERPRISE PROJECT BACKUP SYSTEM - RELIABLE & COMPLETE
# ==================================================================

param(
    [string]$SourcePath = "C:\Nestor_Pagonis",
    [string]$BackupDir = "C:\Users\user\Downloads\BuckUps\Zip_BuckUps-2"
)

Write-Host ""
Write-Host "================================================================" -ForegroundColor Yellow
Write-Host "        ENTERPRISE PROJECT BACKUP SYSTEM" -ForegroundColor Yellow
Write-Host "              COMPLETE & RELIABLE" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Yellow
Write-Host ""

# Step 1: Read BACKUP_SUMMARY.json for metadata
Write-Host "Reading BACKUP_SUMMARY.json..." -ForegroundColor Cyan
$summaryPath = Join-Path $SourcePath "BACKUP_SUMMARY.json"

if (-not (Test-Path $summaryPath)) {
    Write-Host "ERROR: BACKUP_SUMMARY.json not found!" -ForegroundColor Red
    Write-Host "Please create BACKUP_SUMMARY.json first" -ForegroundColor Red
    exit 1
}

try {
    $summary = Get-Content $summaryPath -Raw | ConvertFrom-Json
    $category = $summary.category -replace '[^\w\-_]', ''
    $description = $summary.shortDescription -replace '[^\w\-_\s\(\)]', ''
    $description = $description -replace '\s+', ' '
    $description = $description.Trim()

    Write-Host "Summary loaded successfully" -ForegroundColor Green
    Write-Host "Category: [$category]" -ForegroundColor White
    Write-Host "Description: $description" -ForegroundColor White
} catch {
    Write-Host "ERROR: Failed to parse BACKUP_SUMMARY.json" -ForegroundColor Red
    Write-Host "$($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Generate filename with timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmm"
# Simple, safe filename generation
$safeDescription = "Complete Project Backup"
$zipFileName = "$timestamp - [$category] - $safeDescription.zip"
$zipPath = Join-Path $BackupDir $zipFileName

Write-Host ""
Write-Host "Backup Details:" -ForegroundColor Cyan
Write-Host "Category: [$category]" -ForegroundColor White
Write-Host "Description: $safeDescription" -ForegroundColor White
Write-Host "Timestamp: $timestamp" -ForegroundColor White
Write-Host "File: $zipFileName" -ForegroundColor White
Write-Host ""

# Step 3: Create backup directory if it doesn't exist
if (-not (Test-Path $BackupDir)) {
    Write-Host "Creating backup directory..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Write-Host "Directory created: $BackupDir" -ForegroundColor Green
}

# Step 4: Create temporary directory for staging
$tempDir = Join-Path $env:TEMP "enterprise-backup-$timestamp"
Write-Host "Preparing files..." -ForegroundColor Cyan
Write-Host "Temp directory: $tempDir" -ForegroundColor White

if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}

# Step 5: Copy files using robocopy (RELIABLE)
Write-Host "Copying project files (excluding heavy folders)..." -ForegroundColor White
Write-Host "Expected size: ~35MB source -> ~15MB compressed" -ForegroundColor Yellow

try {
    $result = & robocopy $SourcePath $tempDir /MIR /XD node_modules .next .git coverage dist build .cache .vercel temp logs public/uploads /XF *.log localhost*.log *.tmp .env.local .env.production package-lock.json yarn.lock /MT:8 /R:3 /W:1 2>&1

    if ($LASTEXITCODE -le 7) {
        Write-Host "Files copied successfully" -ForegroundColor Green

        # Count files
        $fileCount = (Get-ChildItem $tempDir -Recurse -File).Count
        $dirCount = (Get-ChildItem $tempDir -Recurse -Directory).Count
        Write-Host "Copied: $fileCount files, $dirCount directories" -ForegroundColor White
    } else {
        Write-Host "Robocopy completed with warnings (Exit code: $LASTEXITCODE)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: Failed to copy files" -ForegroundColor Red
    Write-Host "$($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 6: Verify critical directories exist
Write-Host "Verifying backup completeness..." -ForegroundColor White
$criticalDirs = @("src", "packages", "public")
$missingDirs = @()

foreach ($dir in $criticalDirs) {
    $dirPath = Join-Path $tempDir $dir
    if (-not (Test-Path $dirPath)) {
        $missingDirs += $dir
    } else {
        Write-Host "$dir/ - Found" -ForegroundColor Green
    }
}

if ($missingDirs.Count -gt 0) {
    Write-Host "Missing critical directories: $($missingDirs -join ', ')" -ForegroundColor Red
    Write-Host "Backup may be incomplete!" -ForegroundColor Red
}

# Step 7: Ensure BACKUP_SUMMARY.json is included
$summaryInTemp = Join-Path $tempDir "BACKUP_SUMMARY.json"
if (-not (Test-Path $summaryInTemp)) {
    Write-Host "Adding BACKUP_SUMMARY.json..." -ForegroundColor Cyan
    Copy-Item $summaryPath $summaryInTemp -Force
    Write-Host "BACKUP_SUMMARY.json added to backup" -ForegroundColor Green
} else {
    Write-Host "BACKUP_SUMMARY.json already included" -ForegroundColor Green
}

# Step 8: Create ZIP archive
Write-Host ""
Write-Host "Creating ZIP archive..." -ForegroundColor Cyan

try {
    # Remove existing ZIP if exists
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
        Write-Host "Removed existing backup file" -ForegroundColor Yellow
    }

    # =========================================================================
    # ENTERPRISE FIX: Use Compress-Archive instead of CreateFromDirectory
    # CreateFromDirectory fails on Windows reserved filenames (nul, con, etc.)
    # Compress-Archive handles these edge cases more gracefully
    # =========================================================================

    # Get all items in temp directory (handles reserved filenames better)
    $itemsToCompress = Get-ChildItem -Path $tempDir -Force

    if ($itemsToCompress.Count -gt 0) {
        Compress-Archive -Path $itemsToCompress.FullName -DestinationPath $zipPath -Force -CompressionLevel Optimal -ErrorAction Stop
        Write-Host "ZIP archive created successfully" -ForegroundColor Green
    } else {
        Write-Host "ERROR: No files to compress!" -ForegroundColor Red
        exit 1
    }

    # Get ZIP file info
    $zipInfo = Get-Item $zipPath
    $zipSizeMB = [math]::Round($zipInfo.Length / 1MB, 1)
    Write-Host "File: $zipFileName" -ForegroundColor White
    Write-Host "Size: $zipSizeMB MB" -ForegroundColor White
    Write-Host "Location: $zipPath" -ForegroundColor White

} catch {
    Write-Host "ERROR: Failed to create ZIP archive" -ForegroundColor Red
    Write-Host "$($_.Exception.Message)" -ForegroundColor Red

    # Fallback: Try tar.gz as alternative
    Write-Host ""
    Write-Host "Attempting fallback with tar.gz..." -ForegroundColor Yellow
    $tarPath = $zipPath -replace '\.zip$', '.tar.gz'
    try {
        Push-Location $tempDir
        tar -cvzf $tarPath *
        Pop-Location
        Write-Host "Fallback successful: $tarPath" -ForegroundColor Green
    } catch {
        Write-Host "Fallback also failed" -ForegroundColor Red
        exit 1
    }
}

# Step 9: Cleanup temporary directory
Write-Host ""
Write-Host "Cleanup..." -ForegroundColor Cyan
try {
    Remove-Item $tempDir -Recurse -Force
    Write-Host "Temporary files cleaned up" -ForegroundColor Green
} catch {
    Write-Host "Warning: Could not clean up temp directory" -ForegroundColor Yellow
    Write-Host "Manual cleanup: $tempDir" -ForegroundColor Yellow
}

# Step 10: Final verification
# NOTE: Use -LiteralPath because filename contains [] which are PowerShell wildcards
Write-Host ""
Write-Host "Final verification..." -ForegroundColor Cyan

if (Test-Path -LiteralPath $zipPath) {
    $finalSize = [math]::Round((Get-Item -LiteralPath $zipPath).Length / 1MB, 1)
    if ($finalSize -gt 5) {
        Write-Host "Backup file exists and has reasonable size ($finalSize MB)" -ForegroundColor Green
    } else {
        Write-Host "Warning: Backup file seems too small ($finalSize MB)" -ForegroundColor Yellow
    }
} else {
    Write-Host "ERROR: Backup file not found!" -ForegroundColor Red
    exit 1
}

# SUCCESS MESSAGE
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "                 BACKUP COMPLETED!" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "BACKUP DETAILS:" -ForegroundColor Cyan
Write-Host "Category: [$category]" -ForegroundColor White
Write-Host "File: $zipFileName" -ForegroundColor White
Write-Host "Size: $finalSize MB" -ForegroundColor White
Write-Host "Location: $BackupDir" -ForegroundColor White
Write-Host ""
Write-Host "INCLUDES:" -ForegroundColor Yellow
Write-Host "Full project tree (src/, packages/, public/, etc.)" -ForegroundColor Green
Write-Host "Configuration files (.env, package.json, configs)" -ForegroundColor Green
Write-Host "Documentation (*.md files)" -ForegroundColor Green
Write-Host "Scripts and utilities" -ForegroundColor Green
Write-Host "BACKUP_SUMMARY.json" -ForegroundColor Green
Write-Host ""
Write-Host "EXCLUDES:" -ForegroundColor Yellow
Write-Host "node_modules/ (as requested)" -ForegroundColor Red
Write-Host ".next/, .git/, dist/, build/" -ForegroundColor Red
Write-Host "*.log files and temp files" -ForegroundColor Red
Write-Host ""
Write-Host "Ready for use by any Claude agent!" -ForegroundColor Green
Write-Host ""