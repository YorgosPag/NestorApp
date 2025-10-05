# ===================================================================
# AUTOMATIC DXF VIEWER BACKUP SCRIPT
# ===================================================================
# Χρήση: .\auto-backup.ps1
#
# Τι κάνει:
# 1. Διαβάζει BACKUP_SUMMARY.json (που έχει γράψει ο Claude)
# 2. Δημιουργεί CHANGELOG.md αυτόματα
# 3. Ζιπάρει τον dxf-viewer folder
# 4. ZERO ερωτήσεις - ΠΛΗΡΩΣ ΑΥΤΟΜΑΤΟ!
# ===================================================================

# Set UTF-8 encoding for PowerShell console and output
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Host.UI.RawUI.ForegroundColor = "White"

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         AUTOMATIC DXF VIEWER BACKUP                      ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ===================================================================
# Paths
# ===================================================================
$sourcePath = "F:\Pagonis_Nestor\src\subapps\dxf-viewer"
$destinationRoot = "C:\Users\user\Downloads\BuckUps\Zip_BuckUps-2"
$summaryFile = "F:\Pagonis_Nestor\BACKUP_SUMMARY.json"
$timestamp = Get-Date -Format "yyyyMMdd_HHmm"

# ===================================================================
# Check if summary file exists
# ===================================================================
if (-not (Test-Path $summaryFile)) {
    Write-Host "❌ ERROR: BACKUP_SUMMARY.json not found!" -ForegroundColor Red
    Write-Host "   Expected location: $summaryFile" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 Solution:" -ForegroundColor Cyan
    Write-Host "   Ask Claude to create BACKUP_SUMMARY.json first!" -ForegroundColor White
    Write-Host ""
    exit 1
}

# ===================================================================
# Read BACKUP_SUMMARY.json
# ===================================================================
Write-Host "📋 Reading BACKUP_SUMMARY.json..." -ForegroundColor Cyan

try {
    $summary = Get-Content -Path $summaryFile -Raw -Encoding UTF8 | ConvertFrom-Json
    Write-Host "   ✅ Summary loaded successfully" -ForegroundColor Green
}
catch {
    Write-Host "❌ ERROR: Failed to parse BACKUP_SUMMARY.json" -ForegroundColor Red
    Write-Host "   $_" -ForegroundColor Yellow
    exit 1
}

# ===================================================================
# Extract info from summary
# ===================================================================
$category = $summary.category
$shortDescription = $summary.shortDescription
$problem = $summary.problem
$cause = $summary.cause
$filesChanged = $summary.filesChanged
$solution = $summary.solution
$testing = $summary.testing
$notes = $summary.notes

# ===================================================================
# Create backup name
# ===================================================================
$backupName = "$timestamp - [$category] - $shortDescription"
$tempFolder = Join-Path $env:TEMP "dxf-backup-temp-$timestamp"
$zipPath = Join-Path $destinationRoot "$backupName.zip"

Write-Host ""
Write-Host "📦 Backup Details:" -ForegroundColor Yellow
Write-Host "   Category:    [$category]" -ForegroundColor White
Write-Host "   Description: $shortDescription" -ForegroundColor White
Write-Host "   Timestamp:   $timestamp" -ForegroundColor White
Write-Host ""

# ===================================================================
# Check source folder
# ===================================================================
if (-not (Test-Path $sourcePath)) {
    Write-Host "❌ ERROR: Source folder not found!" -ForegroundColor Red
    Write-Host "   $sourcePath" -ForegroundColor Yellow
    exit 1
}

# Create destination folder if needed
if (-not (Test-Path $destinationRoot)) {
    New-Item -ItemType Directory -Path $destinationRoot -Force | Out-Null
}

# ===================================================================
# Generate CHANGELOG.md
# ===================================================================
Write-Host "📝 Generating CHANGELOG.md..." -ForegroundColor Cyan

$filesChangedText = if ($filesChanged) {
    ($filesChanged | ForEach-Object { "- $_" }) -join "`n"
} else {
    "[No files specified]"
}

$changelogContent = @"
# CHANGELOG - $shortDescription

**Ημερομηνία:** $(Get-Date -Format "dd/MM/yyyy HH:mm:ss")
**Κατηγορία:** [$category]
**Backup:** $backupName

═══════════════════════════════════════════════════════════

## 🎯 ΠΕΡΙΛΗΨΗ

### Πρόβλημα / Χαρακτηριστικό:
$problem

### Αιτία / Λόγος:
$cause

---

## 🔧 ΑΛΛΑΓΕΣ ΚΩΔΙΚΑ

### Αρχεία που τροποποιήθηκαν:
$filesChangedText

### Λύση που εφαρμόστηκε:
$solution

---

## ✅ ΑΠΟΤΕΛΕΣΜΑ & TESTING

### Testing που έγινε:
$testing

### Κατάσταση:
$(if ($category -eq "STABLE") {
    "✅ ΣΤΑΘΕΡΗ ΕΚΔΟΣΗ - Όλα δουλεύουν σωστά!"
} elseif ($category -eq "BROKEN") {
    "❌ ΣΠΑΣΜΕΝΟ - Για αναφορά μόνο!"
} elseif ($category -eq "WIP") {
    "⚠️  Work in Progress - Δεν έχει ολοκληρωθεί"
} elseif ($category -eq "FIX") {
    "✅ BUG FIXED - Το πρόβλημα διορθώθηκε!"
} elseif ($category -eq "FEATURE") {
    "🚀 NEW FEATURE - Νέα λειτουργία προστέθηκε!"
} else {
    "✅ Ολοκληρώθηκε"
})

---

## 📝 ΣΗΜΕΙΩΣΕΙΣ

$notes

---

## 📚 METADATA

- **Source Path:** F:\Pagonis_Nestor\src\subapps\dxf-viewer
- **Backup Location:** C:\Users\user\Downloads\BuckUps\Zip_BuckUps-2
- **Timestamp:** $timestamp
$(if ($summary.contributors) {
"- **User:** $($summary.contributors.user)
- **AI Assistant:** $($summary.contributors.assistant)
- **Session Date:** $($summary.contributors.sessionDate)"
})

---

## 🔍 RELATED BACKUPS

$(if ($summary.relatedBackups) {
    if ($summary.relatedBackups.workingReference) {
        "**Working Reference:** $($summary.relatedBackups.workingReference)`n"
    }
    if ($summary.relatedBackups.previousBroken) {
        "**Previous Issues:** $($summary.relatedBackups.previousBroken)`n"
    }
})

---

## 📖 ΚΑΤΗΓΟΡΙΕΣ BACKUP

**[FIX]** = Διόρθωση bug που υπήρχε
**[FEATURE]** = Νέα λειτουργία που προστέθηκε
**[REFACTOR]** = Αναδιοργάνωση κώδικα (καλύτερη δομή)
**[STABLE]** = Σταθερή έκδοση - όλα δουλεύουν (milestone)
**[WIP]** = Work in Progress - δεν έχει τελειώσει
**[CLEANUP]** = Καθαρισμός νεκρού κώδικα
**[EXPERIMENTAL]** = Πειραματικός κώδικας
**[BROKEN]** = Σπασμένο - για αναφορά

---

*Αυτό το CHANGELOG δημιουργήθηκε ΑΥΤΟΜΑΤΑ από το auto-backup.ps1*
*Βασισμένο σε BACKUP_SUMMARY.json που έγραψε ο Claude*

═══════════════════════════════════════════════════════════
"@

Write-Host "   ✅ CHANGELOG.md created" -ForegroundColor Green

# ===================================================================
# Create temp folder with source + CHANGELOG
# ===================================================================
Write-Host ""
Write-Host "⏳ Preparing files..." -ForegroundColor Cyan

New-Item -ItemType Directory -Path $tempFolder -Force | Out-Null

# Copy dxf-viewer folder
Write-Host "   📁 Copying source files..." -ForegroundColor White
Copy-Item -Path $sourcePath -Destination (Join-Path $tempFolder "dxf-viewer") -Recurse -Force

# Create CHANGELOG.md with UTF-8 encoding (using Out-File for Greek character support)
$changelogPath = Join-Path $tempFolder "CHANGELOG.md"
$changelogContent | Out-File -FilePath $changelogPath -Encoding UTF8 -NoNewline

Write-Host "   ✅ Files ready" -ForegroundColor Green

# ===================================================================
# Create ZIP
# ===================================================================
Write-Host ""
Write-Host "📦 Creating ZIP archive..." -ForegroundColor Cyan

try {
    # Remove old zip if exists
    if (Test-Path $zipPath) {
        Remove-Item -Path $zipPath -Force
        Write-Host "   🗑️  Removed old backup with same name" -ForegroundColor Yellow
    }

    # Create ZIP
    Compress-Archive -Path "$tempFolder\*" -DestinationPath $zipPath -CompressionLevel Optimal -Force
    Write-Host "   ✅ ZIP created successfully!" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "❌ ERROR during ZIP creation:" -ForegroundColor Red
    Write-Host "   $_" -ForegroundColor Yellow
    exit 1
}
finally {
    # Cleanup temp folder
    if (Test-Path $tempFolder) {
        Remove-Item -Path $tempFolder -Recurse -Force
    }
}

# ===================================================================
# Success!
# ===================================================================
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              ✅ BACKUP ΟΛΟΚΛΗΡΩΘΗΚΕ!                     ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

$fileSize = (Get-Item $zipPath).Length / 1MB

Write-Host "📁 Όνομα:     $backupName.zip" -ForegroundColor Cyan
Write-Host "📍 Τοποθεσία: $destinationRoot" -ForegroundColor Cyan
Write-Host "📊 Μέγεθος:   $([math]::Round($fileSize, 2)) MB" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Περιεχόμενα ZIP:" -ForegroundColor Yellow
Write-Host "   ├── CHANGELOG.md  ← Πλήρεις λεπτομέρειες (auto-generated)" -ForegroundColor White
Write-Host "   └── dxf-viewer\   ← Source code" -ForegroundColor White
Write-Host ""

Write-Host "🎯 Category: [$category]" -ForegroundColor $(
    if ($category -eq "STABLE") { "Green" }
    elseif ($category -eq "BROKEN") { "Red" }
    elseif ($category -eq "FIX") { "Green" }
    elseif ($category -eq "FEATURE") { "Cyan" }
    else { "Yellow" }
)
Write-Host ""

# Ask to open folder
$openFolder = Read-Host "Θέλεις να ανοίξεις τον φάκελο των backups; (Y/N)"
if ($openFolder -eq "Y" -or $openFolder -eq "y") {
    Start-Process explorer.exe -ArgumentList $destinationRoot
}

Write-Host ""
Write-Host "🎉 Όλα έτοιμα! Το BACKUP_SUMMARY.json μπορεί να διαγραφεί τώρα." -ForegroundColor Green
Write-Host ""

# Optional: Delete BACKUP_SUMMARY.json after successful backup
$deleteSummary = Read-Host "Διαγραφή BACKUP_SUMMARY.json; (Y/N)"
if ($deleteSummary -eq "Y" -or $deleteSummary -eq "y") {
    Remove-Item -Path $summaryFile -Force
    Write-Host "✅ BACKUP_SUMMARY.json διαγράφηκε" -ForegroundColor Green
}
