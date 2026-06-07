# HANDOFF 2026-06-07 — ADR-420 BIM Floor-Scope ✅ DONE · ΕΠΟΜΕΝΟ: 3D Multi-Floor Elevation 🔴

> Giorgio γράφει/διαβάζει **Ελληνικά** → απάντα ΠΑΝΤΑ Ελληνικά.
> **FULL ENTERPRISE + FULL SSOT, Revit-grade.** Καμία πρόχειρη λύση.

---

## ⚠️ ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασέ τους ΠΡΩΤΑ)
- **Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** ΠΟΤΕ `git add -A`/`git add .` — μόνο τα δικά σου αρχεία. **Giorgio κάνει τα commits, ΟΧΙ εσύ** (N.-1). Μην committάρεις/pushάρεις.
- Το περιβάλλον κάνει **auto-checkpoint commits** περιοδικά (είδα commit `b2357460` που δεν τον έκανα εγώ). Μην ξαφνιαστείς αν αλλαγές εμφανιστούν committed.
- ΜΗΝ τρέξεις `git stash pop` (ρύπανσε working tree από παλιό `stash@{0}` «safety-pre-phase0.5-sed»). Το `stash@{0}` είναι του Giorgio — άστο.
- Project = **pagonis-87766** (`.env`: FIREBASE_PROJECT_ID). Default Firestore DB. firebase deploy δουλεύει (authenticated).
- Ο Giorgio **άδειασε τη βάση + έφτιαξε νέα εταιρεία** στο τέλος της προηγ. συνεδρίας. Νέα εταιρεία = fresh data.

---

## ΜΕΡΟΣ Α — ADR-420 (ΟΛΟΚΛΗΡΩΘΗΚΕ, για context)

**Τι έλυσε:** Οι 20 BIM persistence services κλείδωναν τη Firestore συνδρομή στο volatile `floorplanId` (=`levelManager.fileRecordId`, αλλάζει σε ΚΑΘΕ re-import) → import σε όροφο Β ορφάνευε τις BIM οντότητες ορόφου Α. **Λύση: σταθερό κλειδί `floorId` (IfcBuildingStorey).**

**Παραδοτέα (όλα tsc-clean):**
- NEW `src/subapps/dxf-viewer/bim/persistence/bim-floor-scope.ts` — SSoT (`resolveBimScope`/`buildBimScopeConstraints`/`bimScopeWriteFields`· floorId preferred, floorplanId fallback). + test 7/7.
- 20 services: config +`floorId?`, `subscribe*`→`buildBimScopeConstraints(this.config)`, `save*`→`...bimScopeWriteFields(this.config)`. `floorplanId` μένει ως provenance. Outliers: stairs (`levelId` field), mep_systems (+floorId στο MepSystemDoc).
- Threading: `app/DxfViewerTopBar.tsx` περνά `floorId={floorId}` σε ΟΛΑ τα 20 `*PersistenceHost` → 20 `use*Persistence` hooks → service configs.
- 40 composite indexes `[companyId,projectId,floorId]`+`[projectId,floorId]` στο `firestore.indexes.json` — **DEPLOYED στο pagonis-87766** ✅.
- Wizard fix: NEW `systems/levels/level-floor-resolution.ts` `findOrCreateLevelForFloor` + `LevelPanel.onComplete` resolve+switch+context σε σωστό level + explicit `targetLevelId` threaded `onSceneImported→handleFileImportWithEncoding→handleFileImport` (race-free).
- `scripts/migrations/backfill-bim-floor-scope.mjs` — safety-net (ΔΕΝ χρειάστηκε run· DB wiped).
- ADR-420 + adr-index (2 πίνακες) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`. firestore.rules: **καμία αλλαγή** (hasAll όχι hasOnly· floorId ήδη επιτρεπτό).
- ✅ ΑΠΟΔΕΙΞΗ ότι δουλεύει: τα BIM της νέας εταιρείας γεννιούνται ήδη με `floorId` (π.χ. 2 columns με `floorId: flr_f1746024`).

**Pre-existing failing tests (ΑΣΧΕΤΑ με ADR-420, ΜΗΝ τα χρεωθείς):** `bim-discipline.test` (mep-radiator/boiler taxonomy stale), `material-thumbnail-resolver.test` (roof slug), **`BimSceneLayer-multifloor.test` + 2 visibility (ADR-399 Phase B 3D)** ← ΑΥΤΟ ΣΧΕΤΙΖΕΤΑΙ ΜΕ ΤΟ ΕΠΟΜΕΝΟ TASK.
**Pre-existing tsc errors (ΟΧΙ δικά σου):** mesh-to-object3d.ts(124), DeleteEntityCommand.ts(52), drawing-preview-generator.ts(116).

---

## ΜΕΡΟΣ Β — 🔴 ΕΠΟΜΕΝΟ TASK: Λάθος υψόμετρα ορόφων στο 3D combined view

**Αναφορά Giorgio (verbatim):** Στο DXF Viewer, project με 1 κτίριο / 2 ορόφους (1ος + 2ος). Φόρτωσε 2 DXF μέσω wizard (καρτέλα Επίπεδα), εμφανίζονται σωστά ανά όροφο. Στο **3D**: όροφος 1 μόνος του → ΟΚ· όροφος 2 μόνος του → ΟΚ· **ΚΑΙ ΟΙ ΔΥΟ μαζί → ο 1ος όροφος εμφανίζεται ΠΑΝΩ από τον 2ο** (αντεστραμμένα/λάθος υψόμετρα). Πρέπει ο 1ος (ισόγειο) z=0, ο 2ος από πάνω.

**Στόχος:** Σωστή στοίβαξη ορόφων στο 3D multi-floor view (Revit-style: κάθε όροφος στο πραγματικό του υψόμετρο). FULL ENTERPRISE + FULL SSOT.

**Leads (από προηγ. exploration — ΕΠΑΛΗΘΕΥΣΕ, code=source of truth):**
- **ADR-399 Phase B** = το multi-floor 3D sync. Test: `src/subapps/dxf-viewer/bim-3d/scene/__tests__/BimSceneLayer-multifloor.test.ts` — λέει «passes each floor its own **floorElevationMm** + levelId to the converter» + «builds one wall mesh per floor in the stack». **Τρέχει FAILING τώρα** → πιθανό σημείο-κλειδί.
- Ψάξε: `BimSceneLayer` (`bim-3d/scene/`) `syncMultiFloor` — πώς υπολογίζει `floorElevationMm` ανά όροφο. Πιθανή ρίζα: η σειρά/υψόμετρο αντλείται λάθος (π.χ. αντεστραμμένο order, ή ο 2ος όροφος παίρνει μικρότερο/αρνητικό elevation).
- Από πού έρχεται το υψόμετρο ορόφου: `floors` collection (building floor docs, `flr_*`) — έχουν elevation/order/height; ή derived από `Level.order`; SSoT? Grep: `floorElevationMm`, `useFloorMetadata`, `useFloorsByBuilding`, `floor.elevation`, `floor.level`.
- Νέα εταιρεία data (pagonis-87766): company `comp_9c7c1a50…`· νέο project `proj_581aa878…`· building με 2 ορόφους. Query `floors` (companyId/buildingId) + `dxf_viewer_levels` για να δεις elevation fields + order.
- ⚠️ ΜΗΝ αγγίξεις ADR-040 micro-leaf αρχεία χωρίς λόγο (CHECK 6B/6C/6D). Διάβασε ADR-040 αν αγγίξεις canvas/3D render pipeline.

**Πρόταση προσέγγισης:** Plan Mode → Explore (BimSceneLayer multi-floor + floor elevation SSoT + floors-collection schema) → εντόπισε πού υπολογίζεται/αντλείται το per-floor elevation → SSoT helper για «floor stacking elevation» (Revit: base elevation ανά IfcBuildingStorey) → fix + BimSceneLayer-multifloor test → ADR update (ADR-399 ή νέο).

**Verification:** localhost:3000/dxf/viewer → 3D → combined 2 floors → ο 1ος κάτω (z=0), ο 2ος από πάνω στο σωστό ύψος. + BimSceneLayer-multifloor test PASS.

---

## Git state (τέλος συνεδρίας)
Uncommitted (πιθανόν — env auto-commits): τελευταία onSceneImported type-fixes (`useDxfViewerCallbacks.ts`, `FloatingPanelContainer.tsx`, `usePanelContentRenderer.tsx`, `toolbar/types.ts`), backfill script ADC fallback. Ο Giorgio θα κάνει commit. ΜΗΝ committάρεις.
