# HANDOFF — ADR-544: Ενιαία σχεδίαση κολώνας 2D ↔ 3D (full implementation)

**Date:** 2026-06-27 · **Model:** Opus (orchestrator-tier, N.8) · **Status:** READY TO IMPLEMENT (Φ1-Φ4)
**ADR:** `docs/centralized-systems/reference/adrs/ADR-544-unified-column-drawing-2d-3d-ssot.md` ← **ΔΙΑΒΑΣΕ ΤΟ ΠΡΩΤΟ**

---

## 0. Κανόνες αυτής της δουλειάς (NON-NEGOTIABLE)

- **COMMIT = ο Giorgio, ΟΧΙ εσύ** (N.(-1)). Ετοίμασε, σταμάτα, ανέφερε. Μηδέν `git commit`/`push`.
- **⚠️ SHARED WORKING TREE** — δουλεύει **άλλος agent ταυτόχρονα** (ADR-543 τοίχοι, ίδιο pattern, αγγίζει
  ΚΑΠΟΙΑ ΚΟΙΝΑ αρχεία: `PreviewRenderer.ts`, paint helpers, `BimViewport3D.tsx`). **Άγγιζε ΜΟΝΟ ό,τι χρειάζεται,
  ελάχιστα diffs, μην κάνεις mass-reformat, μην πειράξεις άσχετα.** Πριν edit ένα κοινό αρχείο → `git status`/
  `git diff` για να δεις αν το άλλαξε ο άλλος. **Ένα tsc τη φορά (N.17)** — έλεγξε διεργασία πριν.
- **Full enterprise + full SSoT, Revit/Maxon (Cinema 4D) grade.** Μηδέν `any`/`as any`/`@ts-ignore` (N.2),
  μηδέν inline styles, semantic HTML, i18n keys ΟΧΙ hardcoded strings (N.11), αρχεία ≤500 γρ / functions ≤40 γρ (N.7.1).
- **ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ → ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (grep).** Δες §2. Reuse ό,τι υπάρχει· **μην** φτιάξεις διπλότυπο.
- **ADR-driven (N.0.1):** code = source of truth. Αν ο κώδικας διαφέρει από το ADR-544 → διόρθωσε **πρώτα** το ADR,
  μετά υλοποίησε, μετά ξανα-ενημέρωσε changelog. Stage ADR-040 + ADR-544 (CHECK 6B/6D).

---

## 1. Στόχος (μία πρόταση)

Να σχεδιάζεται **κολώνα απευθείας στον 3D καμβά** με **ΤΟΝ ΙΔΙΟ ΑΚΡΙΒΩΣ paint-κώδικα** του 2D (μαγνητικά
πλέγματα, δυναμικές διαστάσεις, γραμμές-οδηγοί, ίχνη ευθυγράμμισης) — **μία πηγή αλήθειας, μηδέν διπλότυπα**.

**Τι ΗΔΗ δουλεύει (μην το ξαναφτιάξεις):** το κλικ/FSM, οι builders, η snap-engine, το commit/undo και το
snap-glyph είναι **ήδη κοινά** 2D↔3D (`useColumnTool` + EventBus `bim:place-column-3d` + `ColumnPlacementGhost`
+ `BimSnapIndicatorOverlay3D`). **Το κενό** = πλέγμα/διαστάσεις/οδηγοί/ίχνη ζωγραφίζονται **μόνο 2D**.

**Root cause:** οι `*-paint` δέχονται `(ctx, data, transform, viewport)` και κάνουν προβολή hard-coded με
`CoordinateTransforms.worldToScreen`. Το 3D θέλει `makeGripPlanToCanvas(camera, canvas, elevFor)`.

**Λύση SSoT:** projector abstraction → ο ίδιος painter, δύο projectors, δύο καμβάδες. (Ίδιο pattern με ADR-542/535.)

---

## 2. ⚠️ ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT — ΤΡΕΞΕ ΑΥΤΑ ΤΑ GREP ΠΡΙΝ ΓΡΑΨΕΙΣ ΟΤΙΔΗΠΟΤΕ

Σκοπός: να επιβεβαιώσεις ότι **δεν υπάρχει ήδη** projector-type / 3D placement overlay / 3D meta store, ώστε να
τα **reuse-άρεις** αντί να φτιάξεις διπλότυπο. Κατέγραψε τα ευρήματα ΠΡΙΝ προχωρήσεις.

```bash
# A) Υπάρχει ήδη projector abstraction / τύπος "world→screen callback" στα overlays;
grep -rn "OverlayProjector\|toScreen\|=> CoordinateTransforms.worldToScreen\|project:.*Point2D" src/subapps/dxf-viewer/canvas-v2/preview-canvas/
grep -rn "WorldToScreen\|PlanToScreen\|ProjectFn\|Projector" src/subapps/dxf-viewer/

# B) Υπάρχει ήδη 3D placement overlay (πλέγμα/διαστάσεις) ή store gi' αυτό;
grep -rn "PlacementOverlay\|Placement3DOverlay\|BimPlacementOverlay" src/subapps/dxf-viewer/
grep -rln "assemblePlacementGhost\|generateColumnPreview\|buildPlacementGridMeta" src/subapps/dxf-viewer/bim-3d/

# C) Πώς ζωγραφίζουν ήδη τα 3D overlays (reuse pattern) — RAF, occlusion, camera-gate, projector;
grep -rn "makeGripPlanToCanvas\|GripDepthOccluder\|useRafWhile\|useCameraMotionGate\|GRIP_OFFSCREEN" src/subapps/dxf-viewer/bim-3d/
grep -rn "overlay-raf\|Snap3DOverlayStore\|Grip3DOverlayStore" src/subapps/dxf-viewer/bim-3d/

# D) Πού γίνονται mount τα 3D overlays (για το νέο BimPlacementOverlay2D);
grep -n "Overlay2D\|Overlay3D\|SnapIndicatorOverlay3D\|GripOverlay2D" src/subapps/dxf-viewer/bim-3d/viewport/BimViewport3D.tsx

# E) Υπογραφές ΟΛΩΝ των paint helpers που θα αλλάξουν (επιβεβαίωσε ότι όλες είναι (ctx,data,transform,viewport));
grep -rn "export function paint" src/subapps/dxf-viewer/canvas-v2/preview-canvas/

# F) Όλοι οι callers των paint helpers (ποιος τους καλεί → ποιον πρέπει να αλλάξεις);
grep -rn "paintPolarDisk\|paintRectGrid\|paintGhostFaceDimensions\|paintAlignmentGuide\|paintAlignmentPaths\|paintTrackingMarkers\|paintIntersections\|paintTooltip" src/subapps/dxf-viewer/

# G) Υπάρχει ήδη helper "worldToScreen-from-transform" closure (να μην ξαναγράψεις);
grep -rn "worldToScreen" src/subapps/dxf-viewer/rendering/core/CoordinateTransforms*
```

**Decision rule:** αν κάτι από A/B/C υπάρχει ήδη → **reuse**. Αν όχι → φτιάξ' το **κεντρικά** (ΕΝΑ αρχείο/τύπος),
πρόσθεσέ το στο `.ssot-registry.json` αν είναι νέο SSoT module, και τεκμηρίωσέ το στο ADR-544.

---

## 3. Roadmap (Φ1-Φ4) — ακριβή αρχεία & συναρτήσεις

### Φ1 — Projector seam (refactor, **μηδέν** αλλαγή 2D συμπεριφοράς)
- **NEW** `canvas-v2/preview-canvas/overlay-projector.ts`: `export type OverlayProjector = (p: Point2D) => Point2D | null;`
  (+ helper `fromTransform(transform, viewport): OverlayProjector` που τυλίγει `CoordinateTransforms.worldToScreen`).
- **Άλλαξε υπογραφές** (από `(ctx, data, transform, viewport)` → `(ctx, data, project: OverlayProjector)`):
  `polar-disk-paint.ts` (`paintPolarDisk`), `rect-grid-paint.ts` (`paintRectGrid`),
  `ghost-face-dim-paint.ts` (`paintGhostFaceDimensions`), `alignment-guide-paint.ts` (`paintAlignmentGuide`),
  `tracking-paint.ts` (`paintTrackingMarkers`/`paintAlignmentPaths`/`paintIntersections`/`paintTooltip`).
  ⚠️ Πρόσεξε τα helpers που χρειάζονται **και** `viewport` για clipping (π.χ. tracking paths που τραβούν ως τα όρια
  οθόνης) — κράτα ΚΑΙ ένα optional `bounds`/`viewport` αν χρειάζεται, μην το σπάσεις.
- **`PreviewRenderer.ts`**: στους ~12 `drawX` wrappers, χτίσε `const project = fromTransform(transform, viewport)`
  και πέρνα το. Συμπεριφορά 2D **ΙΔΙΑ**.
- **Jest (golden):** για κάθε painter, 2D `project` → **identical canvas calls** με πριν (mock ctx, σύγκρινε τις
  εντολές `moveTo/lineTo/arc/fillText`). Reuse υπάρχοντα test patterns στο `canvas-v2/preview-canvas/__tests__/`.

### Φ2 — 3D meta (το placement να παράγει το ΙΔΙΟ meta με 2D)
- **`bim-3d/placement/use-bim3d-column-placement.ts`**: στο `onMove`, εκτός από `ghost.update(...)`, **κάλεσε**
  `generateColumnPreview`/`assemblePlacementGhost` (ΙΔΙΟ SSoT με 2D) για να πάρεις `PolarDiskGrid`/`RectGrid`/
  `GhostFaceDimensionsMeta`/`PlacementAlignmentGuide`.
- **NEW** `bim-3d/stores/Placement3DOverlayStore.ts` (mirror `Snap3DOverlayStore`): low-freq publish του meta +
  `elevMm`. ADR-040: low-freq subscribe, high-freq imperative draw.

### Φ3 — 3D overlay (ο ίδιος painter, camera projector)
- **NEW** `bim-3d/viewport/placement/BimPlacementOverlay2D.tsx` (mirror **ακριβώς** `BimSnapIndicatorOverlay3D.tsx`):
  Canvas2D `pointer-events-none` πάνω από το WebGL· `useRafWhile(active, draw)`· `useCameraMotionGate`·
  `project = makeGripPlanToCanvas(camera, canvas, () => meta.elevMm)`· καλεί τους **ΙΔΙΟΥΣ** Φ1 painters·
  occlusion μέσω `GripDepthOccluder` (κρύψε ό,τι είναι πίσω από όγκο — «μόνο μπροστινά», όπως ADR-542).
- **Mount** στο `bim-3d/viewport/BimViewport3D.tsx` δίπλα στο `BimSnapIndicatorOverlay3D` (δες grep §2-D).

### Φ4 — Verify
- `npm run test:...` τα νέα/αλλαγμένα jest GREEN.
- **tsc** (N.17: ένα τη φορά, έλεγξε διεργασία πρώτα· background).
- **Browser-verify** `http://localhost:3000/dxf/viewer`: εργαλείο Στήλη → 3D → κίνηση/κλικ → πλέγμα + διαστάσεις +
  οδηγοί + ίχνη **ίδια εικόνα με 2D**· occlusion σωστό· μηδέν 60fps re-render (ADR-040).

---

## 4. Critical files (reference)
- 2D pipeline: `hooks/drawing/useColumnTool.ts`, `column-completion.ts`, `column-preview-helpers.ts`,
  `bim/placement/bim-cursor-snap.ts`, `bim/columns/column-face-snap.ts`
- Assembly/meta: `bim/placement/placement-ghost-assembly.ts`, `bim/placement/placement-grid-meta.ts`
- 2D paint (Φ1): `canvas-v2/preview-canvas/{polar-disk-paint,rect-grid-paint,ghost-face-dim-paint,alignment-guide-paint,tracking-paint}.ts` + `PreviewRenderer.ts`
- 3D ραφή: `bim-3d/placement/use-bim3d-column-placement.ts`, `bim-3d/viewport/snap/BimSnapIndicatorOverlay3D.tsx`,
  `bim-3d/grips/grip-3d-screen-project.ts`, `bim-3d/grips/grip-3d-depth-occluder.ts`,
  `bim-3d/viewport/coordinate-transforms.ts`, `bim-3d/viewport/overlay-raf.ts`, `bim-3d/viewport/BimViewport3D.tsx`

## 5. Όταν τελειώσεις
- Ενημέρωσε ADR-544 §8 changelog (τι υλοποιήθηκε, Φ1-Φ4 status).
- Ανέφερε στον Giorgio: τι έγινε, jest/tsc αποτέλεσμα, τι μένει για browser-verify, ποια αρχεία να κάνει stage.
- **ΜΗΝ** κάνεις commit. Πρότεινε στον Giorgio το set αρχείων + το ADR-040/544 για staging.
