# HANDOFF — ADR-293 `canonicalScenePath is required` ΕΞΑΚΟΛΟΥΘΕΙ σε orphaned/file-less όροφο (ADR-469 FIX(Β) ατελές)

**Ημερομηνία:** 2026-06-17 · **Μοντέλο προηγ. συνεδρίας:** Opus 4.8 · **Γλώσσα απαντήσεων: ΕΛΛΗΝΙΚΑ πάντα.**

---

## 0. ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **ΟΧΙ commit / ΟΧΙ push** — ο Giorgio κάνει commit ΜΟΝΟΣ του. Εσύ μόνο γράφεις/τεστάρεις.
- **Shared working tree** με άλλον agent → όταν stage-άρεις, `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ** `git add -A`/`.`.
- **FULL ENTERPRISE + FULL SSoT, Revit-grade** (ρητή εντολή Giorgio). ΠΡΙΝ γράψεις κώδικα → **πραγματικό SSoT audit (grep)** για reuse· μηδέν διπλότυπα.
- `any`/`as any`/`@ts-ignore` ΑΠΑΓΟΡΕΥΟΝΤΑΙ. Hardcoded strings ΑΠΑΓΟΡΕΥΟΝΤΑΙ (i18n SSoT· εξαίρεση `logger.*`). Functions ≤40 γρ / code files ≤500 γρ.
- **N.17 (single-tsc):** πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει ήδη άλλος. ΕΝΑ tsc τη φορά.
- **Πρότεινε σύντομο plan + ζήτα έγκριση ΠΡΙΝ υλοποιήσεις.**

---

## 1. ΤΟ ΣΦΑΛΜΑ (ακριβές)

```
[ERROR] [DxfFirestore] canonicalScenePath is required for DXF scene saves (ADR-293).
Pass it via DxfSaveContext. {"fileId":"file_80efad96-6a75-40f9-8478-0ebaa5cfbcaf"}

  at saveToStorageImpl (services/dxf-firestore-storage.impl.ts:175)
  at DxfFirestoreService.autoSaveV2 (services/dxf-firestore.service.ts:224)
  at useAutoSaveSceneManager…setLevelSceneWithAutoSave (hooks/scene/useAutoSaveSceneManager.ts)
```

**Repro:** Ισόγειο με **orphaned** `sceneFileId` = `file_80efad96…` (το `files`/`cadFiles` doc έχει διαγραφεί → `getFileStoragePath`→null, `loadFileV2`→null). Βάζεις/επεξεργάζεσαι BIM (π.χ. κολώνα) στον άδειο καμβά → ο debounced DXF auto-save πυροδοτείται → `saveToStorageImpl` πετάει ADR-293 γιατί δεν υπάρχει `canonicalScenePath`.

**Είναι ΤΟ ΙΔΙΟ incident family με το ADR-469** (ίδιο αρχείο `file_80efad96`). Το **FIX(Β)** του ADR-469 (`resetDxfAutoSaveTarget()`) **ΑΠΕΤΥΧΕ να καλύψει αυτό το μονοπάτι** → χρειάζεται proper enterprise fix (πιθανώς **ADR-469 v1.2** ή ξεχωριστό ADR).

> ⚠️ Το ADR-469 (v1.0 + v1.1) είναι **UNCOMMITTED** στο τρέχον working tree. Δούλεψε πάνω στο τρέχον state.

---

## 2. ROOT CAUSE (διαγνωσμένο — επιβεβαίωσέ το, CODE = source of truth)

### 2.A — Το auto-save gate κλειδώνει σε `currentFileName`, ΟΧΙ σε resolvable canonical target
`hooks/scene/useAutoSaveSceneManager.ts`, `setLevelSceneWithAutoSave`, **γραμμές ~198-201**:
```ts
if (originSchedulesAutoSave(origin) && autoSaveEnabled && fileName
    && !isLoadingFromFirestoreRef.current && !isEmptyScene) { …schedule save… }
```
Το gate ελέγχει `fileName` truthy — **όχι** αν υπάρχει resolvable `fileRecordId` + `canonicalScenePath`. Για orphaned όροφο το `currentFileName` ΕΙΝΑΙ set (το όνομα του orphaned αρχείου), οπότε το gate περνά.

### 2.B — Sync set-target ΠΡΙΝ μάθουμε ότι το αρχείο είναι orphaned (race)
`systems/levels/hooks/useLevelSceneLoader.ts`:
- **γρ. 80-84** `resetDxfAutoSaveTarget()` = `setFileRecordId(null)` + `setSaveContext(null)` + `setCurrentFileName(null)`.
- **γρ. 114-119** (σύγχρονα, στην αρχή του effect): αν υπάρχει `sceneFileId` → `setFileRecordId(sceneFileId)` + `setCurrentFileName(level.sceneFileName)` **ΧΩΡΙΣ** να ξέρει αν το αρχείο είναι έγκυρο/orphaned.
- **γρ. 230-238** (async, μετά το `loadFileV2`→null): καλεί `resetDxfAutoSaveTarget()` (το FIX(Β)).

**Το πρόβλημα:** μεταξύ του σύγχρονου set (114-119) και του async reset (236) υπάρχει **παράθυρο**· κάθε edit μέσα σ' αυτό (ή κάθε re-run του effect που ξανα-ανοίγει το target στη γρ. 116) προγραμματίζει save με fileId=`sceneFileId` αλλά **χωρίς** canonicalScenePath. Το `fileId` στο log (`file_80efad96`) = το `sceneFileId` που μπήκε στη γρ. 115 → επιβεβαιώνει ότι το save έτρεξε ΠΡΙΝ/ΑΝΕΞΑΡΤΗΤΑ από το reset.

### 2.C — Το resolve block παράγει νέο fileId χωρίς path → throw
Ίδιο αρχείο, **γρ. 217-261** (debounced callback): όταν `fileId`/`canonicalScenePath` λείπουν → `findExistingFileRecord(companyId, fileName)`· για το orphaned αρχείο το `files` doc λείπει → επιστρέφει null → `generateFileId(fileName)` (νέο id) αλλά **`canonicalScenePath` μένει undefined** → `autoSaveV2(...)` → `saveToStorageImpl` **throw ADR-293** (`services/dxf-firestore-storage.impl.ts:174-177`).

### Σύνοψη ρίζας
Ένας **file-less / orphaned** όροφος **δεν έχει DXF floorplan blob προς αποθήκευση** — το BIM του ζει durable στα per-entity collections (floorId-keyed, ADR-420/469). Άρα ο DXF auto-save θα ΄πρεπε να είναι **πλήρως απενεργοποιημένος** για τέτοιον όροφο. Σήμερα ανοίγει σύγχρονα (πριν μάθουμε το orphaned) + το gate δεν απαιτεί resolvable target → throw.

---

## 3. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ (SSoT — διάβασέ τα ΠΡΩΤΑ)
| Ρόλος | Path:γρ. |
|---|---|
| **Throw point (ADR-293)** | `services/dxf-firestore-storage.impl.ts:174-177` |
| autoSaveV2 (delegate) | `services/dxf-firestore.service.ts:214-225` |
| **Auto-save gate + resolve (καρδιά)** | `hooks/scene/useAutoSaveSceneManager.ts:167-305` (gate 198-201· resolve 217-261) |
| **resetDxfAutoSaveTarget + sync set + async reset (FIX Β)** | `systems/levels/hooks/useLevelSceneLoader.ts:80-84, 114-119, 230-238` |
| origin gate SSoT | `hooks/scene/scene-write-origin.ts` (`originSchedulesAutoSave`) |
| save-status / debounce | `config/timing-config.ts` (`STORAGE_TIMING.SCENE_AUTOSAVE_DEBOUNCE`) |
| gate test (πρότυπο για νέο test) | `hooks/scene/__tests__/useAutoSaveSceneManager-origin-gate.test.ts` |
| getFileStoragePath / deriveScenePath | `services/dxf-firestore.service.ts` |
| ADR (incident family) | `docs/centralized-systems/reference/adrs/ADR-469-cross-floor-per-entity-bim-load.md` (§2.2 FIX Β) + ADR-293 |

**SSoT audit που έγινε ΗΔΗ (επιβεβαίωσε μόνο):** ΔΕΝ υπάρχει υπάρχων μηχανισμός tracking για «orphaned fileId / unresolvable scene target» στον auto-save manager (grep `orphan|unresolvable|noDxfTarget` → μόνο wall/opening cascade, άσχετα). Άρα ο μηχανισμός latch θα είναι **νέος** — βάλ' τον SSoT (ΕΝΑ σημείο), όχι scattered flags.

---

## 4. ΚΑΤΕΥΘΥΝΣΗ ΛΥΣΗΣ (Revit-grade — ΕΣΥ κάνεις audit + αποφασίζεις + ζητάς έγκριση)

Στόχος: **μηδέν ADR-293 throw** σε file-less/orphaned όροφο, **χωρίς** να σπάσει ο κανονικός DXF auto-save υπαρκτών floorplans. Σκέψου (κάνε δικό σου SSoT audit πρώτα):

1. **SSoT latch «no DXF scene target»** (προτεινόμενο): ένα `Set<fileId>` (ή reactive flag) στον `useAutoSaveSceneManager` που γεμίζει όταν το `loadFileV2`→null (orphaned). Το gate (198-201) προσθέτει `&& !isOrphanedTarget(currentFileId)`. Το σύγχρονο set (114-119) **δεν** ξανα-ανοίγει target για known-orphaned fileId. ΕΝΑ SSoT, μηδέν scattered suppress.
2. **Gate-on-resolvable-target:** το gate να μην πυροδοτεί save όταν δεν υπάρχει (cached/injected) `canonicalScenePath` ΚΑΙ ο resolve δεν μπορεί να το βρει → silent skip (telemetry), **όχι** throw. Πρόσεξε να ΜΗΝ μπλοκάρεις τον πρώτο legit save νέου standalone DXF (που όντως χρειάζεται path).
3. **Συγχρονισμός orphaned-detection:** να μην ανοίγει το σύγχρονο target (116) μέχρι να επιβεβαιωθεί έγκυρο storagePath — ή latch αμέσως μόλις βρεθεί orphaned ώστε κανένα re-run του effect να μην το ξανανοίγει.

**Belt-and-suspenders (N.7.2):** primary = ο όροφος ποτέ δεν αποκτά DXF auto-save target όταν orphaned/file-less· safety net = ο resolve, αν φτάσει σε αδιέξοδο (no path, file gone), κάνει **skip + telemetry** αντί throw. Idempotent, μηδέν race.

⚠️ **Πρόσεξε τα ADR-040 micro-leaf / auto-save storm constraints** (CLAUDE.md DXF section) — μην προσθέσεις high-freq subscriptions. Το latch = ref/Set, όχι re-render.

---

## 5. TEST (presubmit-grade)
- Επέκτεινε `hooks/scene/__tests__/useAutoSaveSceneManager-origin-gate.test.ts` (ή νέο suite): «orphaned/file-less target → local-edit ΔΕΝ καλεί `autoSaveV2` / δεν πετάει ADR-293» + «κανονικό file-linked floorplan → save κανονικά (μη regression)».
- Αν αγγίξεις `useLevelSceneLoader` → δες `systems/levels/__tests__/scene-bim-load-policy.test.ts` + τυχόν loader tests.

---

## 6. ΥΠΟΧΡΕΩΣΕΙΣ ΟΛΟΚΛΗΡΩΣΗΣ (N.15)
1. Ενημέρωσε **ADR-469** (νέα §FIX + changelog v1.2) ή νέο ADR αν το κρίνεις cross-cutting (επόμενο free = **ADR-470**· ⚠️ έλεγξε το `adr-index.md` — το ADR-470 ίσως πιάστηκε από άλλη συνεδρία· πάρε το επόμενο ελεύθερο).
2. Ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (γραμμή ADR-469 ή νέα).
3. Ενημέρωσε `docs/centralized-systems/reference/adr-index.md` αν νέο ADR.
4. Ενημέρωσε μνήμη (`reference_bim_dual_persistence_load_ssot` / `reference_cross_floor_per_entity_bim_load`).
5. tsc (background, N.17) + jest GREEN.
6. **ΟΧΙ commit** — ο Giorgio. Stage ΜΟΝΟ δικά σου (shared tree).

---

## 7. ΠΡΩΤΟ ΒΗΜΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε ΟΛΟ αυτό το handoff + ADR-469 §2.2 + ADR-293.
2. Διάβασε τα 3 αρχεία-κλειδιά (§3): `useAutoSaveSceneManager.ts`, `useLevelSceneLoader.ts`, `dxf-firestore-storage.impl.ts`.
3. SSoT audit (grep) — επιβεβαίωσε ότι δεν υπάρχει ήδη orphaned-target latch· δες πώς συνδέεται ο `useLevelSceneLoader` με τον `useAutoSaveSceneManager` (setter wiring).
4. Πρότεινε σύντομο plan (latch SSoT + gate guard + test) + **ζήτα έγκριση** ΠΡΙΝ υλοποιήσεις.
5. Απάντα στα Ελληνικά.
