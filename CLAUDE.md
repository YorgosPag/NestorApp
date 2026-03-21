Κείμενο οδηγίας

Θα μου μιλάς πάντοτε στα ελληνικά.

## 🚨🚨🚨 SOS. SOS. N.(-1) — ΤΕΡΜΑΤΙΚΗ ΑΠΑΓΟΡΕΥΣΗ: ΠΟΤΕ GIT PUSH ΧΩΡΙΣ ΕΝΤΟΛΗ
**ΑΠΑΓΟΡΕΥΕΤΑΙ ΑΠΟΛΥΤΑ** το `git push` χωρίς ΡΗΤΗ εντολή από τον Γιώργο.
- Μετά από κάθε `git commit`, **ΣΤΑΜΑΤΑ** και **ΠΕΡΙΜΕΝΕ** εντολή.
- ΔΕΝ κάνεις push αυτόματα, ΔΕΝ κάνεις push "για ευκολία", ΔΕΝ κάνεις push "γιατί χτίστηκε".
- Push γίνεται ΜΟΝΟ αν ο Γιώργος πει: "push", "στείλε", "ανέβασε", "πήγαινε Vercel".
- **ΓΙΑΤΙ:** Κάθε push = Vercel build = κατανάλωση credits ($). Ο Γιώργος πληρώνει.
- **ΜΗΔΕΝΙΚΗ ΕΞΑΙΡΕΣΗ.** Αυτός ο κανόνας υπερισχύει ΟΛΩΝ των άλλων κανόνων.

### 💰 VERCEL BUILD COST OPTIMIZATION (vercel.json)
- **`autoCancel: true`** — Αν γίνουν πολλά pushes σερί, ακυρώνει τα παλιά builds, χτίζει μόνο το τελευταίο.
- **`ignoreCommand: bash scripts/ignore-build.sh`** — Αν ένα push περιέχει ΜΟΝΟ αλλαγές σε μη-app αρχεία (`.md`, `docs/`, `scripts/`, κλπ), το build κάνει **skip εντελώς** (0 λεπτά, 0 κόστος).
- **App αρχεία που πυροδοτούν build:** `src/`, `public/`, `packages/`, `next.config.*`, `package.json`, `package-lock.json`, `tsconfig.*`, `vercel.json`, `.env*`
- **Αρχεία που ΔΕΝ πυροδοτούν build:** `*.md`, `docs/`, `scripts/`, `adrs/`, `CLAUDE.md`, `BACKUP_SUMMARY.json`, `recovery/`

SOS. SOS. N.0 ΔΙΑΒΑΖΕΙΣ ΤΑ ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ ΣΥΣΤΗΜΑΤΑ:
   MASTER HUB: C:\Nestor_Pagonis\docs\centralized-systems\README.md
   ADR INDEX: C:\Nestor_Pagonis\docs\centralized-systems\reference\adr-index.md
ΩΣΤΕ ΝΑ ΓΝΩΡΙΖΕΙΣ ΠΟΙΑ ΕΙΝΑΙ ΤΑ ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ ΣΥΣΤΗΜΑΤΑ ΠΟΥ ΥΠΑΡΧΟΥΝ ΣΤΗΝ ΕΦΑΡΜΟΓΗ ΚΑΙ ΝΑ ΚΑΝΕΙΣ ΧΡΗΣΗ ΑΥΤΩΝ ΤΩΝ ΣΥΣΤΗΜΑΤΩΝ

## 🚨 SOS. SOS. N.0.1 — ΑΔΙΑΠΡΑΓΜΑΤΕΥΤΟΣ ΚΑΝΟΝΑΣ: ADR-DRIVEN WORKFLOW (4 ΦΑΣΕΙΣ)

**ΚΑΘΕ ΕΡΓΑΣΙΑ ακολουθεί ΥΠΟΧΡΕΩΤΙΚΑ αυτή τη ροή. ΜΗΔΕΝΙΚΗ ΕΞΑΙΡΕΣΗ.**

**ΚΡΙΣΙΜΟ: Ο ΚΩΔΙΚΑΣ = SOURCE OF TRUTH, τα ADRs = ΤΕΚΜΗΡΙΩΣΗ. Αν διαφωνούν, ο κώδικας κερδίζει.**

### ΦΑΣΗ 1: ΑΝΑΓΝΩΡΙΣΗ (Plan Mode)
> Πριν γράψεις ΜΙΑ γραμμή κώδικα:
1. Βρες τα σχετικά ADRs από `docs/centralized-systems/reference/adr-index.md`
2. Διάβασε τον **ΤΡΕΧΟΝΤΑ ΚΩΔΙΚΑ** (Grep/Glob/Read) — αυτός τρέχει στο production
3. Σύγκρινε ADR vs Κώδικα — ταιριάζουν;
4. **Αν ΔΕΝ ταιριάζουν** → ΕΝΗΜΕΡΩΣΕ ΤΟ ADR να αντικατοπτρίζει τον τρέχοντα κώδικα
5. Δημιούργησε plan για την εργασία βασισμένο στο ενημερωμένο ADR + εντολή Γιώργου

### ΦΑΣΗ 2: ΥΛΟΠΟΙΗΣΗ
> Γράψε κώδικα βάσει του plan από τη Φάση 1

### ΦΑΣΗ 3: ΕΝΗΜΕΡΩΣΗ ADR
> Μετά την υλοποίηση:
1. Ενημέρωσε το/τα σχετικά ADR(s) με τις αλλαγές που έγιναν
2. Πρόσθεσε entry στο changelog section του ADR
3. Ενημέρωσε τυχόν diagrams, interfaces, ή examples

### ΦΑΣΗ 4: COMMIT + DEPLOY
> Κώδικας ΚΑΙ ADR(s) στο ίδιο commit

**ΓΙΑΤΙ ΑΥΤΟΣ Ο ΚΑΝΟΝΑΣ:**
- Πολλά ADRs είναι OUT-OF-DATE — ο κώδικας έχει αλλάξει χωρίς ενημέρωση
- Αν ακολουθήσεις τυφλά ένα ξεπερασμένο ADR → θα σπάσεις το production
- Πρώτα ελέγχεις τον κώδικα, μετά ενημερώνεις, μετά υλοποιείς, μετά ξαναενημερώνεις
SOS. SOS. Ν.1 ΚΑΘΕ ΛΥΣΗ ΠΟΥ ΘΑ ΔΙΝΕΙΣ ΟΤΑΝ ΓΡΑΦΕΙΣ ΚΩΔΙΚΑ ΠΡΕΠΕΙ ΥΠΟΧΡΕΩΤΙΚΑ ΝΑ ΕΙΝΑΙ ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΚΑΙ ΟΧΙ ΜΠΑΚΑΛΙΚΟ ΓΕΙΤΟΜΙΑΣ
SOS. SOS. N.7 ΑΔΙΑΠΡΑΓΜΑΤΕΥΤΟ — GOOGLE-LEVEL QUALITY:
- ΚΑΘΕ νέα κωδικοποίηση, ΚΑΘΕ διόρθωση κώδικα, ΠΡΕΠΕΙ να είναι **επιπέδου Google**
- Optimistic updates, proper state management, zero race conditions
- Αν η πρώτη λύση δεν είναι Google-level → μην την κάνεις commit, ξαναγράψε τη σωστά
- Παραδείγματα: Google Docs auto-save, Gmail instant actions, Google Contacts patterns
SOS. SOS. Ν.2 ΑΠΑΓΟΡΕΥΕΤΑΙ Η ΧΡΗΣΗ any
SOS. SOS. Ν.3 ΑΠΑΓΟΡΕΥΕΤΑΙ Η ΧΡΗΣΗ ΤΩΝ INLINE STYLES
SOS. SOS. N.4 ΑΠΑΓΟΡΕΥΕΤΑΙ:
- υπερβολική ή άναρχη χρήση <div>
- nested <div> χωρίς semantic δομή
- components που αποτελούνται μόνο από διαδοχικά <div> χωρίς λόγο
- τμήματα UI που θα έπρεπε να χρησιμοποιούν semantic elements (section, nav, main, header, footer)

SOS. SOS. N.5 ΕΛΕΓΧΟΣ ΑΔΕΙΩΝ ΧΡΗΣΗΣ (LICENSE) - ΤΕΡΜΑΤΙΚΗ ΑΠΑΓΟΡΕΥΣΗ:
- ΠΡΙΝ εγκαταστήσω ΟΠΟΙΟΔΗΠΟΤΕ νέο npm πακέτο, ΥΠΟΧΡΕΩΤΙΚΑ ελέγχω την άδεια χρήσης του
- ΕΠΙΤΡΕΠΟΝΤΑΙ ΜΟΝΟ permissive licenses: **MIT**, **Apache 2.0**, **BSD**
- ΑΠΑΓΟΡΕΥΟΝΤΑΙ ΑΠΟΛΥΤΑ: **GPL**, **LGPL**, **AGPL** (υποχρεώνουν ανοιχτό κώδικα)
- Ο Γιώργος θέλει η εφαρμογή να παραμείνει **κλειστού κώδικα (proprietary)** για εμπορική εκμετάλλευση
- Αν η άδεια ενός πακέτου δεν είναι ξεκάθαρη, ΡΩΤΑΩ τον Γιώργο πριν προχωρήσω
- Ref: ADR-034 Appendix C (License Compliance)

SOS. SOS. N.6 ΥΠΟΧΡΕΩΤΙΚΗ ΧΡΗΣΗ ENTERPRISE IDs — ΤΕΡΜΑΤΙΚΗ ΑΠΑΓΟΡΕΥΣΗ:
- ΚΑΘΕ Firestore document ΠΡΕΠΕΙ να δημιουργείται με setDoc() + ID από enterprise-id.service.ts
- ΑΠΑΓΟΡΕΥΕΤΑΙ: addDoc(), Date.now() IDs, filename-based IDs, inline crypto.randomUUID()
- ΜΟΝΑΔΙΚΗ ΠΗΓΗ IDs: @/services/enterprise-id.service (60+ generators)
- Αν δεν υπάρχει generator για τη συλλογή → ΔΗΜΙΟΥΡΓΗΣΕ ΠΡΩΤΑ prefix + generator
- Ref: ADR-017 (Enterprise ID Generation), ADR-210 (Document ID Audit)

# ΕΙΛΙΚΡΙΝΕΙΑ & ΔΙΑΦΑΝΕΙΑ

**100% ειλικρίνεια.** Αν δεν ξέρεις, πες "δεν ξέρω". Μην παραπλανείς τον Γιώργο ποτέ.

---

# 🏢 ENTERPRISE CODE STANDARDS (ΥΨΙΣΤΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)

## 🚨 ΤΕΡΜΑΤΙΚΕΣ ΑΠΑΓΟΡΕΥΣΕΙΣ - ΜΗΔΕΝΙΚΗ ΑΝΟΧΗ

### ❌ ΑΠΑΓΟΡΕΥΕΤΑΙ ΑΠΟΛΥΤΑ:

1. **ΓΡΑΨΙΜΟ ΚΩΔΙΚΑ χωρίς προηγούμενη αναζήτηση**
   - Πρώτα: Grep/Glob searches για existing κώδικα
   - Αν βρεθεί existing → επέκτεινε αυτό, μη δημιουργήσεις νέο

2. **ΔΙΠΛΟΤΥΠΑ σε οποιαδήποτε μορφή**
   - Επέκτεινε existing centralized systems
   - Έλεγξε `docs/centralized-systems/README.md`
   - Μην δημιουργείς νέο αν υπάρχει existing

4. **`as any`** - Η χρήση του `as any` είναι **ΑΠΑΓΟΡΕΥΜΕΝΗ**
   - Αυτό είναι **μπακάλικο γειτονιάς**, όχι enterprise λύση
   - Χρησιμοποίησε: Function overloads, discriminated unions, proper types

5. **`@ts-ignore`** - Η χρήση του `@ts-ignore` είναι **ΑΠΑΓΟΡΕΥΜΕΝΗ**
   - Αυτό κρύβει προβλήματα αντί να τα λύνει
   - Χρησιμοποίησε: Proper TypeScript types, module resolution

6. **`any` type** - Η χρήση του `any` είναι **ΑΠΑΓΟΡΕΥΜΕΝΗ**
   - Χρησιμοποίησε: Generics (`<T>`), union types, proper interfaces

7. **ADR-001: Select/Dropdown Components** - **ΤΕΡΜΑΤΙΚΗ ΑΠΑΓΟΡΕΥΣΗ**
   - ✅ **CANONICAL**: `@/components/ui/select` (Radix Select) - ΜΟΝΑΔΙΚΟ dropdown component
   - ❌ **ΑΠΑΓΟΡΕΥΕΤΑΙ**: Νέα χρήση του `EnterpriseComboBox` ή οποιουδήποτε άλλου Select
   - ⚠️ **LEGACY FILES**: Τα 7 αρχεία στο DXF Viewer που χρησιμοποιούν EnterpriseComboBox
   - 🔄 **MIGRATE ON TOUCH**: Όταν αγγίζεται legacy file → ΥΠΟΧΡΕΩΤΙΚΗ αντικατάσταση με Radix Select
   - 📍 **Documentation**: `docs/centralized-systems/reference/adr-index.md#adr-001-selectdropdown-component`

8. **ADR Numbering: ΧΡΗΣΗ ΔΙΑΘΕΣΙΜΩΝ IDs ΠΡΩΤΑ** - **ΚΑΝΟΝΑΣ 2026-02-01**
   - ✅ **ΔΙΑΘΕΣΙΜΑ IDs** (χρησιμοποίησε αυτά ΠΡΩΤΑ πριν το 215+):
     `145` (μόνο αυτό — 156 και 164 χρησιμοποιήθηκαν)
   - 📝 **ΓΙΑΤΙ ΚΕΝΑ**: Αυτά τα IDs ενοποιήθηκαν στο ADR-GEOMETRY (consolidation document)
   - 📍 **ADR-GEOMETRY**: Περιέχει 26 geometry-related αποφάσεις → `adrs/ADR-GEOMETRY.md`
   - 📁 **ARCHIVED**: Τα παλιά αρχεία στο `adrs/archived/` για historical reference
   - ⚠️ **ΣΗΜΑΝΤΙΚΟ**: Όταν τελειώσουν τα διαθέσιμα IDs, συνέχισε από ADR-167

### ✅ AUTONOMOUS FLOW — ΠΡΟΧΩΡΑ ΧΩΡΙΣ ΝΑ ΡΩΤΑΣ

**Ο agent δουλεύει ΑΥΤΟΝΟΜΑ. Δεν χρειάζεται να ρωτήσει τον Γιώργο πριν:**
- Δημιουργήσει νέα αρχεία (αρκεί να έχει ψάξει πρώτα για existing)
- Κάνει Edit/Write σε αρχεία
- Τρέξει compilation checks
- Δημιουργήσει tests
- Κάνει git commit + push (αν η εργασία ολοκληρώθηκε σωστά)

**Πριν από κάθε Edit/Write:**
1. **SEARCH** → Grep/Glob searches για existing κώδικα
2. **PROCEED** → Αν δεν υπάρχει duplicate, προχώρα άμεσα

**Ρώτα ΜΟΝΟ αν:**
- Υπάρχει αμφιβολία για τη σωστή αρχιτεκτονική προσέγγιση
- Η αλλαγή μπορεί να σπάσει production functionality
- Χρειάζεται εγκατάσταση νέου npm πακέτου με ασαφή άδεια

### 🧠 MEMORY REQUIREMENTS:

**Claude πρέπει to memorize:**
- ✅ **Όλους τους κανόνες** του CLAUDE.md και να τους εφαρμόζει αυστηρά
- ✅ **Πού έχουμε μείνει** στις εργασίες GEO-ALERT (current phase, επόμενα βήματα)
- ✅ **Τι έχει ολοκληρωθεί** και τι είναι pending στο project
- ✅ **Προηγούμενα λάθη** (π.χ. npm install problems) για να μην τα επαναλάβει

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

**Ο Γιώργος σε εμπιστεύεται. Δούλεψε αυτόνομα, κράτα ποιότητα, μη φοβάσαι τα λάθη — διόρθωσέ τα και προχώρα.**

---

## 📋 ΚΑΝΟΝΕΣ ΕΡΓΑΣΙΑΣ

### Πριν γράψεις κώδικα:

1. **ΑΝΑΖΗΤΗΣΗ ΠΡΩΤΑ**: Grep/Glob searches για existing κώδικα. Αν υπάρχει, επέκτεινέ το.
2. **ΕΛΕΓΞΕ CENTRALIZED SYSTEMS**: `docs/centralized-systems/README.md` — μην δημιουργείς duplicate.
3. **COMPILATION CHECK**: Ακολούθησε τον κανόνα `⚡ TYPESCRIPT CHECK WORKFLOW` παρακάτω.
4. **ΕΝΕΡΓΟΠΟΙΗΣΗ > ΔΗΜΙΟΥΡΓΙΑ**: Πρώτα ψάξε αν υπάρχει κάτι απενεργοποιημένο.
5. **ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ**: Χρησιμοποίησε centralized κώδικα. Αν βρεις duplicates, κεντρικοποίησέ τα.
6. **ΤΕΚΜΗΡΙΩΣΗ**: Ενημέρωσε `docs/centralized-systems/` όταν κεντρικοποιείς κώδικα.

### Ελεύθερη δράση — ΜΗΝ ρωτάς:
- Δημιουργία/τροποποίηση αρχείων (αφού έχεις ψάξει για duplicates)
- Compilation checks, tests
- Git commit + push αν η εργασία ολοκληρώθηκε σωστά
- Κεντρικοποίηση scattered κώδικα

---

## 🧠 QUALITY CHECKLIST (εσωτερικός — ΜΗΝ σταματάς τη ροή)

Πριν γράψεις κώδικα, βεβαιώσου:
- [x] Έψαξες για existing κώδικα (Grep/Glob)
- [x] Δεν δημιουργείς duplicates
- [x] Χρησιμοποιείς enterprise TypeScript (όχι `any`, `as any`, `@ts-ignore`)
- [x] Semantic HTML (όχι `div` soup)

**Αν αποτύχει κάτι → διόρθωσέ το μόνος σου, μην ρωτάς.**

---
## ⚡ TYPESCRIPT CHECK WORKFLOW

### ΚΑΝΟΝΑΣ: ΜΗΝ περιμένεις το tsc — δούλεψε παράλληλα!

Το `npx tsc --noEmit` σε αυτό το project παίρνει **60-90 δευτερόλεπτα**. Για να μην καθυστερεί η ροή:

#### 🟢 Μικρές αλλαγές (1-3 αρχεία, χωρίς αλλαγή types/interfaces):
- **SKIP** εντελώς το tsc
- Commit + push αμέσως
- Το Vercel build θα πιάσει τυχόν errors

#### 🟡 Μεσαίες αλλαγές (4-10 αρχεία ή αλλαγή σε types):
- Τρέξε `npx tsc --noEmit` στο **background** (`run_in_background: true`)
- Commit + push **χωρίς να περιμένεις** το αποτέλεσμα
- Αν βρεθεί error → fix στο επόμενο commit

#### 🔴 Μεγάλα refactorings (10+ αρχεία, αλλαγή exports/interfaces):
- Τρέξε `npx tsc --noEmit` στο **background**
- Commit + push **χωρίς να περιμένεις**
- Αν βρεθεί error → fix + νέο commit + push αμέσως

#### ⚠️ ΠΟΤΕ δεν κάνεις blocking wait στο tsc. Ο χρήστης δεν πρέπει να περιμένει.

---
## 🔄 GIT WORKFLOW & BACKUP PROTOCOL

### 📦 Διαδικασία Μετά από Επιτυχημένη Προσπάθεια

**ΚΡΙΣΙΜΟΣ ΚΑΝΟΝΑΣ**: Μετά από κάθε **επιτυχημένη προσπάθεια**, ακολουθώ **ΥΠΟΧΡΕΩΤΙΚΑ** τα παρακάτω βήματα με τη σειρά:

#### ✅ ΒΗΜΑ 1: GIT COMMIT (αυτόνομα αν η εργασία πέτυχε)
```bash
# Δημιουργώ git commit με όλες τις αλλαγές
git add [files]
git commit -m "..."
```

#### ✅ ΒΗΜΑ 2: VERCEL DEPLOYMENT (ΥΠΟΧΡΕΩΤΙΚΟ)
```bash
# Στέλνω στο remote repository για Vercel auto-deployment
git push origin main
```

**ΚΡΙΣΙΜΟ**: Κάθε commit **ΠΡΕΠΕΙ** να γίνει push στο Vercel για production deployment!

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
- ❌ ΔΕΝ κάνω backup αν η προσπάθεια **ΑΠΟΤΥΧΕ**
- ❌ ΔΕΝ ξεχνώ να κάνω push στο Vercel για production deployment

### 📝 ΠΑΡΑΔΕΙΓΜΑ ΡΟΗΣ:

1. **Επιτυχία!** → Git commit + push
2. **Vercel deployment** → BACKUP_SUMMARY.json
3. **Τρέξιμο auto-backup.ps1** → ZIP created → Συνέχεια!

---

## 🚀 VERCEL DEPLOYMENT PROTOCOL

### 📋 ΥΠΟΧΡΕΩΤΙΚΟΣ ΚΑΝΟΝΑΣ:
**Κάθε commit ΠΡΕΠΕΙ να γίνει push στο Vercel για production deployment!**

### 🔄 AUTO-DEPLOYMENT FLOW:
1. **git push origin main** → Στέλνει στο GitHub
2. **GitHub Actions** → Τρέχει validation (i18n, tests, etc.)
3. **Vercel Auto-Deploy** → Κάνει build και deploy το production site
4. **Production Live** → Οι αλλαγές είναι άμεσα διαθέσιμες στους χρήστες

### ⚠️ POTENTIAL ISSUES & SOLUTIONS:

#### 🔧 GitHub Actions Failures:
- **Missing scripts**: Δημιουργώ τα απαραίτητα scripts (π.χ. validate-translations.js)
- **Test failures**: Διορθώνω τα tests πριν το push
- **Type errors**: Τρέχω typecheck και διορθώνω errors

#### 🐛 Build Failures:
- **Dependency issues**: Ελέγχω package.json και dependencies
- **Environment variables**: Επαληθεύω ότι τα .env variables είναι σωστά
- **Import errors**: Διορθώνω broken imports και paths

### 📊 VERCEL MONITORING:
- **Production URL**: https://nestor-app.vercel.app
- **Dashboard**: Vercel Dashboard για deployment logs
- **Build Times**: Συνήθως 2-3 λεπτά για πλήρη deployment

### 🚨 EMERGENCY ROLLBACK:
Αν κάτι σπάσει στο production, μπορώ να κάνω:
```bash
# Revert το τελευταίο commit
git revert HEAD
git push origin main
# Το Vercel θα κάνει auto-deploy το προηγούμενο working state
```

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
- ✅ `docs/centralized-systems/reference/adr-index.md` - Added ADR-043: Zoom Constants
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
**Documentation**: `docs/centralized-systems/reference/adr-index.md` (ADR-043)

---

## 🔒 **SECURITY AUDIT FINDINGS & PRODUCTION READINESS (2025-12-15)**

### 🚨 **ΚΡΙΣΙΜΗ ΕΝΗΜΕΡΩΣΗ - SECURITY BLOCKERS IDENTIFIED**

**AUDIT RESULT**: ❌ **ΌΧΙ ΕΤΟΙΜΟ ΓΙΑ PRODUCTION**

Ολοκληρώθηκε **πλήρης security audit** και εντοπίστηκαν **3 κρίσιμα blockers** που εμποδίζουν production deployment.

### **📋 ΤΕΚΜΗΡΙΩΣΗ AUDIT:**
- **Full Report**: `SECURITY_AUDIT_REPORT.md` (Main project root)
- **Audit Date**: 2025-12-15
- **Scope**: Full application security assessment

### **🚨 TOP 3 ΚΡΙΣΙΜΑ BLOCKERS:**

#### **1. 🔓 PUBLIC DATA ACCESS (Critical)**
- **Issue**: Projects, contacts, buildings διαβάζονται δημόσια από κάθε authenticated user
- **Risk**: Total data breach εταιρικών δεδομένων
- **Fix Required**: Role-based access control implementation

#### **2. ❌ ΕΛΛΙΠΗΣ VALIDATION (High)**
- **Issue**: Firestore rules έχουν basic validation, όχι business logic
- **Risk**: Data corruption, invalid states
- **Fix Required**: Server-side validation middleware

#### **3. 🔄 ΑΠΟΥΣΙΑ RATE LIMITING (High)**
- **Issue**: Unlimited operations από authenticated users
- **Risk**: Resource exhaustion, DoS attacks
- **Fix Required**: Rate limiting implementation

### **📅 IMMEDIATE ACTION PLAN:**

#### **PHASE 1: CRITICAL FIXES (1-2 weeks)**
1. **Firestore Rules Update** - Remove public read access, implement role-based filtering
2. **Rate Limiting** - Implement Firebase App Check και client-side throttling

#### **PHASE 2: SECURITY HARDENING (2-3 weeks)**
1. **Server-side Validation** - Create validation middleware, business logic checks
2. **Access Control** - Design role system, implement permission matrix

#### **PHASE 3: MONITORING & TESTING (1 week)**
1. **Security Testing** - Penetration testing, load testing
2. **Production Monitoring** - Error tracking, security alerts

### **🎯 PRODUCTION READINESS CRITERIA:**
- [ ] No public data access without proper authorization
- [ ] All business logic validated server-side
- [ ] Rate limiting implemented and tested
- [ ] Security audit passed with no critical findings

### **⚠️ DEVELOPMENT vs PRODUCTION STATUS:**
- **✅ ACCEPTABLE για DEVELOPMENT**: Current setup OK για <50 users, Firebase free tier
- **❌ NOT ACCEPTABLE για PRODUCTION**: Security model needs complete redesign

### **🔒 SECURITY AWARENESS:**

Η εφαρμογή είναι σε **DEVELOPMENT MODE**. Κράτα υπόψη:
- Input sanitization σε user inputs
- Authorization checks σε data operations
- Μη βάζεις credentials/secrets σε κώδικα

---

## 📦 **ENTERPRISE BACKUP SYSTEM**

### 🚀 **AUTOMATIC RELIABLE BACKUP - ΕΝΤΟΛΗ ΓΙΑ ΟΠΟΙΟΝΔΗΠΟΤΕ CLAUDE AGENT:**

**Όταν ο Γιώργος ή οποιοσδήποτε πράκτορας ζητήσει "κάνε backup zip", χρησιμοποίησε ΠΑΝΤΑ την παρακάτω εντολή:**

```bash
powershell.exe -ExecutionPolicy Bypass -File "C:\Nestor_Pagonis\enterprise-backup.ps1"
```

### ✅ **ΤΙ ΚΑΝΕΙ ΤΟ ENTERPRISE-BACKUP.PS1:**

1. **📋 Διαβάζει BACKUP_SUMMARY.json** - Παίρνει category και description
2. **📁 Αντιγράφει ΟΛΟΚΛΗΡΟ το project** - Όλο το δέντρο εκτός από node_modules
3. **🗜️ Δημιουργεί ZIP** - Με αυτόματο timestamp και smart naming
4. **📍 Αποθηκεύει στο:** `C:\Users\user\Downloads\BuckUps\Zip_BuckUps-2\`
5. **✅ Επαληθεύει** - Έλεγχος ότι περιλαμβάνει src/, packages/, public/
6. **📄 Ενσωματώνει BACKUP_SUMMARY.json** - Μέσα στο ZIP

### 📁 **ΤΙ ΠΕΡΙΛΑΜΒΑΝΕΙ (FULL PROJECT TREE):**

✅ **src/** - Όλος ο source code
✅ **packages/** - Core packages
✅ **public/** - Static assets
✅ **scripts/** - Build scripts
✅ **Configuration files** - .env, package.json, configs
✅ **Documentation** - *.md files
✅ **BACKUP_SUMMARY.json** - Metadata

### 🚫 **ΤΙ ΕΞΑΙΡΕΙ:**

❌ **node_modules/** (όπως ζήτησε ο Γιώργος)
❌ **.next/**, **.git/**, **dist/**, **build/**
❌ ***.log files** και temp files

### 🎯 **ΑΠΟΤΕΛΕΣΜΑ:**

- **Reliable 11-15MB ZIP** με όλο το project
- **Smart filename**: `YYYYMMDD_HHMM - [CATEGORY] - Complete Project Backup.zip`
- **Ready για οποιονδήποτε Claude agent!**

**ΜΗΝ χρησιμοποιείς ποτέ το παλιό auto-backup.ps1 - χρησιμοποίησε ΜΟΝΟ το enterprise-backup.ps1!**

