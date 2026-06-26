# HANDOFF — ADR-535 Φ3 (γενίκευση roof/floor-finish/slab-opening) + Φ4 (edit-mode UX)

**Date:** 2026-06-26 · **ADR:** ADR-535 (`docs/centralized-systems/reference/adrs/ADR-535-3d-viewport-entity-grips.md`)
**Προηγούμενα:** Φ1 (grips εμφάνιση+hit-test+commit-on-release) **COMMITTED** · Φ2 (live reshape preview + snap + Shift→ortho + per-vertex elevation σε κεκλιμένη πλάκα) **COMMITTED** (`734fd41e`).

---

## 0. ⚠️ ΔΙΑΒΑΣΕ ΠΡΩΤΑ — ΚΑΝΟΝΕΣ ΑΥΤΗΣ ΤΗΣ ΔΟΥΛΕΙΑΣ (ΑΠΑΡΑΒΑΤΟΙ)

1. **SHARED WORKING TREE** — δουλεύει **ΚΑΙ άλλος agent ταυτόχρονα** (ADR-534 BOQ/beam-flange).
   - Τρέξε `git status` ΣΤΗΝ ΑΡΧΗ. **ΜΗΝ** αγγίξεις/κάνεις stage αρχεία που δεν είναι δικά σου.
   - **COMMIT ΤΟΝ ΚΑΝΕΙ Ο GIORGIO** — ΕΣΥ **ΠΟΤΕ** (N.(-1)). Όχι `git add -A`, όχι commit, όχι push.
   - **tsc: ΕΝΑΣ τη φορά (N.17)** — έλεγξε για running tsc ΠΡΙΝ ξεκινήσεις (`Get-CimInstance Win32_Process … *tsc*`). Προτίμησε colocated jest.
2. **FULL ENTERPRISE + FULL SSOT** (εντολή Giorgio, «όπως η Revit»):
   - **ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT με grep.** Μην εμπιστεύεσαι τυφλά
     αυτό το handoff — **ξανα-grep ΚΑΘΕ symbol/path** παρακάτω (shared tree, μπορεί να άλλαξε).
   - Αν υπάρχει ήδη κεντρικά → **χρήσε το**, μην ξαναγράψεις. ΜΗΔΕΝ διπλότυπα.
   - Zero `any`/`as any`/`@ts-ignore` (N.2)· functions ≤40 γρ., files ≤500 γρ. (N.7.1)· zero hardcoded strings (N.11).
3. **Απάντα στον Giorgio ΣΤΑ ΕΛΛΗΝΙΚΑ** (language rule).

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (Φ1+Φ2 — COMMITTED, μην το ξαναφτιάξεις)

**7 thin αρχεία** `src/subapps/dxf-viewer/bim-3d/grips/`:
`grip-plane-projection.ts` (ray∩horiz-plane→plan-mm PURE) · `grip-3d-reshape-grips.ts` (φίλτρο reshape PURE) ·
`grip-3d-hit-test.ts` (nearest gripIndex) · `grip-mesh-factory-3d.ts` (GripInfo[]→cubes+hitboxes, **per-grip elevation resolver** `(grip)=>elevMm`) · `bim-grip-overlay-3d.ts` (scene leaf, ADR-040 zero-store) ·
`bim-grip-controller-3d.ts` (FSM hover→drag, **snap** στην κορυφή, drag plane = `gripStartWorld.y`) · `grip-3d-commit.ts` (→`commitDxfGripDragModeAware`).

**Animation:**
- `bim3d-grip-drag.ts` **(ΝΕΟ Φ2)** — `refreshReshapeGrips` (re-seat grips + **per-vertex elevation** `slabGripElevationMmFor` μέσω `slabTopZmmAt`) + `applyGripReshapePreview` (live per-frame mesh rebuild) + `commitGripReshape`. Type-only `EditInteractionCtx` import → μηδέν runtime cycle.
- `bim3d-preview-rebuild.ts` — `buildSlabReshapePreviewObject(entityId, gripKind, deltaMm)` (αδελφός `rebuildSlab`· `applySlabGripDrag` αντί resize· Shift→rectilinear από `ShiftKeyTracker` = ΙΔΙΑ πηγή με commit → **ghost===commit**).
- `bim3d-edit-drag-snap.ts` — `buildGripReshapeSnapFn(ctx, entityId)` (reuse `getGlobalSnapEngine`+`makeResizeSnapFn`+`syncSnapEngineViewportFor3D`).
- `bim3d-edit-interaction-handlers.ts` — grip-first pointerdown (capture+inject snapFn)· move→`applyGripReshapePreview`· up→commit + `preview.commit()`/`reset()`· cancel→`reset()`.
- `use-bim3d-edit-interaction.ts` — mount overlay+controller, `refreshReshapeGrips` σε selection/resync, dispose.

**Tests:** `grips/__tests__/` 4 suites + `animation/__tests__/bim3d-grip-preview-rebuild.test.ts` (headline «preview===commit»). 21 jest GREEN. tsc 0.

**Pilot = ΠΛΑΚΑ (slab) μόνο.** Φ3 = γενίκευση, Φ4 = UX.

---

## 2. SSoT AUDIT (έγινε 2026-06-26 — ΞΑΝΑ-grep ΠΡΙΝ τα χρησιμοποιήσεις)

### 2.1 Τα grips ΚΑΙ τα commit adapters ΥΠΑΡΧΟΥΝ ΗΔΗ (2D) για ΟΛΟΥΣ τους τύπους
| Τύπος | grips (pure) | commit adapter | apply transform | converter (3D mesh) | per-point elevation |
|---|---|---|---|---|---|
| slab ✅Φ1/Φ2 | `bim/slabs/slab-grips.ts` `getSlabGrips` | `commitSlabGripDrag` | `applySlabGripDrag` | `slabToMesh` | `slabTopZmmAt` (slab-slope.ts) |
| **roof** | `bim/roofs/roof-grips.ts` `getRoofGrips`/`applyRoofGripDrag`/`removeVertexFromRoof` | `commitRoofGripDrag` (`grip-parametric-footprint-commits.ts:97`) | `applyRoofGripDrag` | `roofToMesh` (`roof-to-three.ts:408`) | **`roofZmm`** (`bim/geometry/roof-lower-envelope.ts:116`) |
| **floor-finish** | `bim/floor-finishes/floor-finish-grips.ts` `applyFloorFinishGripDrag` | `commitFloorFinishGripDrag` (`…:181`) | `applyFloorFinishGripDrag` | `floorFinishToMesh` (`floor-finish-to-three.ts:72`) | επίπεδο (FFL· χωρίς slope — απλό) |
| **slab-opening** ⚠️ | `bim/slab-openings/slab-opening-grips.ts` `applySlabOpeningGripDrag` | `commitSlabOpeningGripDrag` (`…:140`) | `applySlabOpeningGripDrag` | **ΔΕΝ έχει δικό mesh** (= τρύπα στην πλάκα) | — |

- **`commitDxfGripDragModeAware`** (`hooks/grips/grip-commit-adapters.ts`) ΗΔΗ δρομολογεί με βάση `roofGripKind`/`floorFinishGripKind`/`slabOpeningGripKind` → το commit path είναι **ήδη type-agnostic**.
- **roof/floor-finish είναι ΗΔΗ selectable στο 3D**: `roofToMesh` → `userData['bimType']='roof'` (`roof-to-three.ts:251,449`)· `floorFinishToMesh` → `tagMesh(...,'floor-finish',...)` (`floor-finish-to-three.ts:112`)· sync μέσω `BimSceneLayer.syncPointEntities(...,'roof'/'floor-finish',...)` (`BimSceneLayer.ts:356,365`). Άρα η επιλογή θέτει `editBimType='roof'`/`'floor-finish'`.

### 2.2 Τι ακριβώς πρέπει να γενικευτεί (Φ3)
1. **Φίλτρο** `grip-3d-reshape-grips.ts` → `reshapeGripsForSlab` ελέγχει ΜΟΝΟ `slabGripKind`. Γενίκευσέ το (νέο `reshapeGripsForFootprint`) ώστε να κρατά grips με ΟΠΟΙΟΔΗΠΟΤΕ footprint gripKind (`slab/roof/floorFinish/slabOpening`), πάντα `!movesEntity`.
2. **toUnifiedGrip** στο `grip-3d-commit.ts` → σήμερα περνά ΜΟΝΟ `slabGripKind`. Πρόσθεσε `roofGripKind`/`floorFinishGripKind`/`slabOpeningGripKind` (1:1 map· `commitDxfGripDragModeAware` αναλαμβάνει το routing).
3. **`refreshReshapeGrips`** (`bim3d-grip-drag.ts`) → `bimType !== 'slab'` guard. Επέκτεινε σε `{'slab','roof','floor-finish','slab-opening'}` + **per-vertex elevation ανά τύπο**:
   - slab → `slabTopZmmAt` (υπάρχει).
   - roof → `roofZmm` (per-point envelope Z).
   - floor-finish → επίπεδο FFL (μηδέν slope).
   - slab-opening → υψόμετρο του host slab top (reuse `slabTopZmmAt` του host).
4. **Live preview builders** στο `bim3d-preview-rebuild.ts` (αδελφοί `buildSlabReshapePreviewObject`):
   - `buildRoofReshapePreviewObject` → `applyRoofGripDrag` → `roofToMesh`.
   - `buildFloorFinishReshapePreviewObject` → `applyFloorFinishGripDrag` → `floorFinishToMesh`.
   - **slab-opening = ΕΙΔΙΚΗ**: δεν έχει δικό mesh· πρέπει να ξαναχτιστεί ο **host slab** με τη μετακινημένη τρύπα. Πρότυπο: `buildOpeningHostWallPreview` (ίδιο αρχείο, ADR-363 Slice 2g, rebuild host wall με moved opening). **Σύσταση: slab-opening σε δικό του Φ3b** (πιο σύνθετο)· πρώτα roof + floor-finish (καθαρά, σχεδόν δωρεάν).
5. **`applyGripReshapePreview`** (`bim3d-grip-drag.ts`) → σήμερα καλεί μόνο `buildSlabReshapePreviewObject` βάσει `slabGripKind`. Κάν' το dispatch ανά gripKind στον σωστό builder.

### 2.3 Φ4 building blocks (audit)
- **removeVertex** SSoT: `removeVertexFromSlab` (slab-grips.ts)· `removeVertexFromRoof` (roof-grips.ts)· δες αν υπάρχει για floor-finish/slab-opening (grep). Guard ≤3 κορυφές υπάρχει.
- **Hide gizmo κατά το reshape:** ο gizmo έχει ΗΔΗ `collapseToMoveHandles()`/`restoreConfiguredHandles()` (`bim-gizmo-overlay.ts`, χρησιμοποιούνται στο move drag). Reuse: στο grip pointerdown κρύψε gizmo, στο release/cancel επανέφερε.
- **3D context-menu για entity: ΔΕΝ ΥΠΑΡΧΕΙ** (μόνο `view-cube-context-menu.tsx`). Το «δεξί κλικ σε κορυφή → Διαγραφή/Εισαγωγή» είναι **ΝΕΟ** (το μεγαλύτερο κομμάτι του Φ4). Πρότυπο 2D: `hooks/grips/useGripContextMenuController.ts` (έχει ΗΔΗ removeVertex/insert logic — δες για reuse της λογικής, όχι του DOM).
- **Edit-mode toggle** («Επεξεργασία σκίτσου» / Revit «Edit Sketch»): grep για υπάρχον toggle στο ribbon Δομικά/Αρχιτεκτονικά πριν φτιάξεις νέο.

---

## 3. ΣΧΕΔΙΟ ΥΛΟΠΟΙΗΣΗΣ (φασικό, μικρά βήματα, colocated jest ανά βήμα)

### Φ3a — roof + floor-finish (καθαρά, χαμηλό ρίσκο)
1. Γενίκευσε `reshapeGripsForSlab` → `reshapeGripsForFootprint` (κράτα alias αν χρειάζεται). Test.
2. `toUnifiedGrip` (grip-3d-commit) → map και τα 3 νέα gripKinds. Test (mock deps· φτάνει σωστός adapter).
3. `refreshReshapeGrips` → δέξου roof/floor-finish· per-vertex elevation: roof→`roofZmm`, floor-finish→FFL. Test.
4. Builders `buildRoofReshapePreviewObject` + `buildFloorFinishReshapePreviewObject` (mirror slab· headline test «preview===commit»).
5. `applyGripReshapePreview` dispatch ανά gripKind.
6. Wiring: επιβεβαίωσε ότι η επιλογή roof/floor-finish στο 3D φτάνει `editBimType` σωστά (αν όχι → δες `syncFromSelection`/`activateMove`).

### Φ3b — slab-opening (ειδική: rebuild host slab με moved hole)
- Mirror `buildOpeningHostWallPreview` αλλά για slab+slab-opening· per-vertex elevation = host slab top.

### Φ4 — edit-mode UX
1. **Hide gizmo κατά το grip drag** (reuse `collapseToMoveHandles`/`restoreConfiguredHandles`). Μικρό.
2. **Edit-mode toggle** (προαιρετικό· grep υπάρχον). Μεσαίο.
3. **Context-menu κορυφής** (δεξί κλικ → Διαγραφή/Εισαγωγή κορυφής): reuse τη λογική του 2D `useGripContextMenuController` + `removeVertexFrom*`· νέο 3D popup (i18n N.11). **Το μεγαλύτερο** — ίσως δικό του sub-handoff.

---

## 4. ΠΙΝΑΚΑΣ ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΗΣΗΣ SSoT (μηδέν διπλότυπο)
| Ανάγκη | Υπάρχον SSoT — reuse | Νέο; |
|---|---|---|
| Θέσεις λαβών | `computeDxfEntityGrips` (dispatch ανά τύπο) | ❌ reuse |
| Φίλτρο reshape | `reshapeGripsForSlab` → γενίκευση | ⚠️ widen |
| Drag→params | `applyRoofGripDrag`/`applyFloorFinishGripDrag`/`applySlabOpeningGripDrag` | ❌ reuse |
| Commit | `commitDxfGripDragModeAware` (ήδη type-agnostic) | ❌ reuse |
| Live mesh | `roofToMesh`/`floorFinishToMesh` (+ host-slab rebuild για opening) | ⚠️ thin builders |
| Per-vertex elevation | `slabTopZmmAt` / `roofZmm` | ❌ reuse |
| Snap | `buildGripReshapeSnapFn` | ❌ reuse |
| Hide gizmo | `collapseToMoveHandles`/`restoreConfiguredHandles` | ❌ reuse |
| Delete/insert vertex | `removeVertexFrom*` + λογική `useGripContextMenuController` | ⚠️ reuse logic, νέο 3D UI |
| Live swap | `Bim3DEditLivePreview.captureResize/applyResize/commit/reset` | ❌ reuse |

---

## 5. ΣΥΜΜΟΡΦΩΣΗ / ΡΙΣΚΑ
- **ADR-040 / CHECK 6B/6D:** αγγίζεις bim-3d edit αρχεία → **stage ADR-535 (+ ADR-040)**. Overlay/controller μένουν pure-THREE leaves (zero store sub).
- **N.7.1:** πρόσεξε `bim3d-preview-rebuild.ts` (~475 γρ. ήδη) — οι νέοι builders ίσως το περάσουν τις 500 → **σπλιτ** σε `bim3d-grip-preview-builders.ts` (ή ανά τύπο). `bim3d-grip-drag.ts` (117 γρ.) έχει χώρο.
- **Ρίσκο #1 — slab-opening:** δεν έχει δικό mesh → ξαναχτίσιμο host slab. Μην το βιάσεις· Φ3b ξεχωριστά.
- **Ρίσκο #2 — επιλογή στο 3D:** επιβεβαίωσε ότι roof/floor-finish/slab-opening γίνονται single-select με σωστό `editBimType` ΠΡΙΝ χτίσεις grips (αλλιώς δεν θα εμφανίζονται).
- **Ρίσκο #3 — roof slope πολυεπίπεδη:** το `roofZmm` δίνει per-point Z· επιβεβαίωσε ότι ταιριάζει με το `roofToMesh` rendered top (όπως slab `slabTopZmmAt`↔`applySlabSlope`).
- **N.11:** το context-menu Φ4 έχει labels → keys σε `el/en` locales ΠΡΙΝ τον κώδικα.

## 6. TESTING (Google presubmit-grade, colocated jest)
- `reshapeGripsForFootprint` — κρατά roof/floor-finish/slab-opening reshape grips, αγνοεί whole-entity.
- `grip-3d-commit` — roof/floor-finish/slab-opening gripKind → σωστός adapter (mock deps).
- builders — headline «preview===commit» (geometry === `apply*GripDrag`+converter), no-op/unknown/multi-floor → null.
- per-vertex elevation — roof grip elevation = `roofZmm` (κεκλιμένη στέγη → όχι coplanar).

## 7. ΠΗΓΕΣ ΑΛΗΘΕΙΑΣ
- ADR: `docs/centralized-systems/reference/adrs/ADR-535-3d-viewport-entity-grips.md` (§3 πίνακας φάσεων, §4.2 αρχεία, §5 SSoT reuse, §7 testing).
- Memory: `reference_3d_viewport_entity_grips.md`.
- Πρότυπα: Φ2 αρχεία (§1) — αντίγραψε το pattern ανά τύπο.
