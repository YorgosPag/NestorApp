# HANDOFF — ADR-535 Φ3b (slab-opening host-rebuild) + Φ4-υπόλοιπο (toggle + context-menu κορυφής)

**Date:** 2026-06-26 · **ADR:** ADR-535 (`docs/centralized-systems/reference/adrs/ADR-535-3d-viewport-entity-grips.md`)
**Προηγούμενα (ΟΛΑ UNCOMMITTED, ίδιο tree):** Φ1 (grips εμφάνιση+hit-test+commit) `734fd41e`/Φ2 (live preview+snap+Shift+per-vertex elevation) committed · **Φ3a (roof + floor-finish) + Φ4(hide-gizmo) ΥΛΟΠΟΙΗΘΗΚΑΝ αυτή τη συνεδρία (UNCOMMITTED, 167/167 jest GREEN)** — περιμένει browser-verify + commit από τον Giorgio.

---

## 0. ⚠️ ΔΙΑΒΑΣΕ ΠΡΩΤΑ — ΑΠΑΡΑΒΑΤΟΙ ΚΑΝΟΝΕΣ

1. **SHARED WORKING TREE** — δουλεύει **ΚΑΙ άλλος agent** (ADR-534 BOQ/beam-flange). Τρέξε `git status` στην αρχή.
   **ΜΗΝ** αγγίξεις/κάνεις stage αρχεία που δεν είναι δικά σου. **COMMIT ΤΟΝ ΚΑΝΕΙ Ο GIORGIO — ΕΣΥ ΠΟΤΕ**
   (όχι `git add`, όχι commit, όχι push — N.(-1)). _Σημείωση: στο τρέχον tree ΠΟΛΛΑ αρχεία είναι ήδη staged
   από άλλον (incl. ADR-534) — μην το πειράξεις._
2. **FULL ENTERPRISE + FULL SSOT (εντολή Giorgio, «όπως η Revit»):**
   **ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT με grep.** Ξανα-grep ΚΑΘΕ symbol/path
   παρακάτω (shared tree, μπορεί να άλλαξε). Αν υπάρχει ήδη κεντρικά → reuse, ΜΗΔΕΝ διπλότυπα.
   Zero `any`/`as any`/`@ts-ignore` (N.2)· functions ≤40 γρ., files ≤500 γρ. (N.7.1)· zero hardcoded strings — i18n keys ΠΡΙΝ τον κώδικα (N.11).
3. **tsc: ΕΝΑΣ τη φορά (N.17)** — έλεγξε για running tsc ΠΡΙΝ. **Προσοχή: full-project `tsc --noEmit` κάνει OOM (exit 134) σε αυτό το μηχάνημα** — το ts-jest κάνει full type-check, οπότε **προτίμησε colocated jest + στατική επαλήθευση** (έτσι έγινε το Φ3a).
4. **Απάντα στον Giorgio ΣΤΑ ΕΛΛΗΝΙΚΑ** (language rule).
5. **ADR-040 / CHECK 6B/6D:** αγγίζεις bim-3d edit αρχεία → στο commit ο Giorgio κάνει **stage ADR-535 + ADR-040**.

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ ΣΤΟ Φ3a (UNCOMMITTED — μην το ξαναφτιάξεις)

**Γενίκευση σε roof + floor-finish (πλήρης SSoT reuse):**
- `grip-3d-reshape-grips.ts`: `reshapeGripsForSlab` → **`reshapeGripsForFootprint`** (κρατά ΚΑΘΕ footprint `*GripKind`: slab/roof/floorFinish/slabOpening, `!movesEntity`). **ΗΔΗ περιλαμβάνει slabOpening** — έτοιμο για Φ3b.
- `grip-3d-commit.ts`: `toUnifiedGrip` προωθεί 1:1 `roofGripKind`/`floorFinishGripKind`/`slabOpeningGripKind` → `commitDxfGripDragModeAware` (ήδη type-agnostic). **slabOpening ΗΔΗ προωθείται** — Φ3b commit έτοιμο.
- **ΝΕΟ `bim-3d/animation/bim3d-grip-preview-builders.ts`** (N.7.1 split· ο slab builder μεταφέρθηκε εδώ από `bim3d-preview-rebuild.ts` 475→448): `buildSlabReshapePreviewObject` / `buildRoofReshapePreviewObject` / `buildFloorFinishReshapePreviewObject`. **ΕΔΩ μπαίνει ο `buildSlabOpeningReshapePreviewObject` του Φ3b** (σιblings).
- `bim3d-grip-drag.ts`: `RESHAPE_BIM_TYPES = {slab,roof,floor-finish}` (πρόσθεσε `'slab-opening'` στο Φ3b)· `gripElevationMmFor` dispatch (slab→`slabTopZmmAt`, roof→`roofZmm`, ff→flat)· `applyGripReshapePreview`→`buildGripReshapePreview` dispatch ανά gripKind (πρόσθεσε `slabOpeningGripKind` branch στο Φ3b).
- `bim3d-edit-interaction-handlers.ts`: grip pointerdown→`ctx.overlay.setVisible(false)` (Φ4 hide-gizmo)· up/cancel→`setVisible(true)`· capture/snap wiring **ήδη type-agnostic** (`entityId`).
- Tests: `grip-3d-reshape-grips.test.ts` (+roof/ff/slab-opening), `grip-3d-commit.test.ts` (+roof/ff forward), **ΝΕΟ** `bim3d-grip-preview-builders.test.ts` (headline «ghost===commit»).

---

## 2. SSoT AUDIT (έγινε 2026-06-26 — ΞΑΝΑ-grep ΠΡΙΝ τα χρησιμοποιήσεις)

### 2.1 Φ3b — slab-opening (host-slab rebuild) — building blocks ΕΠΑΛΗΘΕΥΜΕΝΑ
| Ανάγκη | Υπάρχον SSoT (path:γρ.) | Reuse; |
|---|---|---|
| grips (pure) | `bim/slab-openings/slab-opening-grips.ts` `getSlabOpeningGrips` / `applySlabOpeningGripDrag` | ❌ reuse |
| commit adapter | `hooks/grips/grip-parametric-footprint-commits.ts:140` `commitSlabOpeningGripDrag` | ❌ reuse (μέσω `commitDxfGripDragModeAware`, ήδη wired) |
| geometry | `bim/geometry/slab-opening-geometry.ts:39` `computeSlabOpeningGeometry(params,...)` | ❌ reuse |
| host slab mesh | `bim-3d/converters/bim-three-slab-converter.ts:105` `slabToMesh(slab, openings[], levelId, baseM, floorMm)` → `pushHoles(shape, openings, sceneToM)` (γρ.128) | ❌ reuse |
| host opening filter | `bim-3d/scene/bim-scene-hosted-opening-filters.ts:42` `filterHostedSlabOpenings(slabOpenings, slabId, mode, ctx)` | ❌ reuse |
| ΠΡΟΤΥΠΟ (wall analogue) | `bim3d-preview-rebuild.ts:207` **`buildOpeningHostWallPreview(wallId, movedOpeningId, movedParams)`** — rebuild host wall με τη μετακινημένη τρύπα | ⚠️ mirror για slab |
| per-vertex elevation | grip κάθεται στο **host slab top** → reuse `slabGripElevationMmFor(hostSlabId)` (στο `bim3d-grip-drag.ts`) | ❌ reuse |

### 2.2 🔴 Φ3b — Ο ΠΡΑΓΜΑΤΙΚΟΣ BLOCKER (Risk #1 — λύσε ΠΡΩΤΑ)
**Το slab-opening ΔΕΝ έχει δικό mesh** (= τρύπα μέσα στην πλάκα· `slabToMesh` την κόβει με `pushHoles`).
Grep επιβεβαίωσε: **καμία** εγγραφή `userData['bimType']='slab-opening'` / tag / raycast target στο `bim-3d/`.
→ **Δεν μπορείς να επιλέξεις slab-opening στην 3D σήμερα** → χωρίς selection, δεν εμφανίζονται grips.
**Πρέπει πρώτα** να γίνει το slab-opening single-selectable στην 3D (π.χ. αόρατο pickable mesh στο
περίγραμμα της τρύπας, tagged `bimType='slab-opening'` + `bimId`, ώστε το selection να θέσει
`editBimType='slab-opening'`· mirror του πώς γίνονται tag roof/floor-finish: `tagMesh(...,'floor-finish',...)`,
`roof userData['bimType']='roof'`). **Αυτό κάνει το Φ3b αρκετά μεγαλύτερο από το Φ3a.**

### 2.3 Φ3b — δεύτερο σημείο προσοχής (Risk #2): capture στόχος = HOST slab, όχι το opening
Στο `bim3d-edit-interaction-handlers.ts` pointerdown, το `captureResize(group, entityId)` παίρνει
`editEntityIds[0]` = το **opening id**. Αλλά το mesh που αναμορφώνεται live είναι το **host slab**.
→ Για slab-opening: κάνε capture του **host slab id** (`opening.params.slabId`), όχι του opening.
Πρόσθεσε branch στο pointerdown: αν `editBimType==='slab-opening'` → `hostId = lookup opening.params.slabId`,
`captureResize(group, hostId)`. (Ο snap `buildGripReshapeSnapFn(ctx, entityId)` μένει με το opening id για self-exclude.)

### 2.4 Φ4 — context-menu κορυφής (διαγραφή/εισαγωγή) — building blocks ΕΠΑΛΗΘΕΥΜΕΝΑ
| Ανάγκη | Υπάρχον SSoT | Reuse; |
|---|---|---|
| **Λογική delete/insert (ΠΡΟΤΥΠΟ 2D)** | `hooks/grips/useGripContextMenuController.ts:180` **`onSlabVertexOp(grip, 'delete-corner'\|'add-corner')`** — delete=`removeVertexFrom*`, add=`apply*GripDrag(edge-midpoint, delta:0)`, μέσω `createLevelSceneManagerAdapter` + `Update*ParamsCommand` + `getGlobalCommandHistory().execute` | ⚠️ reuse ΛΟΓΙΚΗ (όχι το DOM) |
| removeVertex | `removeVertexFromSlab` (slab-grips.ts:176) · `removeVertexFromRoof` (roof-grips.ts:195) | ❌ reuse |
| ⚠️ ΛΕΙΠΟΥΝ | **`removeVertexFromFloorFinish`** + **`removeVertexFromSlabOpening`** ΔΕΝ ΥΠΑΡΧΟΥΝ | ➕ ΝΕΑ (mirror removeVertexFromSlab — guard `≤3` + filter outline.vertices) |
| 3D context-menu UI (ΠΡΟΤΥΠΟ) | `bim-3d/viewport/view-cube/view-cube-context-menu.tsx` (invisible 1×1 anchor στο right-click + portal) | ⚠️ mirror για entity vertex menu |
| right-click→grip κάτω από cursor | `bim-grip-controller-3d.ts` (πρόσθεσε `gripAt(camera,dom,x,y)` raycast — reuse `testGrip3DHit` + `gripByIndex`) | ⚠️ thin νέο |
| i18n | keys σε `src/i18n/locales/el/*.json` + `en/*.json` ΠΡΙΝ τον κώδικα (π.χ. `grips3d.deleteVertex`, `grips3d.insertVertex`) | ➕ ΝΕΑ keys |

### 2.5 Φ4 — edit-mode toggle «Επεξεργασία σκίτσου»
Grep: **ΔΕΝ υπάρχει** existing toggle (`editSketch`/`sketchMode`/«Επεξεργασία σκίτσου» → 0 hits).
**Χαμηλή προτεραιότητα** — οι grips ήδη εμφανίζονται αυτόματα στο selection (δεν χρειάζεται toggle για να δουλέψουν).
Κάν' το ΤΕΛΕΥΤΑΙΟ ή παράλειψέ το αν ο Giorgio δεν το ζητήσει ρητά· εστίασε σε Φ3b + context-menu.

---

## 3. ΣΧΕΔΙΟ ΥΛΟΠΟΙΗΣΗΣ (φασικό, colocated jest ανά βήμα)

### Φ3b — slab-opening (3 βήματα)
1. **Selection πρώτα (blocker §2.2):** κάνε slab-opening single-selectable στην 3D (αόρατο pickable mesh στο
   περίγραμμα τρύπας, tagged `bimType='slab-opening'`+`bimId`). Επιβεβαίωσε ότι το selection θέτει `editBimType='slab-opening'`.
2. **Builder** `buildSlabOpeningReshapePreviewObject(openingId, gripKind, deltaMm)` στο `bim3d-grip-preview-builders.ts`
   (mirror `buildOpeningHostWallPreview`): βρες opening → host slab (`opening.params.slabId`) →
   `applySlabOpeningGripDrag` → moved params → `computeSlabOpeningGeometry(moved)` → `slabToMesh(hostSlab, [...other, {...opening, params:moved, geometry}], levelId, baseM)`. Multi-floor guard → null. **headline test «ghost===commit»** (rebuild host slab με moved hole === commit re-sync).
3. **Wiring:** `RESHAPE_BIM_TYPES += 'slab-opening'`· elevation = `slabGripElevationMmFor(hostSlabId)`·
   `buildGripReshapePreview` += `slabOpeningGripKind` branch· pointerdown capture = **host slab id** (§2.3).

### Φ4 — context-menu κορυφής (το μεγάλο κομμάτι)
1. i18n keys (el+en) ΠΡΩΤΑ.
2. `bim-grip-controller-3d.ts`: `gripAt(...)` (raycast → GripInfo κάτω από cursor, χωρίς drag).
3. ΝΕΟ 3D context-menu (mirror `view-cube-context-menu.tsx`): δεξί κλικ σε grip → menu «Διαγραφή κορυφής» (vertex grip) / «Εισαγωγή κορυφής» (edge-midpoint grip).
4. Dispatch: **reuse τη λογική του `onSlabVertexOp`** (delete=`removeVertexFrom*`, add=`apply*GripDrag` delta:0, μέσω adapter + `Update*ParamsCommand` + global history). Πρόσθεσε `removeVertexFromFloorFinish`/`removeVertexFromSlabOpening` (mirror). Δούλεψε για slab/roof/floor-finish (+slab-opening αν Φ3b έτοιμο).
5. (προαιρετικό, τελευταίο) edit-mode toggle.

---

## 4. TESTING (Google presubmit-grade, colocated jest)
- `buildSlabOpeningReshapePreviewObject` — headline «ghost===commit» (host slab rebuild με moved hole === `applySlabOpeningGripDrag`+`computeSlabOpeningGeometry`+`slabToMesh`)· no-op/unknown/multi-floor → null.
- `removeVertexFromFloorFinish`/`removeVertexFromSlabOpening` — αφαιρεί σωστή κορυφή· guard `≤3` → identity.
- context-menu dispatch — delete-corner → `removeVertexFrom*`+command· add-corner → `apply*GripDrag(delta:0)`+command (mock adapter/history).
- Τρέξε `npx jest "src/subapps/dxf-viewer/bim-3d/grips" "src/subapps/dxf-viewer/bim-3d/animation/__tests__"` (baseline 167 GREEN).

## 5. ΡΙΣΚΑ (σύνοψη)
1. 🔴 **slab-opening δεν επιλέγεται στην 3D** (no mesh) → selection πρώτα (§2.2). Ο μεγαλύτερος κίνδυνος.
2. **capture = host slab, όχι opening** (§2.3).
3. **removeVertexFromFloorFinish/SlabOpening λείπουν** → φτιάξ' τα (mirror).
4. **slab-opening↔host slab z**: grip κάθεται στο host slab top (όχι δικό υψόμετρο).
5. **N.11**: i18n keys ΠΡΙΝ τον κώδικα για το context-menu.

## 6. ΠΗΓΕΣ ΑΛΗΘΕΙΑΣ
- ADR: `docs/centralized-systems/reference/adrs/ADR-535-3d-viewport-entity-grips.md` (§3 πίνακας φάσεων, §4.4 gizmo↔grips, changelog 2026-06-26 Φ3a).
- Memory: `reference_3d_viewport_entity_grips.md` (Φ3a entry).
- Πρότυπα: `buildOpeningHostWallPreview` (host rebuild) · `onSlabVertexOp` (delete/insert λογική) · `view-cube-context-menu.tsx` (3D menu UI) · Φ3a builders (sibling pattern).
