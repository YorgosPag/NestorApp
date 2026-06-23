# HANDOFF — Απόκρυψη/εξάλειψη του ασύνδετου default level «Επίπεδο 1» (floorId=null) όταν υπάρχει δομή κτιρίου

**Ημερομηνία:** 2026-06-23
**Προτεραιότητα:** 🔴 ΣΟΒΑΡΟ (data-loss root cause — κολόνες/BIM που σχεδιάζονται στο ασύνδετο default level γράφονται χωρίς `floorId` και εξαφανίζονται σε floorId-scoped reload)
**Working tree:** ⚠️ ΜΟΙΡΑΖΕΤΑΙ με άλλον agent — **ΜΗΝ κάνεις commit/push** (ο Giorgio κάνει commit). Stage μόνο τα δικά σου. **ΕΝΑ tsc τη φορά (N.17).**
**Μοντέλο:** Opus (cross-cutting: levels/floors linking + level panel + persistence).
**Ζητούμενο Giorgio (αυτολεξεί):** «FULL ENTERPRISE + FULL SSOT, όπως Revit. ΠΡΙΝ τον κώδικα κάνε ΠΡΑΓΜΑΤΙΚΟ SSoT audit (grep) — reuse, μηδέν διπλότυπα.»

---

## 1. ΤΟ ΣΥΜΠΤΩΜΑ (αρχικό bug, ΛΥΜΕΝΟ διαγνωστικά)

Τοποθετείς κολόνα σε όροφο (adopt-rect ή κανονική) → δημιουργείται + auto-πέδιλο στη θεμελίωση. Πας 3D/ισόγειο (βλέπεις κολόνα), πας θεμελίωση (βλέπεις πέδιλο), **γυρνάς ισόγειο → η κολόνα ΕΞΑΦΑΝΙΣΤΗΚΕ** (2D + 3D). Απώλεια δεδομένων.

## 2. Η ΡΙΖΑ — ΑΠΟΔΕΔΕΙΓΜΕΝΗ ΜΕ ΜΕΤΡΗΣΗ (Firestore + diagnostic logs)

Η προηγούμενη συνεδρία ιχνηλάτησε όλο το persistence path + έβαλε diagnostic logs + έκανε queries απευθείας στο Firestore. **Οριστικό εύρημα:**

- Η εξαφανισμένη κολόνα είχε στο Firestore doc: `floorplanId` ✅ αλλά **`floorId` ΑΠΟΥΣΙΑΖΕ τελείως** ❌.
- Αιτία: σχεδιάστηκε ενώ ενεργό ήταν ένα level με **`floorId: null`** → το first-save την έγραψε με `floorplanId`-only scope (ADR-420: `bimScopeWriteFields` γράφει `floorId` μόνο αν υπάρχει).
- Όταν γυρνάς, φορτώνει το **σωστά συνδεδεμένο** level του ιδίου ορόφου (floorId set) → η subscription (ADR-420) ρωτά `where('floorId','==', flr_xxx)` → η κολόνα (χωρίς floorId) **δεν ταιριάζει** → drop στο `mergeColumnDocsIntoScene` (`column-persistence-helpers.ts`, ADR-390 branch «drop scene columns whose doc disappeared») → **χαμένη μόνιμα**.

**ΔΕΝ είναι adopt-specific, ΔΕΝ είναι foundation-bug.** Το foundation flow απλώς σε κάνει να αλλάξεις όροφο, που ξεσκεπάζει το mismatch.

### Η πραγματική δομική ρίζα (Firestore evidence)
Στο project του Giorgio υπήρχαν **ΔΥΟ levels για το ίδιο Ισόγειο**:
- `Επίπεδο 1` (isDefault=true, **floorId: null**, χωρίς buildingId) — το ασύνδετο «πρόχειρο» default
- `Ισόγειο` (floorId=flr_xxx, buildingId set) — το σωστά συνδεδεμένο

Σχεδίαζε στο ασύνδετο, έβλεπε/φόρτωνε από το συνδεδεμένο → εξαφάνιση.

### Επιβεβαίωση ότι αναπαράγεται από καθαρή βάση (2026-06-23, μετά από full wipe)
Ο Giorgio άδειασε DB + storage και ξανάχτισε σωστά: επαφή «ALFA ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε.» → έργο «ΕΡΓΟ Α» → κτίριο «Κτήριο Α» → 3 floors (Θεμελίωση -1.2 / Ισόγειο 0 / SP +3) → import κάτοψης «Ισόγειο 1.dxf» μέσω **Wizard**.

Αποτέλεσμα `dxf_viewer_levels` (4):
| Level | name | isDefault | floorId | buildingId | DXF |
|---|---|---|---|---|---|
| `lvl_0d347bab` | Ισόγειο (ΕΝΕΡΓΟ) | false | flr_926d2b1f ✅ | ✅ | Ισόγειο 1.dxf |
| `lvl_51ba9105` | Θεμελίωση | false | flr_d39d1f9e ✅ | ✅ | — |
| `lvl_ca4330bf` | Απόληξη | false | flr_92ddb962 ✅ | ✅ | — |
| **`lvl_01f065a1`** | **Επίπεδο 1** | **true** | **null** ❌ | — | — |

→ Ο wizard κάνει σωστά τη δουλειά (φτιάχνει συνδεδεμένα floor-levels + ενεργοποιεί το σωστό). **ΑΛΛΑ το ασύνδετο `isDefault` «Επίπεδο 1» (floorId=null) ΠΑΡΑΜΕΝΕΙ ως landmine.** (Βελτίωση vs πριν: τώρα έχει `sceneFileId: null`, δεν μοιράζεται πια το DXF.)

## 3. Η ΑΠΟΦΑΣΗ ΤΟΥ GIORGIO (το ζητούμενο αυτής της συνεδρίας)

> «Όταν φορτώνουμε κάτοψη μέσω Οδηγού (Wizard), αυτό το επίπεδο [το ασύνδετο default «Επίπεδο 1»] **να ΜΗΝ εμφανίζεται**.»

Δηλαδή: όταν υπάρχει δομή κτιρίου με floor-linked levels, το ασύνδετο `isDefault` (floorId=null) **δεν πρέπει να είναι ορατό ούτε επιλέξιμο** ως επιφάνεια σχεδίασης — ώστε να μην μπορεί κανείς να σχεδιάσει πάνω του και να χάσει δεδομένα. Revit-grade: μία επιφάνεια ανά όροφο, με σταθερή ταυτότητα (floorId).

## 4. SSoT AUDIT — ΥΠΑΡΧΟΝΤΑ MODULES (κάνε REGREP πρώτος, ΜΗΝ ξαναφτιάξεις)

**Πού γεννιέται το default level:**
- `systems/levels/hooks/useLevelsFirestoreSync.ts:96-116` — bootstrap-on-empty: `LevelOperations.createDefaultLevels()` φτιάχνει το «Επίπεδο 1» (isDefault=true, floorId=null) ΟΤΑΝ η συλλογή `dxf_viewer_levels` είναι **κενή για την εταιρεία** (company-level, μία φορά).
- `systems/levels/utils.ts` — `LevelOperations.createDefaultLevels()` (το όνομα/σχήμα του default).

**Auto-εκλογή ενεργού level (κίνδυνος να ξεκινά στο floorId-less):**
- `useLevelsFirestoreSync.ts:90-95` — όταν δεν υπάρχει ενεργό: `fetchedLevels.find(l => l.isDefault) || fetchedLevels[0]`. ⚠️ Διάλεξε εδώ **floor-linked** level αντί για το ασύνδετο default όταν υπάρχουν.

**Εμφάνιση/σειρά panel «Στάθμες» (SSoT — εδώ μπαίνει το φίλτρο):**
- `systems/levels/level-display-order.ts` — `orderLevelsForPanel(levels, resolveFloor)`. ΤΩΡΑ καρφώνει το `isDefault` στην κορυφή (`TIER_DEFAULT=6`, γρ.41/49). Το spec σχόλιο (γρ.8-9) λέει «always show Επίπεδο 1» — **αυτό αλλάζει**: όταν υπάρχει ≥1 floor-linked level, το ασύνδετο default φιλτράρεται/κρύβεται.
- `ui/components/LevelPanel.tsx` + `ui/components/level-panel-helpers.ts` + `level-panel-hooks.ts` — ο consumer του ordering στο UI.
- `hooks/data/useFloorTabs.ts` — οι καρτέλες ορόφων (FloorTabBar). Έλεγξε αν το default εμφανίζεται και εκεί.

**Wizard import + floor/level linking (δουλεύει σωστά — REUSE, μην το αλλάξεις):**
- `systems/levels/hooks/useLevelImportWizardOps.ts`
- `systems/levels/ensure-levels-for-building.ts` (+ test) — `ensureLevelsForBuilding` / `findOrCreateLevelForFloor`.
- `systems/levels/level-floor-resolution.ts` — resolver level→floor.
- `app/DxfViewerTopBar.tsx:86-98` — `floorId = currentLevel?.floorId ?? saveContext?.floorId` (το prop που τροφοδοτεί όλα τα persistence hosts).

**Persistence scope SSoT (ADR-420 — η ασυμμετρία write/read):**
- `bim/persistence/bim-floor-scope.ts` — `resolveBimPersistenceScope` / `bimScopeWriteFields` (write: floorId αν υπάρχει) / `buildBimScopeConstraints` (read: keys σε floorId αν υπάρχει). Εδώ είναι η ασυμμετρία που κάνει το orphan unreachable.
- `hooks/data/column-persistence-helpers.ts` — `mergeColumnDocsIntoScene` (το drop branch, ADR-390).

**ADRs:** ADR-420 (floor-scope SSoT), ADR-461 (Στάθμες panel/special levels), ADR-399 (floor tabs), ADR-459/500 (auto-foundation — δούλεψε σωστά).

## 5. ΠΡΟΤΕΙΝΟΜΕΝΗ ΚΑΤΕΥΘΥΝΣΗ (επιβεβαίωσέ την με το audit ΠΡΙΝ τον κώδικα)

Πρωτεύον (UI/συμπεριφορά, Revit-grade — αυτό ζήτησε ο Giorgio):
1. **Απόκρυψη του ασύνδετου default** από panel + floor tabs όταν υπάρχει ≥1 floor-linked level (ή building context). SSoT σημείο: `level-display-order.ts` (φίλτρο) + `useFloorTabs.ts`. Pure + resolver-injected (όπως ήδη είναι).
2. **Μην εκλέγεις το ασύνδετο default ως ενεργό** όταν υπάρχουν floor-linked levels (`useLevelsFirestoreSync.ts:90-95`).

Δευτερεύον (belt-and-suspenders, N.7.2 — προαιρετικό αλλά Revit-grade ασφάλεια έναντι ΟΠΟΙΟΥΔΗΠΟΤΕ floorId-less write):
3. **Άμυνα στο BIM persistence:** να ΜΗΝ γράφεται πρώτο-save κολόνας/BIM με floorId-less scope όταν ο όροφος ανήκει σε κτίριο (defer μέχρι resolve, reuse `pendingFirstSaveIdsRef`). Έτσι ακόμη κι αν ξεφύγει ασύνδετο level, δεν χάνεται data.

⚠️ **Προσοχή στο spec conflict:** το σχόλιο στο `level-display-order.ts:8-16` λέει ρητά «Επίπεδο 1 ALWAYS top». Άλλαξε ΚΑΙ το σχόλιο/spec (PHASE 3 — ADR update) ώστε να μη φανεί regression. Ρώτα τον Giorgio αν το ασύνδετο default πρέπει να κρύβεται **πάντα** όταν υπάρχει κτίριο, ή μόνο όταν ανοίγεις μέσω wizard.

## 6. ΠΑΡΑΛΛΗΛΟ TESTING (ο Giorgio θα το κάνει live, εσύ έλεγχε DB/render)
Μετά τη διόρθωση, ο Giorgio θα δοκιμάσει: κολόνες + θεμελιώσεις → (α) δημιουργούνται σωστά, (β) **λαμβάνουν σωστά υψόμετρα** (column baseZ ανά όροφο, footing topElevation στη θεμελίωση), (γ) **φαίνονται σωστά σε 2Δ + 3Δ**. Έλεγχε Firestore (`floorplan_columns` με `floorId` set, `floorplan_foundations`) σε κάθε βήμα.

## 7. ΚΑΘΑΡΟ BASELINE (καθαρή βάση 2026-06-23 16:1x)
- contacts: 1 (`cont_ea876096` ALFA) · projects: 1 (`proj_533d7d91` ΕΡΓΟ Α) · buildings: 1 (`bldg_17d7b20e` Κτήριο Α)
- floors: 3 (Θεμελίωση `flr_d39d1f9e` / Ισόγειο `flr_926d2b1f` / SP `flr_92ddb962`)
- dxf_viewer_levels: 4 (βλ. §2 πίνακα — 3 σωστά + 1 ασύνδετο default `lvl_01f065a1`)
- floorplan_columns: 0 · floorplan_foundations: 0
- **MCP firestore tools** είναι διαθέσιμα — χρησιμοποίησέ τα για live verification (`firestore_query`/`firestore_get_document`).

## 8. ΚΑΤΑΣΤΑΣΗ ΚΩΔΙΚΑ
- Τα 3 diagnostic logs `[DIAG column-vanish]` που μπήκαν για τη διάγνωση **ΑΦΑΙΡΕΘΗΚΑΝ** (επιβεβαιωμένο με grep). Τα 3 αρχεία (`column-persistence-helpers.ts`, `useColumnPersistence.ts`, `auto-foundation-design-core.ts`) είναι στην αρχική τους κατάσταση. **Καμία εκκρεμής αλλαγή κώδικα από τη διάγνωση.**

## 9. ΜΗΝ ΚΑΝΕΙΣ
- ❌ Commit/push (Giorgio).
- ❌ Νέο level/floor subsystem — υπάρχει (§4), REUSE.
- ❌ Να χαλάσεις τον wizard import (δουλεύει σωστά — φτιάχνει συνδεδεμένα floor-levels).
- ❌ Παράλληλο tsc (N.17).
- ❌ Υλοποίηση χωρίς πρώτα grep SSoT audit (εντολή Giorgio).
