# ===================================================================
# DXF VIEWER BACKUP SCRIPT με Automatic CHANGELOG
# ===================================================================
# Χρήση: .\make-dxf-backup.ps1
#
# Τι κάνει:
# - Ζιπάρει τον φάκελο dxf-viewer
# - Σου ζητάει τα βήματα που έκανες (interactive)
# - Δημιουργεί CHANGELOG.md μέσα στο zip
# - Αποθηκεύει στο: C:\Users\user\Downloads\BuckUps\Zip_BuckUps-2
# ===================================================================

# Χρώματα για καλύτερη εμφάνιση
$Host.UI.RawUI.ForegroundColor = "White"

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      DXF VIEWER - SMART BACKUP με CHANGELOG              ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ===================================================================
# ΒΗΜΑ 1: Ορισμός Paths
# ===================================================================
$sourcePath = "F:\Pagonis_Nestor\src\subapps\dxf-viewer"
$destinationRoot = "C:\Users\user\Downloads\BuckUps\Zip_BuckUps-2"
$timestamp = Get-Date -Format "yyyyMMdd_HHmm"

# Έλεγχος ότι υπάρχει ο φάκελος προέλευσης
if (-not (Test-Path $sourcePath)) {
    Write-Host "❌ ΣΦΑΛΜΑ: Ο φάκελος δεν βρέθηκε:" -ForegroundColor Red
    Write-Host "   $sourcePath" -ForegroundColor Yellow
    exit 1
}

# Δημιουργία φακέλου προορισμού αν δεν υπάρχει
if (-not (Test-Path $destinationRoot)) {
    New-Item -ItemType Directory -Path $destinationRoot -Force | Out-Null
    Write-Host "✅ Δημιουργήθηκε φάκελος: $destinationRoot" -ForegroundColor Green
}

# ===================================================================
# ΒΗΜΑ 2: Συλλογή Πληροφοριών (Interactive)
# ===================================================================
Write-Host "📝 ΠΛΗΡΟΦΟΡΙΕΣ BACKUP" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""

# Επιλογή Κατηγορίας
Write-Host "Επίλεξε ΚΑΤΗΓΟΡΙΑ:" -ForegroundColor Cyan
Write-Host "  1. [FIX]          - Διόρθωση bug" -ForegroundColor White
Write-Host "  2. [FEATURE]      - Νέα λειτουργία" -ForegroundColor White
Write-Host "  3. [REFACTOR]     - Αναδιοργάνωση κώδικα" -ForegroundColor White
Write-Host "  4. [STABLE]       - Σταθερή έκδοση (milestone)" -ForegroundColor Green
Write-Host "  5. [WIP]          - Work in Progress" -ForegroundColor White
Write-Host "  6. [CLEANUP]      - Καθαρισμός κώδικα" -ForegroundColor White
Write-Host "  7. [EXPERIMENTAL] - Πειραματικό" -ForegroundColor White
Write-Host "  8. [BROKEN]       - Σπασμένο (για αναφορά)" -ForegroundColor Red
Write-Host ""

do {
    $categoryChoice = Read-Host "Επιλογή (1-8)"
} while ($categoryChoice -notmatch '^[1-8]$')

$categories = @{
    "1" = "FIX"
    "2" = "FEATURE"
    "3" = "REFACTOR"
    "4" = "STABLE"
    "5" = "WIP"
    "6" = "CLEANUP"
    "7" = "EXPERIMENTAL"
    "8" = "BROKEN"
}

$category = $categories[$categoryChoice]

Write-Host ""
Write-Host "✅ Κατηγορία: [$category]" -ForegroundColor Green
Write-Host ""

# Σύντομη Περιγραφή (για τίτλο)
Write-Host "Σύντομη περιγραφή (για τίτλο):" -ForegroundColor Cyan
Write-Host "  Παράδειγμα: 'Grips Layer Selection Working'" -ForegroundColor DarkGray
$shortDescription = Read-Host "Περιγραφή"

if ([string]::IsNullOrWhiteSpace($shortDescription)) {
    $shortDescription = "Backup"
}

Write-Host ""

# ===================================================================
# ΒΗΜΑ 3: Συλλογή Λεπτομερειών για CHANGELOG
# ===================================================================
Write-Host "📋 ΛΕΠΤΟΜΕΡΕΙΕΣ για CHANGELOG (πάτα Enter για skip)" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""

Write-Host "1️⃣  Τι ΠΡΟΒΛΗΜΑ υπήρχε; (ή τι χαρακτηριστικό προστέθηκε)" -ForegroundColor Cyan
$problem = Read-Host "   "

Write-Host ""
Write-Host "2️⃣  Ποια ήταν η ΑΙΤΙΑ; (ή γιατί χρειαζόταν)" -ForegroundColor Cyan
$cause = Read-Host "   "

Write-Host ""
Write-Host "3️⃣  Ποια ΑΡΧΕΙΑ άλλαξαν; (comma-separated)" -ForegroundColor Cyan
Write-Host "   Παράδειγμα: DxfCanvas.tsx, DXF_LOADING_FLOW.md" -ForegroundColor DarkGray
$filesChanged = Read-Host "   "

Write-Host ""
Write-Host "4️⃣  Τι ΛΥΣΗ εφαρμόστηκε; (τι άλλαξε στον κώδικα)" -ForegroundColor Cyan
$solution = Read-Host "   "

Write-Host ""
Write-Host "5️⃣  Τι TESTING έγινε; (πώς επαλήθευσες ότι δουλεύει)" -ForegroundColor Cyan
$testing = Read-Host "   "

Write-Host ""
Write-Host "6️⃣  ΣΗΜΕΙΩΣΕΙΣ / TODO / Επόμενα Βήματα;" -ForegroundColor Cyan
$notes = Read-Host "   "

Write-Host ""

# ===================================================================
# ΒΗΜΑ 4: Δημιουργία Ονόματος Backup
# ===================================================================
$backupName = "$timestamp - [$category] - $shortDescription"
$tempFolder = Join-Path $env:TEMP "dxf-backup-temp-$timestamp"
$zipPath = Join-Path $destinationRoot "$backupName.zip"

Write-Host "📦 Όνομα Backup:" -ForegroundColor Cyan
Write-Host "   $backupName.zip" -ForegroundColor Yellow
Write-Host ""

# ===================================================================
# ΒΗΜΑ 5: Δημιουργία CHANGELOG.md
# ===================================================================
$changelogContent = @"
# CHANGELOG - $shortDescription

**Ημερομηνία:** $(Get-Date -Format "dd/MM/yyyy HH:mm:ss")
**Κατηγορία:** [$category]
**Backup:** $backupName

═══════════════════════════════════════════════════════════

## 🎯 ΠΕΡΙΛΗΨΗ

$(if ($problem) { "### Πρόβλημα / Χαρακτηριστικό:`n$problem`n" } else { "[Δεν συμπληρώθηκε]`n" })

$(if ($cause) { "### Αιτία / Λόγος:`n$cause`n" } else { "[Δεν συμπληρώθηκε]`n" })

---

## 🔧 ΑΛΛΑΓΕΣ ΚΩΔΙΚΑ

### Αρχεία που τροποποιήθηκαν:
$(if ($filesChanged) {
    $files = $filesChanged -split ',' | ForEach-Object { $_.Trim() }
    ($files | ForEach-Object { "- $_" }) -join "`n"
} else {
    "[Δεν καταγράφηκαν αρχεία]"
})

### Λύση που εφαρμόστηκε:
$(if ($solution) { $solution } else { "[Δεν συμπληρώθηκε]" })

---

## ✅ ΑΠΟΤΕΛΕΣΜΑ & TESTING

### Testing που έγινε:
$(if ($testing) { $testing } else { "[Δεν καταγράφηκε testing]" })

### Κατάσταση:
$(if ($category -eq "STABLE") {
    "✅ ΣΤΑΘΕΡΗ ΕΚΔΟΣΗ - Όλα δουλεύουν σωστά!"
} elseif ($category -eq "BROKEN") {
    "❌ ΣΠΑΣΜΕΝΟ - Για αναφορά μόνο!"
} elseif ($category -eq "WIP") {
    "⚠️  Work in Progress - Δεν έχει ολοκληρωθεί"
} else {
    "[TODO: Ενημέρωσε την κατάσταση μετά από testing]"
})

---

## 📝 ΣΗΜΕΙΩΣΕΙΣ

$(if ($notes) { $notes } else { "[Δεν υπάρχουν επιπλέον σημειώσεις]" })

---

## 📚 METADATA

- **Source Path:** F:\Pagonis_Nestor\src\subapps\dxf-viewer
- **Backup Location:** C:\Users\user\Downloads\BuckUps\Zip_BuckUps-2
- **Timestamp:** $timestamp
- **User:** Γιώργος Παγώνης
- **Generated by:** make-dxf-backup.ps1 v1.0

---

## 🔍 ΠΛΗΡΟΦΟΡΙΕΣ ΚΑΤΗΓΟΡΙΩΝ

**[FIX]** = Διόρθωση bug που υπήρχε
**[FEATURE]** = Νέα λειτουργία που προστέθηκε
**[REFACTOR]** = Αναδιοργάνωση κώδικα (καλύτερη δομή)
**[STABLE]** = Σταθερή έκδοση - όλα δουλεύουν (milestone)
**[WIP]** = Work in Progress - δεν έχει τελειώσει
**[CLEANUP]** = Καθαρισμός νεκρού κώδικα
**[EXPERIMENTAL]** = Πειραματικός κώδικας
**[BROKEN]** = Σπασμένο - για αναφορά

---

*Αυτό το αρχείο δημιουργήθηκε αυτόματα από το backup script.*
*Μπορείς να το επεξεργαστείς για να προσθέσεις περισσότερες λεπτομέρειες.*

═══════════════════════════════════════════════════════════
"@

# ===================================================================
# ΒΗΜΑ 6: Δημιουργία Temp Folder με Source + CHANGELOG
# ===================================================================
Write-Host "⏳ Προετοιμασία αρχείων..." -ForegroundColor Cyan

# Δημιουργία temp folder
New-Item -ItemType Directory -Path $tempFolder -Force | Out-Null

# Αντιγραφή dxf-viewer folder
Write-Host "   📁 Αντιγραφή αρχείων..." -ForegroundColor White
Copy-Item -Path $sourcePath -Destination (Join-Path $tempFolder "dxf-viewer") -Recurse -Force

# Δημιουργία CHANGELOG.md στο root του backup
$changelogPath = Join-Path $tempFolder "CHANGELOG.md"
$changelogContent | Out-File -FilePath $changelogPath -Encoding UTF8

Write-Host "   ✅ CHANGELOG.md δημιουργήθηκε" -ForegroundColor Green

# ===================================================================
# ΒΗΜΑ 7: Δημιουργία ZIP
# ===================================================================
Write-Host ""
Write-Host "📦 Δημιουργία ZIP αρχείου..." -ForegroundColor Cyan

try {
    # Διαγραφή παλιού zip αν υπάρχει
    if (Test-Path $zipPath) {
        Remove-Item -Path $zipPath -Force
        Write-Host "   🗑️  Διαγράφηκε παλιό backup με το ίδιο όνομα" -ForegroundColor Yellow
    }

    # Δημιουργία ZIP
    Compress-Archive -Path "$tempFolder\*" -DestinationPath $zipPath -CompressionLevel Optimal -Force

    Write-Host "   ✅ ZIP δημιουργήθηκε επιτυχώς!" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "❌ ΣΦΑΛΜΑ κατά τη δημιουργία ZIP:" -ForegroundColor Red
    Write-Host "   $_" -ForegroundColor Yellow
    exit 1
}
finally {
    # Καθαρισμός temp folder
    if (Test-Path $tempFolder) {
        Remove-Item -Path $tempFolder -Recurse -Force
    }
}

# ===================================================================
# ΒΗΜΑ 8: Επιτυχής Ολοκλήρωση
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
Write-Host "   ├── CHANGELOG.md  ← Πλήρεις λεπτομέρειες των αλλαγών" -ForegroundColor White
Write-Host "   └── dxf-viewer\   ← Ο πλήρης φάκελος" -ForegroundColor White
Write-Host ""

Write-Host "💡 ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ:" -ForegroundColor Yellow
Write-Host "   1. Άνοιξε το ZIP και διάβασε το CHANGELOG.md" -ForegroundColor White
Write-Host "   2. Αν χρειάζεται, επεξεργάσου το CHANGELOG για περισσότερες λεπτομέρειες" -ForegroundColor White
Write-Host "   3. Το backup είναι έτοιμο για αρχειοθέτηση!" -ForegroundColor White
Write-Host ""

# Ερώτηση για άνοιγμα φακέλου
$openFolder = Read-Host "Θέλεις να ανοίξεις τον φάκελο των backups; (Y/N)"
if ($openFolder -eq "Y" -or $openFolder -eq "y") {
    Start-Process explorer.exe -ArgumentList $destinationRoot
}

Write-Host ""
Write-Host "🎉 Όλα έτοιμα!" -ForegroundColor Green
Write-Host ""
