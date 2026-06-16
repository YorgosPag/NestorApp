# HANDOFF — Κολώνα (+σοβάς) χάνεται μετά reload: ΡΙΖΑ = cross-floor link μηδενίζει το save target

**Ημερομηνία:** 2026-06-16 · **Μοντέλο:** Opus 4.8 · **Κατάσταση:** διάγνωση ΟΛΟΚΛΗΡΩΜΕΝΗ & επιβεβαιωμένη· υλοποίηση πραγματικής λύσης ΕΚΚΡΕΜΕΙ.

> ⚠️ **Shared working tree** με άλλον agent → `git add` ΜΟΝΟ δικά σου αρχεία. **COMMIT/PUSH τα κάνει ο Giorgio, ΟΧΙ εσύ** (N.(-1)). Revit-grade, full enterprise + full SSOT. **GREP-FIRST** πριν γράψεις κώδικα (μηδέν διπλότυπα).

---

## 1. Αρχικό σύμπτωμα (πώς ξεκίνησε)
Ο Giorgio δημιουργεί **κολώνα στο ισόγειο**, πάει στο 3Δ, την **πλαγιάζει** (tilt). Παρατήρησε: (Bug A) ο σοβάς δεν γέρνει με τον πυρήνα· (Bug B) μετά από **hard refresh χάνεται ΟΛΗ η κολώνα + ο σοβάς, σε κάθε περίπτωση** (και χωρίς tilt).

## 2. ΡΙΖΑ Bug B — ΕΠΙΒΕΒΑΙΩΜΕΝΗ ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΑ (αυτό είναι το κύριο)

Οι κολώνες **δεν γράφονται ποτέ** στο Firestore. Firestore baseline (MCP): `floorplan_columns` = **0 docs**.

Diagnostic log (μετά από προσθήκη logging — βλ. §4) όταν σχεδιάζεται κολώνα:
```
[useColumnPersistence] Column created but persistence service NOT ready — column will NOT persist
{ columnId:"col_0f9cf7d9…", hasCompanyId:true, projectId:null, floorplanId:null, hasUserId:true }
```

**Αλυσίδα αιτίας:**
1. Το ενεργό level **`lvl_85a2d61c-71fa-4859-9b52-75fc509a7851`** (ισόγειο, floor **`flr_0f8524a1-8bba-43a8-831e-e01230bc60f0`**) έχει `sceneFileId` = **`file_68717ab8-a43a-4ae9-8864-228a1c1e96d2`** που ανήκει σε **ΑΛΛΟ** floor (`flr_9fd4c003-26b9-4bb2-89be-66547d56c00a`).
2. `useLevelSceneLoader.ts:150-158` → `isCrossFloorSceneLink(fileRecord, level?.floorId)` = true → console.warn «skipping cross-floor load» + `setLevelScene(createEmptyScene())` + **`resetDxfAutoSaveTarget()`** + return.
3. `resetDxfAutoSaveTarget()` μηδενίζει `levelManager.fileRecordId` **και** `saveContext.projectId`.
4. `DxfViewerTopBar.tsx:134-142` περνά στο `ColumnPersistenceHost`: `projectId={levelManager.saveContext?.projectId ?? undefined}`, `floorplanId={levelManager.fileRecordId ?? undefined}` → **null/undefined**.
5. `useColumnPersistence.ts:160-172` gate: `if (!companyId || !projectId || !floorplanId || !userId) { serviceRef.current = null; return; }` → service **null**.
6. `drawing:entity-created` listener (`useColumnPersistence.ts:451`) → `if (!serviceRef.current) return` → η κολώνα **δεν persist-άρεται ποτέ** → reload → `reconcileLoadedSceneBim` πετά το snapshot BIM → χάνεται ΟΛΗ η κολώνα + ο derived σοβάς.

**ΣΗΜΑΝΤΙΚΟ:** Αυτό **ΔΕΝ** είναι column-specific. ΟΛΑ τα BIM entities (κολώνα/δοκάρι/τοίχος…) χάνονται σε αυτό το level. Τα 3 δοκάρια που υπάρχουν στη βάση (`floorplan_beams`) persist-άρθηκαν από το **άλλο** floor (`flr_9fd4c003`, file `file_eb1f8525-0049-4da5-8f78-47964351d43d`) που είχε έγκυρο scope.

**Δεδομένα session:** company `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` · project `proj_0df5af7a-1e3b-47ca-b5a9-01210dd9a353` · user `WKBWEg3DSfcdSbLNJfzGEW3vkct1`.

## 3. ΤΟ ΖΗΤΟΥΜΕΝΟ (πραγματική λύση — ΕΚΚΡΕΜΕΙ)

**Γιατί το ισόγειο level δείχνει σε scene file ΑΛΛΟΥ floor;** Αυτό είναι data-integrity / level-creation bug. Δύο άξονες:
- **(α) Code (Revit-grade):** όταν ένα level δεν έχει έγκυρο own-floor `fileRecord`, ΑΝΤΙ να μηδενίζεται σιωπηλά το save target και να χάνονται όλα, να **δημιουργείται lazily ΝΕΟ fileRecord για το σωστό floor** κατά την πρώτη σχεδίαση/save (Revit «κάθε όροφος = δικός του χώρος»). Έτσι το save target γίνεται έγκυρο και τα entities persist-άρονται.
- **(β) Data:** πώς δημιουργήθηκε το cross-floor link (το ισόγειο πήρε sceneFileId άλλου floor); Έλεγξε αν είναι one-off corruption ή συστηματικό bug στη δημιουργία level/floor.

**GREP-FIRST (υποχρεωτικό πριν κώδικα):**
- `resetDxfAutoSaveTarget` — πού ορίζεται, τι μηδενίζει, ποιοι το καλούν.
- `isCrossFloorSceneLink` — ο predicate (conservative)· πότε true.
- `setFileRecordId`, `setSaveContext`, `saveContext` — πώς ορίζεται το save target (ThreeJsSceneManager / scene-manager-actions).
- `DxfFirestoreService` — `createFileV2`/`saveFileV2`/`loadFileV2` — πώς δημιουργείται/συνδέεται fileRecord σε floor (`entityId` = floorId).
- Πώς ένα level αποκτά `sceneFileId` (level creation / floor↔file linking στο `systems/levels`).
- Μην δημιουργήσεις νέο fileRecord-creation path αν υπάρχει — reuse.

**Verification (όταν υλοποιηθεί):**
1. Στο ισόγειο (`lvl_85a2d61c`) σχεδίασε κολώνα → `firestore_count('floorplan_columns')` πρέπει να γίνει **>0** (ήταν 0).
2. Hard refresh → κολώνα επιβιώνει σε 2Δ & 3Δ.
3. ΟΧΙ «skipping cross-floor load» στην κονσόλα (ή το level αποκτά έγκυρο own fileRecord).
4. Έλεγχος ότι δεν σπάει το multi-floor 3D (ADR-399) — το cross-floor guard υπάρχει για λόγο (να μη γράφεται άλλου floor το file).

## 4. ΤΙ ΕΓΙΝΕ ΗΔΗ (UNCOMMITTED — σωστά hardening, ΚΡΑΤΗΣΕ ΤΑ· δικά μου αρχεία)

> Αυτά ΔΕΝ ήταν η αιτία αλλά είναι σωστές enterprise βελτιώσεις. Κράτησέ τα.

- **`bim/columns/column-firestore-service.ts`** — `stripUndefinedDeep(params/validation/geometry)` σε `saveColumn`+`updateColumn` (reuse SSoT `@/utils/firestore-sanitize`, mirror wall/stair). Προστατεύει από Firestore «Unsupported field value: undefined».
- **`bim/beams/beam-firestore-service.ts`** — ίδιο (boy-scout, ήταν ευάλωτο).
- **`hooks/data/useColumnPersistence.ts`** — (i) import `createModuleLogger`; (ii) `logger.error` στα catch του `persistOnce`/`persistRestore` (ΕΣΠΑΣΕ το silent-fail)· (iii) `logger.warn` diagnostic στο `drawing:entity-created` listener (το «service NOT ready» log — **αυτό αποκάλυψε την αιτία**). ➜ Μπορείς να κατεβάσεις το «scheduling first save» warn σε debug-level αργότερα· κράτα το «service NOT ready» warn (χρήσιμο μόνιμα).
- **`.claude-rules/pending-ratchet-work.md`** — εγγραφή «BIM Firestore stripUndefinedDeep gap»: ~15 services (foundation/slab/roof/railing/MEP/opening…) έχουν το ίδιο raw-`params` κενό· migrate-on-touch.
- **Plan file:** `C:\Users\user\.claude\plans\cozy-waddling-peach.md` (η αρχική στρατηγική — έχει πλέον ξεπεραστεί ως προς το Bug B).

## 5. Bug A (σοβάς δεν ακολουθεί tilt) — DEFER, ξεχωριστό
Αφού πρώτα η κολώνα επιβιώνει (Bug B), τότε ισχύει το Bug A. **Επιβεβαιωμένη αιτία:** ο finish skin (ADR-449) χτίζεται flat (`buildFinishSkinFromFaces`→`stripPrismGeometry`, σχόλιο «Flat-path μόνο» `structural-finish-3d.ts:127`) και ΔΕΝ εφαρμόζει το tilt shear. **Λύση (Revit-grade «split tilted-out / flat-in»):** tilted στοιχεία βγαίνουν από τον ενιαίο silhouette union και παίρνουν per-element finish με reuse του SSoT `applyColumnTilt`/`applyWallTilt`/`applyBeamSlope` (`mesh-slope-shear.ts`) στο finish `BufferGeometry`. Λεπτομέρειες & αρχεία: §«Μέρος 2» στο plan file `cozy-waddling-peach.md`. **Μηδέν νέα μαθηματικά — reuse μόνο.**

## 6. Κανόνες session
- Shared tree → `git add` ΜΟΝΟ δικά σου· **commit/push ο Giorgio**.
- Revit-grade, full enterprise, full SSOT, GREP-FIRST, μηδέν διπλότυπα.
- ADR-driven (N.0.1): βρες/ενημέρωσε σχετικό ADR (ADR-399 cross-floor, ADR-293/358 save context, ADR-390 load policy). Update `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (N.15).
- ΕΝΑ tsc τη φορά (N.17).
