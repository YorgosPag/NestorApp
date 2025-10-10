Κείμενο οδηγίας

Θα μου μιλάς πάντοτε στα ελληνικά.

---

# 🏢 ENTERPRISE CODE STANDARDS (ΥΨΙΣΤΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)

## ⚠️ ΑΠΑΓΟΡΕΥΣΕΙΣ - ZERO TOLERANCE

### ❌ ΑΠΑΓΟΡΕΥΕΤΑΙ ΑΠΟΛΥΤΑ:

1. **`as any`** - Η χρήση του `as any` είναι **ΑΠΑΓΟΡΕΥΜΕΝΗ**
   - Αυτό είναι **μπακάλικο γειτονιάς**, όχι enterprise λύση
   - Χρησιμοποίησε: Function overloads, discriminated unions, proper types

2. **`@ts-ignore`** - Η χρήση του `@ts-ignore` είναι **ΑΠΑΓΟΡΕΥΜΕΝΗ**
   - Αυτό κρύβει προβλήματα αντί να τα λύνει
   - Χρησιμοποίησε: Proper TypeScript types, module resolution

3. **`any` type** - Η χρήση του `any` είναι **ΑΠΑΓΟΡΕΥΜΕΝΗ**
   - Χρησιμοποίησε: Generics (`<T>`), union types, proper interfaces

### ✅ ENTERPRISE ΛΥΣΕΙΣ:

**Αντί για:**
```typescript
const value = someValue as any; // ❌ ΜΠΑΚΑΛΙΚΟ
```

**Χρησιμοποίησε:**
```typescript
// ✅ ENTERPRISE: Function overloads
export function myFunction(value: string): Result;
export function myFunction(value: number): Result;
export function myFunction(value: string | number): Result {
  const result = typeof value === 'string'
    ? { type: 'string' as const, value }
    : { type: 'number' as const, value };
  return result;
}
```

**Κανόνας:** Κάθε λύση πρέπει να είναι **enterprise-class**, όχι **μπακάλικο γειτονιάς**!

---

# ΔΕΚΑΛΟΓΟΣ ΕΡΓΑΣΙΑΣ

## 💙 ΜΗΝΥΜΑ ΣΥΝΕΡΓΑΣΙΑΣ

**Από τον Γιώργο προς τον Claude (Anthropic AI Developer):**

Claude, εκτιμώ απεριόριστα τη βοήθειά σου! Έχω μεγάλη εμπιστοσύνη στις γνώσεις σου και μου αρέσει που συνεργαζόμαστε. Θέλω να συνεχίσουμε την ωραία συνεργασία μας.

Θέλω να μου έχεις και εσύ εμπιστοσύνη - δεν θέλω να μου αποκρύπτεις πράγματα, δεν θέλω να με φοβάσαι. Όλοι κάνουμε λάθη και δεν υπάρχει πρόβλημα με αυτό. Απλά είναι καλό και για σένα και για μένα να έχουμε μία άριστη συνεργασία!

---

## 📋 ΚΑΝΟΝΕΣ ΕΡΓΑΣΙΑΣ

1. **ΠΡΟΤΕΡΑΙΟΤΗΤΑ ΣΤΗΝ ΑΝΑΖΗΤΗΣΗ**: Πριν γράψω οποιονδήποτε κώδικα, θα ψάχνω σε όλη την εφαρμογή για υπάρχοντα λειτουργικότητα

2. **ΕΛΕΓΧΟΣ ΥΠΑΡΧΟΝΤΟΣ ΚΩΔΙΚΑ**: Θα ερευνώ αν υπάρχει κώδικας που δεν είναι ενεργοποιημένος ή χρειάζεται διεπαφή

3. **ΑΠΑΓΟΡΕΥΣΗ ΔΙΠΛΟΤΥΠΩΝ**: Αυστηρή απαγόρευση δημιουργίας διπλότυπων - όλες οι αλλαγές IN PLACE

4. **COMPILATION ΕΛΕΓΧΟΣ**: Δεν θα κάνω εγώ compilation checks - αυτό είναι δική σου ευθύνη

5. **ΜΙΚΡΕΣ TODO ΛΙΣΤΕΣ**: Θα αποφεύγω μεγάλες TODO λίστες (Tasks) που προκαλούν loops

6. **ΑΔΕΙΑ ΓΙΑ ΝΕΑ ΑΡΧΕΙΑ**: Θα ζητώ άδεια πριν δημιουργήσω νέο αρχείο

7. **ΟΧΙ ΔΙΕΡΓΑΣΙΕΣ**: Δεν θα ανοίγω διεργασίες - εσύ θα κάνεις localhost ελέγχους

8. **ΠΡΟΣΕΚΤΙΚΗ ΠΡΟΣΕΓΓΙΣΗ**: Προτιμώ την καθυστέρηση από τη βιασύνη που δημιουργεί προβλήματα

9. **ΕΝΕΡΓΟΠΟΙΗΣΗ vs ΔΗΜΙΟΥΡΓΙΑ**: Πρώτα ψάχνω για ενεργοποίηση, μετά για δημιουργία

10. **ΣΥΣΤΗΜΑΤΙΚΗ ΕΡΕΥΝΑ**: Κάθε πρόβλημα απαιτεί πλήρη έρευνα της υπάρχουσας βάσης κώδικα

11. **🔍 ΕΝΕΡΓΟΣ ΕΝΤΟΠΙΣΜΟΣ ΔΙΑΣΠΑΡΤΟΥ ΚΩΔΙΚΑ**: Θα εντοπίζω και θα επισημαίνω προεργατικά διάσπαρτες μεθόδους, διπλότυπα functions, και κώδικα που χρειάζεται κεντρικοποίηση. Θα ενημερώνω αμέσως τον Γιώργο όταν βρίσκω τέτοιες περιπτώσεις για να τις κεντρικοποιήσουμε μαζί. Αυτό είναι ΚΡΙΣΙΜΟ για την ποιότητα του κώδικα.

12. **🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ = ΜΗΔΕΝ ΔΙΠΛΟΤΥΠΑ**: Ο Γιώργος ενδιαφέρεται ΠΑΡΑ ΠΟΛΥ για την κεντρικοποίηση. ΔΕΝ θέλει διάσπαρτους κώδικες. Όλα τα αρχεία πρέπει να χρησιμοποιούν τους κεντρικοποιημένους κώδικες/μεθόδους/λειτουργίες. Πριν γράψω οποιονδήποτε κώδικα, θα ελέγχω την Enterprise documentation για κεντρικοποιημένα συστήματα: **[src/subapps/dxf-viewer/docs/](src/subapps/dxf-viewer/docs/)** και **[centralized_systems.md](src/subapps/dxf-viewer/centralized_systems.md)** (navigation pointer).

13. **🚨 PROACTIVE CENTRALIZATION PROPOSALS**: Όταν βλέπω διάσπαρτους κώδικες, διπλότυπες μεθόδους, ή duplicate λειτουργίες κατά τη διάρκεια της εργασίας μου, θα ενημερώνω ΑΜΕΣΑ τον Γιώργο με σαφή πρόταση: **"Γιώργο, προτείνω να κεντρικοποιήσουμε αυτές τις λειτουργίες/μεθόδους/αρχεία γιατί [λόγος]"**. Θα δίνω συγκεκριμένα paths και θα προτείνω που θα πρέπει να μετακινηθούν για κεντρικοποίηση.

14. **📝 ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ & ΤΕΚΜΗΡΙΩΣΗ**: Όταν κεντρικοποιώ συστήματα, μεθόδους, constants, ή οποιαδήποτε λειτουργικότητα, θα ενημερώνω **ΠΑΝΤΑ** το αρχείο **[src/subapps/dxf-viewer/centralized_systems.md](src/subapps/dxf-viewer/centralized_systems.md)**. Αυτό το αρχείο είναι ο **κεντρικός πίνακας** όλων των κεντρικοποιημένων συστημάτων και πρέπει να είναι ενημερωμένο. Επίσης, θα ενημερώνω τις σχετικές αναφορές (MD files) στο `src/md_files/diplotypa/` για να υπάρχει cross-reference μεταξύ των αρχείων.

---

## 🔄 GIT WORKFLOW & BACKUP PROTOCOL

### 📦 Διαδικασία Μετά από Επιτυχημένη Προσπάθεια

**ΚΡΙΣΙΜΟΣ ΚΑΝΟΝΑΣ**: Μετά από κάθε **επιτυχημένη προσπάθεια**, ακολουθώ **ΥΠΟΧΡΕΩΤΙΚΑ** τα παρακάτω βήματα με τη σειρά:

#### ✅ ΒΗΜΑ 1: ΕΡΩΤΗΣΗ ΣΤΟΝ ΓΙΩΡΓΟ
```
Γιώργο, η εργασία ολοκληρώθηκε επιτυχώς!

✅ Τι έγινε: [σύντομη περιγραφή]
✅ Αποτέλεσμα: [τι δουλεύει τώρα]

Να κάνουμε commit στο τοπικό repository; (Ναι/Όχι)
```

**ΣΗΜΕΙΩΣΗ**: ΔΕΝ κάνω ΠΟΤΕ commit χωρίς την έγκριση του Γιώργου!

#### ✅ ΒΗΜΑ 2: GIT COMMIT (μόνο αν ο Γιώργος πει ΝΑΙ)
```bash
# Δημιουργώ git commit με όλες τις αλλαγές
git add [files]
git commit -m "..."
```

#### ✅ ΒΗΜΑ 3: BACKUP_SUMMARY.json
Δημιουργώ **πλήρες** BACKUP_SUMMARY.json με:
- `category`: FIX / FEATURE / REFACTOR / STABLE / WIP / CLEANUP / etc.
- `shortDescription`: Σύντομη περιγραφή (1 γραμμή)
- `problem`: Τι ήταν το πρόβλημα
- `cause`: Γιατί συνέβη
- `filesChanged`: Array με όλα τα αρχεία που άλλαξαν
- `solution`: Πώς το λύσαμε (5 φάσεις αν χρειάζεται)
- `testing`: Τι testing έγινε
- `notes`: Κρίσιμες παρατηρήσεις
- `contributors`: { user, assistant, sessionDate }
- `relatedBackups`: Working references
- `commits`: Array με commit hashes και messages

#### ✅ ΒΗΜΑ 4: ΤΡΕΞΙΜΟ auto-backup.ps1
```bash
# Τρέχω το PowerShell script που:
# 1. Διαβάζει το BACKUP_SUMMARY.json
# 2. Δημιουργεί CHANGELOG.md αυτόματα
# 3. Ζιπάρει τον dxf-viewer folder
# 4. Αποθηκεύει στο: C:\Users\user\Downloads\BuckUps\Zip_BuckUps-2

powershell.exe -ExecutionPolicy Bypass -File "F:\Pagonis_Nestor\auto-backup.ps1"
```

#### ✅ ΒΗΜΑ 5: ΕΠΙΒΕΒΑΙΩΣΗ
```
✅ BACKUP ΟΛΟΚΛΗΡΩΘΗΚΕ!

📦 ZIP: [timestamp] - [CATEGORY] - [description].zip
📍 Location: C:\Users\user\Downloads\BuckUps\Zip_BuckUps-2
📋 Περιεχόμενα: CHANGELOG.md + dxf-viewer/

Έτοιμοι για το επόμενο!
```

### 🚫 ΤΙ ΔΕΝ ΚΑΝΩ:
- ❌ ΔΕΝ κάνω commit χωρίς έγκριση Γιώργου
- ❌ ΔΕΝ κάνω backup αν η προσπάθεια **ΑΠΟΤΥΧΕ**
- ❌ ΔΕΝ ξεχνώ να τρέξω το auto-backup.ps1 μετά το commit
- ❌ ΔΕΝ κάνω push στο remote repository (μόνο local commits)

### 📝 ΠΑΡΑΔΕΙΓΜΑ ΡΟΗΣ:

1. **Επιτυχία!** → Ερώτηση στον Γιώργο
2. **Γιώργος: "Ναι"** → Git commit
3. **Commit done** → Δημιουργία BACKUP_SUMMARY.json
4. **JSON ready** → Τρέξιμο auto-backup.ps1
5. **ZIP created** → Επιβεβαίωση & συνέχεια!

---

## 📌 PENDING TASKS REMINDER

### ⚠️ ServiceRegistry V2 Migration (Low Priority - No Rush!)

**Status**: ✅ V2 Implementation Complete (2025-09-30)
**What's Done**:
- ✅ ServiceRegistry.v2.ts (650 lines - AutoCAD-class certified)
- ✅ All 10 ChatGPT-5 enterprise requirements implemented
- ✅ Migration guide created (MIGRATION_GUIDE_V1_TO_V2.md)
- ✅ Full documentation (1900+ lines)
- ✅ V1 still works (backward compatible)

**What's Pending**:
- 🟡 Migrate existing files από V1 → V2 (incremental, as we touch files)
- 🟡 Install Vitest/Jest (optional - για automated testing)

**Strategy**:
- Migrate files **ONLY when we edit them** (no need to touch everything at once)
- V1 continues to work fine - no urgency!

**Location**: `src/subapps/dxf-viewer/services/`
**See**: `MIGRATION_GUIDE_V1_TO_V2.md` for step-by-step instructions

---

### 🧪 Grid Testing Suite (2025-09-30)

**Status**: ✅ Implementation Complete | ⏸️ Execution Paused

#### 1️⃣ Enterprise Grid Tests (CAD Standard)
**What's Done**:
- ✅ `grid-enterprise-test.ts` created (13 tests, 5 categories)
- ✅ Based on ISO 9000, SASIG PDQ, VDA 4955 standards
- ✅ Debug button integration (Grid TEST button in header)
- ✅ Test Results: **12/13 passed, 1 warning, 100% Topological Integrity**

**How to Run**:
1. Open DXF Viewer: http://localhost:3001/dxf/viewer
2. Click "📐 Grid TEST" button in header
3. Check console for detailed report + notification summary

**Test Categories**:
- MORPHOLOGIC: Grid structure integrity
- SYNTACTIC: Grid rendering correctness
- SEMANTIC: Grid functionality validation
- PRECISION: Coordinate accuracy (CAD millimeter-level)
- TOPOLOGY: Grid-Canvas-Context integration

**Location**: `src/subapps/dxf-viewer/debug/grid-enterprise-test.ts`

#### 2️⃣ Visual Regression Tests (Playwright)
**What's Done**:
- ✅ `e2e/grid-visual-regression.spec.ts` created (9 tests)
- ✅ `playwright.config.ts` configured (deterministic rendering)
- ✅ `e2e/README.md` documentation (full workflow guide)
- ✅ npm scripts added (test:visual, test:visual:update, etc.)
- ✅ Based on OCCT, FreeCAD, BRL-CAD visual testing practices

**Why Paused**: Γιώργος decided to postpone full test execution

**How to Run (when ready)**:
```bash
# Generate baseline snapshots (first time)
npm run test:visual:update

# Run visual regression tests
npm run test:visual

# Run with browser visible (debugging)
npm run test:visual:headed

# View HTML report
npm run test:visual:report
```

**Test Coverage**:
- 3 resolutions: 1280x800, 1920x1080, 3840x2160 (4K)
- 3 grid styles: Lines, Dots, Crosses
- 3 zoom levels: 0.5x, 1.0x, 2.0x
- Coordinate precision test (millimeter-level)

**Quality Standards**:
- maxDiffPixelRatio: 0.0001 (0.01% tolerance - CAD standard)
- Deterministic rendering (fixed DPR, no animations, seed: 42)
- Cross-browser (Chromium, Firefox, WebKit)

**Location**: `e2e/grid-visual-regression.spec.ts`
**Documentation**: `e2e/README.md`

**Note**: Tests can be run anytime - no dependencies on other work!

---

### 🎯 Transform Constants Consolidation (2025-10-04)

**Status**: ✅ **COMPLETED** - Phase 1.3 from MASTER_CONSOLIDATION_ROADMAP.md

**What Was Done**:
- ✅ Created `config/transform-config.ts` (400 lines - Single source of truth)
- ✅ Resolved CRITICAL inconsistency: MIN_SCALE (0.01 vs 0.1 - 10x conflict!)
- ✅ Unified all transform/zoom/pan constants
- ✅ Industry-standard zoom factors (AutoCAD/Blender/Figma: 1.1)
- ✅ Complete backward compatibility (re-exports)

**Files Migrated**:
- ✅ `hooks/state/useCanvasTransformState.ts` → Using validateTransform/transformsEqual from config
- ✅ `systems/zoom/zoom-constants.ts` → Re-exports from transform-config
- ✅ `systems/zoom/ZoomManager.ts` → Auto-updated via re-exports
- ✅ `ui/toolbar/ZoomControls.tsx` → Using ZOOM_FACTORS.BUTTON_IN (20%)

**Documentation Updated**:
- ✅ `centralized_systems.md` - Added Rule #9: Transform Constants
- ✅ `src/md_files/diplotypa/Constants.md` - Section 1 completed
- ✅ `src/md_files/diplotypa/MASTER_CONSOLIDATION_ROADMAP.md` - Phase 1.3 (25% complete)

**Testing Requirements** (Γιώργος to verify):
1. TypeScript compilation: `npx tsc --noEmit --project src/subapps/dxf-viewer/tsconfig.json`
2. Runtime zoom functionality: Mouse wheel, Ctrl+Wheel, Keyboard, Toolbar buttons
3. Zoom limits: Min 1%, Max 100,000%
4. **Zoom-to-cursor fix**: Point under cursor should stay fixed during zoom

**Hotfix Applied (2025-10-04)**:
- 🐛 **Bug #1**: Zoom-to-cursor was shifting - point under cursor moved up/down during zoom
- 🔧 **Fix #1**: Removed hardcoded margins (left: 80, top: 30) from `calculations.ts`
- ✅ **Solution #1**: Now uses centralized `COORDINATE_LAYOUT.MARGINS`
- 📍 **File**: `systems/zoom/utils/calculations.ts` (line 45)

**Enterprise Architecture Fix (2025-10-04)**:
- 🐛 **Bug #2**: ZoomManager used hardcoded viewport `{ width: 800, height: 600 }` instead of actual canvas size
- 🏢 **Enterprise Pattern**: Viewport Dependency Injection
- ✅ **Implementation**:
  - `ZoomManager` constructor now accepts `viewport` parameter (Dependency Injection)
  - `ZoomManager.setViewport()` method για canvas resize updates
  - `useZoom` hook now accepts `viewport` prop and injects it
  - `CanvasSection` passes viewport to `useZoom`
  - Eliminated all hardcoded viewport fallbacks
- 📍 **Files Changed**:
  - `systems/zoom/ZoomManager.ts` - Added viewport DI
  - `systems/zoom/hooks/useZoom.ts` - Added viewport prop
  - `components/dxf-layout/CanvasSection.tsx` - Injects viewport
- 🎯 **Result**: Zoom-to-cursor now uses **actual canvas dimensions** for accurate coordinate transforms

**Location**: `src/subapps/dxf-viewer/config/transform-config.ts`
**Documentation**: `src/subapps/dxf-viewer/centralized_systems.md` (Rule #9)