# HANDOFF — ADR-535 Φ2: Live reshape preview + snap για τις 3D λαβές πλάκας

**Date:** 2026-06-26 · **ADR:** ADR-535 (`docs/centralized-systems/reference/adrs/ADR-535-3d-viewport-entity-grips.md`)
**Προηγούμενο:** Φ1 (3D grips εμφάνιση + hit-test + commit-on-release) **COMMITTED** ✅ · visual tweaks (solid cube) **UNCOMMITTED**

---

## 0. ⚠️ ΔΙΑΒΑΣΕ ΠΡΩΤΑ — ΚΑΝΟΝΕΣ ΑΥΤΗΣ ΤΗΣ ΔΟΥΛΕΙΑΣ

1. **SHARED WORKING TREE** — δουλεύει **ΚΑΙ άλλος agent ταυτόχρονα** στο ίδιο repo.
   - Τρέξε `git status` ΣΤΗΝ ΑΡΧΗ. ΜΗΝ αγγίξεις/κάνεις stage αρχεία που δεν είναι δικά σου.
   - **COMMIT ΤΟΝ ΚΑΝΕΙ Ο GIORGIO** — ΕΣΥ ΠΟΤΕ (N.(-1)). Όχι `git add -A`, όχι commit, όχι push.
   - tsc: **ΕΝΑΣ τη φορά** (N.17) — έλεγξε για running tsc ΠΡΙΝ ξεκινήσεις. Προτίμησε colocated jest.
2. **FULL ENTERPRISE + FULL SSOT** (εντολή Giorgio, «όπως η Revit»):
   - **ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT με grep.** Μην εμπιστεύεσαι τυφλά
     αυτό το handoff — **επιβεβαίωσε** ότι τα symbols/paths παρακάτω υπάρχουν ακόμα (shared tree, μπορεί
     να άλλαξαν). Grep ΚΑΘΕ reuse target ΠΡΙΝ το χρησιμοποιήσεις. ΜΗΔΕΝ διπλότυπα.
   - Αν βρεις ότι κάτι υπάρχει ήδη κεντρικά → χρήσε το, μην ξαναγράψεις.
   - Zero `any`/`as any`/`@ts-ignore` (N.2)· functions ≤40 γρ., files ≤500 γρ. (N.7.1)· zero hardcoded strings (N.11).
3. **Απάντα στον Giorgio ΣΤΑ ΕΛΛΗΝΙΚΑ** (language rule).

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (Φ1) — μην το ξαναφτιάξεις

**Φ1 = COMMITTED** (ο Giorgio έκανε commit). Νέα αρχεία σε `src/subapps/dxf-viewer/bim-3d/grips/`:

| Αρχείο | Ρόλος |
|---|---|
| `grip-plane-projection.ts` | PURE: ray ∩ οριζόντιο επίπεδο(slab-top) → plan-mm delta (`intersectRayHorizontalPlane`, `planDeltaMm`) |
| `grip-3d-reshape-grips.ts` | PURE φίλτρο `reshapeGripsForSlab(grips)` → κρατά slab vertex/midpoint reshape grips |
| `grip-3d-hit-test.ts` | `testGrip3DHit(raycaster, hitboxes, map)` → nearest gripIndex |
| `grip-mesh-factory-3d.ts` | `createGrip3DMeshes(grips, planeWorldY)` → solid cubes + hitboxes (`dxfPlanToWorld` SSoT) |
| `bim-grip-overlay-3d.ts` | `BimGripOverlay3D` scene leaf: screen-constant scale, hover, show/hide, `moveGrip` (zero store/React, ADR-040) |
| `bim-grip-controller-3d.ts` | `BimGripController3D` FSM hover→drag→idle, 1:1 cursor follow, `endDrag()→{grip, deltaMm}` |
| `grip-3d-commit.ts` | `commitGrip3DReshape(grip, deltaMm, levels, levelId)` → `commitDxfGripDragModeAware`→`commitSlabGripDrag` |

**Wiring (committed):**
- `bim-3d/animation/use-bim3d-edit-interaction.ts` — mount overlay+controller, `refreshReshapeGrips` σε
  selection (`applyActiveState`) + auto-resync (`unsubEntities`), dispose. ctx fields: `gripOverlay`, `gripController`.
- `bim-3d/animation/bim3d-edit-interaction-handlers.ts` — **grip-first** hit-test στο `onEditPointerDown`·
  grip path σε `onEditPointerMove`/`Up`/`Cancel`/`Wheel`· `refreshReshapeGrips` (export)· `commitGripReshape` (helper).

**Tests (committed):** `bim-3d/grips/__tests__/` — 4 suites / 14 tests GREEN (projection, filter, factory, commit).

**Λυμένα ρίσκα Φ1:**
- **Risk #1:** `buildDeps.execute` ΕΙΝΑΙ no-op (το gizmo path τρέχει `getGlobalCommandHistory().execute` μόνο του)
  → στο `grip-3d-commit.ts` κάνω override του `execute` με real history dispatcher. **ΜΗΝ το χαλάσεις.**
- **Διπλό-emit:** το `commitSlabGripDrag` ΗΔΗ κάνει `emitBimEntityParamsUpdated('slab')` → ΔΕΝ καλώ
  `emitStructuralChangeAfterEdit` (θα ήταν double-announce). Κράτα το έτσι.

### ⚠️ UNCOMMITTED visual tweaks (ο Giorgio θα τα κάνει commit — ΜΗΝ τα πειράξεις)
`grip-mesh-factory-3d.ts` + `bim-grip-overlay-3d.ts`: λαβές = **solid 3D κύβος** (όχι flat square),
**λεπτό μαύρο** περίγραμμα, **self-occlusion** (depthTest+depthWrite+polygonOffset, μόνο ορατές ακμές),
κύβος **πατάει** στην επιφάνεια (children lift +½ side). Ίσως είναι ήδη committed όταν ξεκινήσεις → `git log`.

---

## 2. ΤΙ ΘΑ ΚΑΝΕΙΣ — Φ2: Live reshape preview + Snap

**Πρόβλημα:** τώρα η πλάκα αναμορφώνεται **μόνο στο release** (commit-on-release). Όση ώρα σέρνεις βλέπεις
μόνο τον κύβο να κινείται· η πλάκα μένει στατική. Revit/enterprise = **ζωντανή** αναμόρφωση + **μαγνήτης**.

### Φ2a — Live reshape (η πλάκα ξαναχτίζεται ανά frame)
### Φ2b — Snap (η κορυφή κουμπώνει σε κοντινά χαρακτηριστικά)
### Bonus — Shift → rectilinear (ορθογώνιος περιορισμός)

---

## 3. SSoT AUDIT (έγινε 2026-06-26) — ΤΑ BUILDING BLOCKS ΥΠΑΡΧΟΥΝ ΗΔΗ

> ⚠️ ΞΑΝΑ-grep ΟΛΑ τα παρακάτω ΠΡΙΝ τα χρησιμοποιήσεις (shared tree).

### 3.1 Ο μηχανισμός live-preview (ΗΔΗ έτοιμος, τον χρησιμοποιεί το gizmo)
`bim-3d/animation/bim3d-edit-live-preview.ts` — class **`Bim3DEditLivePreview`**:
- `captureResize(group, entityId)` — κρατά το mesh της οντότητας (καλείται στο pointerdown).
- `applyResize(rebuilt: THREE.Object3D | null)` — **swap ανά frame** του rebuilt object (καλείται στο move).
- `commit()` — drop refs (το command re-sync αντικαθιστά τα meshes)· `reset()` — restore (no-op drag/cancel).

### 3.2 Ο builder pattern (converter SSoT) — ΤΟ ΠΡΟΤΥΠΟ ΓΙΑ ΤΟΝ ΝΕΟ BUILDER
`bim-3d/animation/bim3d-preview-rebuild.ts:423` — **`rebuildSlab`** (live resize preview):
```ts
function rebuildSlab(slab, drag, s, levelId): THREE.Object3D | null {
  const next = computeSlabResizeParams(slab.params, drag);   // ← ΓΙΑ GRIP: applySlabGripDrag(...)
  if (!next) return null;
  const preview = { ...slab, params: next };
  const openings = s.slabOpenings.filter((o) => o.params.slabId === slab.id);
  return slabToMesh(preview, openings, levelId, baseElevationOf(slab, s)); // converter SSoT
}
```
**Ο νέος builder = αντιγραφή αυτού, με ΜΟΝΗ αλλαγή το param-transform:**
`computeSlabResizeParams(slab.params, drag)` → `applySlabGripDrag(gripKind, { originalParams: slab.params, delta: deltaMm, rectilinear })`.
Τα υπόλοιπα (`slabToMesh`, openings filter, `baseElevationOf`, multi-floor guard `floor3DScope==='all'→null`) **reuse αυτούσια**.

- `applySlabGripDrag` → `bim/slabs/slab-grips.ts` (PURE, ήδη το καλεί το `commitSlabGripDrag`).
- `slabToMesh` → `bim-3d/converters/BimToThreeConverter.ts`.
- `baseElevationOf(slab, s)` + `Snapshot` type → **internal** στο `bim3d-preview-rebuild.ts`.
  → **ΠΡΟΤΕΙΝΟΜΕΝΟ:** βάλε τον νέο builder ΜΕΣΑ στο `bim3d-preview-rebuild.ts` (reuse internals,
  zero export churn)· έλεγξε file-size (≈445 γρ. τώρα, +~15 γρ. ok < 500, N.7.1). ΜΗΝ φτιάξεις νέο
  αρχείο αν θα διπλασιάσεις `baseElevationOf`/snapshot logic (SSoT). ADR-535 §4.2 πρότεινε
  `bim3d-grip-preview-rebuild.ts` — προτίμησε colocate ΕΚΤΟΣ αν περάσει το 500 (τότε export `baseElevationOf`).

### 3.3 Snap (ΗΔΗ έτοιμο, το χρησιμοποιεί το gizmo)
`bim-3d/animation/bim3d-edit-interaction-handlers.ts` — `buildDragSnapFn` δείχνει το pattern:
- `getGlobalSnapEngine()` (`snapping/global-snap-engine`) — ο ΕΝΑΣ snap engine.
- `makeResizeSnapFn(engine, entityId)` (`bim-3d/gizmo/bim3d-snap-bridge`) — snap ΕΝΟΣ control point (= η κορυφή).
- `syncSnapEngineViewportFor3D(ctx, engine)` — δίνει 3D-derived pixel tolerance (αλλιώς «δεν κολλάει», stale 2D).
- Πρότυπο εφαρμογής snap: `bim-3d/gizmo/bim-gizmo-drag-bridge.ts` → `applySnap()` (snap το ΑΠΟΛΥΤΟ σημείο,
  ξανα-υπολόγισε το delta· κράτα το elevation). **Ο grip controller πρέπει να κάνει το ίδιο**: μετά το
  `intersectRayHorizontalPlane`, πέρνα το `worldToDxfPlan(cur)` μέσα από τον snapFn, διόρθωσε το σημείο,
  ξανα-υπολόγισε `deltaMm`.

### 3.4 Shift → rectilinear
Το `applySlabGripDrag(gripKind, { ..., rectilinear })` **ΗΔΗ δέχεται** `rectilinear` (ortho constrain).
Πέρνα `e.shiftKey`. ⚠️ Το `commitSlabGripDrag` διαβάζει `ShiftKeyTracker.getSnapshot()` στο commit —
βεβαιώσου ότι το preview ΚΑΙ το commit συμφωνούν (ίδια πηγή Shift) → preview === commit.

---

## 4. ΣΧΕΔΙΟ ΥΛΟΠΟΙΗΣΗΣ (φασικό, μικρά βήματα)

1. **Builder** `buildSlabReshapePreviewObject(entityId, gripKind, deltaMm, rectilinear)` (mirror `rebuildSlab`).
   - Test colocated: applySlabGripDrag → νέα params → object χτίζεται (γνωστή πλάκα).
2. **Controller** (`bim-grip-controller-3d.ts`): πρόσθεσε snap στο `updateDrag` (inject `snapFn` σαν το gizmo)
   + κράτα `rectilinear`/shift. Το `endDrag()` ήδη γυρίζει `deltaMm` — με snap εφαρμοσμένο.
3. **Wiring** (`bim3d-edit-interaction-handlers.ts`):
   - `onEditPointerDown` grip branch: `ctx.preview.captureResize(group, entityId)` (capture το slab mesh)
     + χτίσε τον `snapFn` (`makeResizeSnapFn` + `syncSnapEngineViewportFor3D`) και δώσ' τον στον `gripController`.
   - `onEditPointerMove` grip branch: ανά frame `ctx.preview.applyResize(buildSlabReshapePreviewObject(...))`
     (αντί απλά `moveGrip`). Ο κύβος-λαβή ακολουθεί ΚΑΙ η πλάκα αναμορφώνεται live.
   - `onEditPointerUp` grip branch: μετά το commit → `ctx.preview.commit()` (το re-sync αντικαθιστά)·
     no-op/zero-delta → `ctx.preview.reset()`. (Σήμερα καλεί μόνο `refreshReshapeGrips`.)
   - `onEditPointerCancel` grip branch: `ctx.preview.reset()`.
4. **Tests:** colocated jest (builder + snap-applied delta). Στόχος ≥ Φ1 coverage.

### Ανοιχτά σημεία (verify στην υλοποίηση)
- **Elevation:** Φ1/Φ2 = ΕΝΑ επίπεδο (slab top, `box.max.y`). Per-vertex z (λοξή πλάκα) → εκτός Φ2 scope.
- **Multi-floor:** `floor3DScope==='all'` → ο `rebuildSlab` γυρίζει null (commit-on-release). Κράτα ίδιο guard.
- **slabToMesh αργό;** αν το per-frame rebuild τρώει FPS → throttle ή diff. Πρώτα μέτρα, μη βελτιστοποιείς τυφλά.
- **preview === commit:** το preview (`applySlabGripDrag`) ΠΡΕΠΕΙ να δίνει ίδιες params με το commit
  (ίδιο `gripKind`, ίδιο `deltaMm`, ίδιο `rectilinear`). Αυτή είναι η εγγύηση «ghost === result» (Revit).

---

## 5. ΣΥΜΜΟΡΦΩΣΗ (pre-commit / αρχιτεκτονική)
- **ADR-040 / CHECK 6B/6D:** αγγίζεις bim-3d edit αρχεία (`bim3d-edit-interaction-handlers.ts`,
  `bim3d-preview-rebuild.ts`, `bim3d-edit-live-preview*`) → **stage ADR-535 + ADR-040** στο commit.
  Ο grip overlay/controller παραμένουν pure-THREE leaves (zero store sub).
- **N.7.1:** functions ≤40, files ≤500 (πρόσεξε `bim3d-preview-rebuild.ts` & handlers).
- **N.17:** ΕΝΑ tsc τη φορά. Προτίμηση colocated jest.
- **ADR changelog:** πρόσθεσε εγγραφή Φ2 στο ADR-535 + ενημέρωσε τον πίνακα φάσεων (Φ2 → DONE).

---

## 6. ΑΡΧΕΙΑ ΠΟΥ ΘΑ ΑΓΓΙΞΕΙΣ (πιθανή σύγκρουση με άλλον agent)
- `bim-3d/animation/bim3d-preview-rebuild.ts` (νέος builder) ⚠️ shared
- `bim-3d/animation/bim3d-edit-interaction-handlers.ts` (wiring) ⚠️ shared (committed Φ1 + ίσως άλλος agent)
- `bim-3d/grips/bim-grip-controller-3d.ts` (snap) — δικό μας
- (ίσως) `bim-3d/animation/bim3d-edit-live-preview-apply.ts` — αν χρειαστεί grip branch στο `applyLivePreview`

**Πάντα `git status` + `git diff` ΠΡΙΝ αγγίξεις shared αρχείο. ΜΗΝ κάνεις commit — ο Giorgio committαρει.**

---

## 7. ΠΗΓΕΣ ΑΛΗΘΕΙΑΣ
- ADR: `docs/centralized-systems/reference/adrs/ADR-535-3d-viewport-entity-grips.md` (διάβασέ το ΟΛΟ — §4.1 ροή
  συντεταγμένων, §5 πίνακας SSoT reuse, §6 ρίσκα, §7 testing).
- Memory: `reference_3d_viewport_entity_grips.md`.
