# ADR-544 — Ενιαία πηγή αλήθειας σχεδίασης κολώνας 2D ↔ 3D (ένας κώδικας, δύο καμβάδες)

**Status:** ✅ IMPLEMENTED (Φ1-Φ3, UNCOMMITTED) — 🔴 browser-verify εκκρεμεί · ο projector seam + το 3D placement overlay υλοποιήθηκαν, ένας paint-κώδικας 2D↔3D · **Date:** 2026-06-27
**Type:** Architecture (DXF Viewer — column placement, 2D↔3D SSoT)
**Builds on:** ADR-398 (column placement snap §3.x) · ADR-514 (unified BIM cursor snap + `assemblePlacementGhost`) · ADR-403 (3D BIM element placement) · ADR-542 (3D snap markers — ίδιο 2D↔3D projection seam) · ADR-535 Φ5 (Canvas2D overlay projection πάνω από WebGL + occluder) · ADR-357 (object-snap tracking) · ADR-040 (micro-leaf subscriber)
**Related:** `makeGripPlanToCanvas` · `GripDepthOccluder` · `CoordinateTransforms.worldToScreen` · EventBus `bim:place-column-3d`
**Παράλληλο:** ADR-543 (ο αντίστοιχος ενιαίος **τοίχος** 2D↔3D — ίδια αρχιτεκτονική, παράλληλος πράκτορας)

---

## 1. Πρόβλημα / Ζητούμενο (Giorgio 2026-06-27)

Στον **2D** καμβά, με ενεργό το εργαλείο **Στήλη/κολώνα**, η τοποθέτηση έχει πλούσια συμπεριφορά: εμφανίζονται
**μαγνητικά πλέγματα** (πολικό/καρτεσιανό), **δυναμικές διαστάσεις** (dx/dy, R/θ, listening προς παρειές),
**σημάδια έλξης (OSNAP)**, **ίχνη/γραμμές ευθυγράμμισης**, και ακολουθείται **συγκεκριμένη ακολουθία κλικ**
μέχρι να ολοκληρωθεί η κολώνα. Στον **3D** καμβά υπάρχει μόνο φτωχό feedback.

**Ζητούμενο:** να σχεδιάζεται κολώνα **απευθείας στο 3D** με **ΤΟΝ ΙΔΙΟ ΑΚΡΙΒΩΣ κώδικα** του 2D — **μία και
μοναδική πηγή αλήθειας, μηδέν διάσπαρτος/διπλός κώδικας**. Και στις δύο περιπτώσεις, ο κώδικας ο ίδιος.

**Εύρημα έρευνας (code = source of truth):** Η SSoT της *γεωμετρίας, builders, snap-engine, commit, FSM*
**υπάρχει ήδη** κοινή 2D↔3D και είναι σωστή. Αυτό που **λείπει** στο 3D είναι το *οπτικό placement-feedback*
(μαγνητικά πλέγματα, δυναμικές διαστάσεις, γραμμές-οδηγοί, tracking traces). Αυτή η ADR (α) τεκμηριώνει το 2D
pipeline, (β) καταγράφει την ήδη-κοινή ραφή, (γ) ορίζει **ένα** refactor («projector abstraction») που κάνει
τον **ίδιο paint-κώδικα** να τρέχει σε 2D και 3D.

---

## 2. Το 2D pipeline βήμα-βήμα (ακολουθία κλικ)

### 2.1 Ενεργοποίηση εργαλείου & τύπος κολώνας

| Βήμα | SSoT | Ρόλος |
|---|---|---|
| Ribbon «Στήλη» / dropdown «Τύποι» | `ui/ribbon/.../column.drawKind:<kind>` action (ADR-521) | επιλογή τύπου (rectangular/circular/polygon/shear-wall/L/T…) |
| Bridge ribbon↔tool | `ui/ribbon/hooks/bridge/column-tool-bridge-store.ts` (`columnToolBridgeStore`) | single-writer: kind/anchor/overrides/sceneUnits |
| Activation | `hooks/drawing/use-column-tool-actions.ts` (`activate`, `setKind`, `setAnchor`) | enable + refresh snap targets |
| Orchestrator hook | `hooks/drawing/useColumnTool.ts` (`useColumnTool`) | FSM, click routing, lifecycle |

### 2.2 Μηχανή καταστάσεων (FSM) & κλικ

`useColumnTool.ts` → `onCanvasClick(point)` (γρ. ~269-357). Modes: `freehand` (default) / `in-region` /
`outer-perimeter` / `discrete-perimeter`. Freehand ροή:

```
idle ──activate──▶ awaitingPosition
  click #1 (θέση): mouse-handler-up resolves OSNAP → setColumnRotationLock(position,anchor) → awaitingRotation
  (live): το ghost περιστρέφεται προς τον κέρσορα
  click #2 (γωνία): resolveColumnRotationDeg(origin→cursor) → commitColumnAt(...) → reset → awaitingPosition (loop)
  [slanted: awaitingTopLean — 2ο κλικ ορίζει κλίση κορυφής (ADR-404)]
```

| Στάδιο | SSoT | Σημείωση |
|---|---|---|
| Click dispatch + snap στο click | `systems/cursor/mouse-handler-up.ts` | resolveBimCursorSnap → setColumnFaceAnchor/Rotation/GhostStatus |
| 1ο-κλικ handoff (anchor/rotation/status) | `systems/cursor/ColumnPlacementGhostStatusStore.ts` | imperative read στο useColumnTool |
| lock περιστροφής | `systems/cursor/ColumnRotationStore.ts` | awaitingRotation |
| lock κλίσης (slanted) | `systems/cursor/ColumnTopLeanStore.ts` | awaitingTopLean |
| region/perimeter clicks | `hooks/drawing/use-column-region-clicks.ts`, `use-column-perimeter-commit.ts` | εναλλακτικά modes |

### 2.3 Builders (preview ≡ commit — μηδέν διπλότυπο)

| SSoT | Συναρτήσεις |
|---|---|
| `hooks/drawing/column-completion.ts` | `buildDefaultColumnParams`, `buildColumnEntity` (→ `createColumn` factory, `computeColumnGeometry`) |
| `hooks/drawing/column-commit-build.ts` | `buildClickColumnEntity` (validation + grid bindings) |
| `hooks/drawing/column-preview-helpers.ts` | `generateColumnPreview` (καλεί τους **ΙΔΙΟΥΣ** builders με το commit) |

### 2.4 Snap brain (ένας resolver, nearest-wins)

`bim/placement/bim-cursor-snap.ts` (`resolveBimCursorSnap`, toolKind `'column'`) → `bim/columns/column-face-snap.ts`
(`resolveColumnFaceSnapFromTargets`, master nearest-wins) που ενοποιεί:

- `column-magnet-snap.ts` → `polar-disk-snap.ts` (§3.13 πολικό) / `rect-cartesian-snap.ts` (§3.15 καρτεσιανό)
- `column-corner-snap.ts`, `column-tangent-snap.ts` (§3.19/§3.20), `column-beam-corner-snap.ts` (ADR-525 L-junction)
- `column-reference-lines.ts` (T-head multi-ref), `column-face-snap-edges.ts` (slab/line edges)
- targets: `bim/framing/scene-snap-targets.ts` (`sceneSnapTargetsStore`)

### 2.5 Commit → scene (ΕΝΑ insertion path, undoable)

`useColumnTool.commitColumnAt` → `onColumnCreated` → `bim/columns/add-column-to-scene.ts` →
`bim/scene/append-entity-to-scene.ts` (`CreateBimEntityCommand` σε `CommandHistory` → broadcast
`drawing:entity-created`) → `systems/entity-creation/LevelSceneManagerAdapter.ts` (ADR-527) →
`useSceneManager.levelScenesRef` (sync SSoT). `app/ColumnPersistenceHost.tsx` ακούει & κάνει Firestore sync.

---

## 3. Οπτικό feedback κατά την τοποθέτηση (COL/πλέγματα/διαστάσεις/ίχνη)

Συναρμολογείται **entity-agnostic** στο `bim/placement/placement-ghost-assembly.ts` (`assemblePlacementGhost` /
`assemblePlacementRotationGhost`) — κοινό για **κολώνα ΚΑΙ πέδιλο** (ADR-514 Φ6d). Παράγει ghost + meta και
ζωγραφίζεται **όλο** από το `canvas-v2/preview-canvas/PreviewRenderer.ts`:

| Σύστημα | Meta (από assembly) | Painter (PreviewRenderer SSoT) | Εμβέλεια |
|---|---|---|---|
| Πολικό μαγνητικό πλέγμα | `PolarDiskGrid` (`polar-disk-snap.ts`) | `polar-disk-paint.ts` `paintPolarDisk` | column-specific |
| Καρτεσιανό πλέγμα | `RectGrid` (`rect-cartesian-snap.ts`) | `rect-grid-paint.ts` `paintRectGrid` | column-specific |
| Listening / dx-dy / R-θ διαστάσεις | `GhostFaceDimensionsMeta` (`ghost-face-dim-references.ts`, `resolveRectCartesianDims`) | `ghost-face-dim-paint.ts` `paintGhostFaceDimensions` → `renderPreviewDimension` (ADR-362) | SHARED |
| Γραμμή-οδηγός ευθυγράμμισης §3.20 | `PlacementAlignmentGuide` (`column-tangent-snap.ts`) | `alignment-guide-paint.ts` `paintAlignmentGuide` | column-specific |
| Σημάδι έλξης (OSNAP glyph + label) | `SnapIndicatorView` | `canvas-v2/overlays/SnapIndicatorGlyph.tsx` (+ `SnapIndicatorOverlay`) | SHARED (ADR-542) |
| Ίχνη ευθυγράμμισης (tracking) | tracking paths/markers (ADR-357) | `tracking-paint.ts` `paintTrackingMarkers`/`paintAlignmentPaths`/`paintIntersections` | SHARED |
| Στυλ overlay (γραμμή/κείμενο/βήμα) | — | `overlay-line-style.ts`, `overlay-text-style.ts`, `systems/tracking/adaptive-distance-snap.ts` | SHARED |

Κοινό μοτίβο όλων των painters: `(ctx, data, transform: ViewTransform, viewport)` και εσωτερικά
`toScreen = (p) => CoordinateTransforms.worldToScreen(p, transform, viewport)`. **Όλα ADR-040 micro-leaves**
(διαβάζουν live `getImmediateTransform()`, zero high-freq React state).

---

## 4. Η ραφή 2D↔3D που ΗΔΗ είναι κοινή

| Στρώμα | SSoT | 3D reuse |
|---|---|---|
| FSM ακολουθία κλικ | `useColumnTool.ts` | ✅ μέσω EventBus `bim:place-column-3d` → `onCanvasClick` |
| Builders οντότητας | `column-completion.ts`, `column-commit-build.ts` | ✅ ίδιοι builders (ghost & commit) |
| Snap brain | `bim-cursor-snap.ts` → `column-face-snap.ts` | ✅ `bim-3d/placement/placement-snap.ts resolvePlacementSnap` (ίδια μηχανή σε plan-mm) |
| Commit/scene/undo | `append-entity-to-scene.ts` → `add-column-to-scene.ts` | ✅ ΕΝΑ `CreateBimEntityCommand` |
| 3D placement glue | `bim-3d/placement/use-bim3d-column-placement.ts` (ADR-403) + `ColumnPlacementGhost.ts` | ✅ raycast floor → plan-mm → OSNAP → EventBus |
| Συντεταγμένες | `bim-3d/viewport/coordinate-transforms.ts` (`dxfPlanToWorld`, `worldToScreen`) | ✅ ENA transform stack |
| Snap glyph + label | `SnapIndicatorGlyph.tsx` | ✅ `bim-3d/viewport/snap/BimSnapIndicatorOverlay3D.tsx` (ADR-542) |
| Projection plan→canvas-px | `bim-3d/grips/grip-3d-screen-project.ts makeGripPlanToCanvas` | ✅ (grips ADR-535 + snap ADR-542) |
| Occlusion «μόνο μπροστινά» | `bim-3d/grips/grip-3d-depth-occluder.ts GripDepthOccluder` | ✅ |

> Δηλαδή: **το κλικ, η γεωμετρία, το snap, το commit και το snap-glyph είναι ήδη ένας κώδικας.**

---

## 5. Το ΚΕΝΟ + root cause

**Κενό:** Στο 3D **δεν** ζωγραφίζονται: πολικό/καρτεσιανό **μαγνητικό πλέγμα**, **δυναμικές διαστάσεις**
(dx/dy, R/θ, listening), **γραμμές-οδηγοί** §3.20, **ίχνη ευθυγράμμισης** (tracking). Επιπλέον το 3D placement
hook (`use-bim3d-column-placement.ts`) **δεν καλεί** `assemblePlacementGhost` — δείχνει απλό 3D mesh ghost
(`ColumnPlacementGhost`), άρα το meta (πλέγμα/διαστάσεις/οδηγοί) **ούτε υπολογίζεται** στο 3D.

**Root cause (μη-επαναχρησιμοποίηση):** κάθε `*-paint` συνάρτηση είναι **κολλημένη** στην 2D προβολή:

```ts
// canvas-v2/preview-canvas/polar-disk-paint.ts:64
const toScreen = (p) => CoordinateTransforms.worldToScreen(p, transform, viewport);
```

Δέχονται `(ctx, data, transform: ViewTransform, viewport)`. Το 3D χρειάζεται **άλλη** προβολή —
`makeGripPlanToCanvas(camera, canvas, elevFor)` → `(p) => canvas-local px | GRIP_OFFSCREEN`. Επειδή η προβολή
είναι hard-coded μέσα στον painter, ο ίδιος κώδικας δεν τρέχει σήμερα στο 3D.

---

## 6. Λύση SSoT — projector abstraction (ίδιος paint-κώδικας, 2 καμβάδες)

**Ένα refactor, μηδέν αλλαγή 2D συμπεριφοράς.** Αφαιρούμε την προβολή από τους painters: δέχονται έτοιμο
`project: (p: Point2D) => Point2D | null` αντί για `(transform, viewport)`.

> **Υλοποίηση (deviation από το draft):** ο τύπος επιστρέφει `Point2D` (ΟΧΙ `| null`). Σημείο πίσω
> από την κάμερα → off-canvas sentinel (`GRIP_OFFSCREEN`), **ΙΔΙΟ μοτίβο** με τον `makeGripPlanToCanvas`
> (ADR-535 Φ5) ώστε οι painters να μη χρειάζονται null-guard και το 2D να μένει byte-identical. Ο 3D
> projector ζει στο `bim-3d/placement/placement-overlay-project.ts` (`makePlacementOverlayProjector`):
> scene→plan-mm (÷ `mmToSceneUnits`) → `makeGripPlanToCanvas` → canvas-px.

```ts
// SSoT τύπος (canvas-v2/preview-canvas/overlay-projector.ts)
export type OverlayProjector = (worldOrPlan: Point2D) => Point2D;

// 2D caller (PreviewRenderer): ίδιο αποτέλεσμα με σήμερα
const project: OverlayProjector = (p) => CoordinateTransforms.worldToScreen(p, transform, viewport);

// 3D caller (νέο BimPlacementOverlay2D): ίδιος painter, κάμερα αντί transform
const project: OverlayProjector = makeGripPlanToCanvas(camera, canvas, () => elevMm);
```

Τότε **ο ίδιος ακριβώς painter** (`paintPolarDisk`, `paintRectGrid`, `paintGhostFaceDimensions`,
`paintAlignmentGuide`, `paintTracking*`) ζωγραφίζει σε:

- **2D** `PreviewCanvas` (όπως τώρα), και
- **νέο 3D** `bim-3d/.../BimPlacementOverlay2D.tsx` — Canvas2D layer πάνω από το WebGL, **ίδιο μοτίβο** με
  `BimSnapIndicatorOverlay3D` / `BimGripOverlay2D`: RAF projection per-frame, occlusion μέσω `GripDepthOccluder`,
  ADR-040 (low-freq subscribe στο meta, high-freq imperative draw).

**Meta = ήδη κοινό:** το 3D placement θα καλεί **το ίδιο** `generateColumnPreview` / `assemblePlacementGhost`
ώστε πλέγμα/διαστάσεις/snap να συμφωνούν byte-for-byte με το 2D → **preview ≡ commit ≡ 2D ≡ 3D**.

> Είναι **το ίδιο pattern** που ο κώδικας ήδη απέδειξε ότι δουλεύει: ADR-542 (snap markers) & ADR-535 Φ5 (grips)
> ξαναχρησιμοποιούν 2D render-κώδικα (`SnapIndicatorGlyph`, `UnifiedGripRenderer`) με 3D projector. Η ADR-544
> το γενικεύει στα **placement overlays** (πλέγμα/διαστάσεις/οδηγοί/ίχνη) της κολώνας.

### Γιατί όχι «νέο 3D σύστημα»

Καθαρή παραβίαση SSoT (N.0, N.12): θα διπλασίαζε τη γεωμετρία πλέγματος/διαστάσεων. Η μόνη αναπόφευκτη
διαφορά 2D↔3D είναι η **προβολή** — άρα σπάμε **μόνο** αυτήν, όπως ακριβώς το ADR-542.

---

## 7. Roadmap υλοποίησης (ξεχωριστό task — N.8 orchestrator-tier, ΔΕΝ υλοποιείται εδώ)

1. **Φ1 — projector seam (refactor, μηδέν συμπεριφορά):** εισαγωγή `OverlayProjector`· αλλαγή υπογραφών στα
   `polar-disk-paint`, `rect-grid-paint`, `ghost-face-dim-paint`, `alignment-guide-paint`, `tracking-paint`·
   ο `PreviewRenderer` περνά `worldToScreen`-based projector. Jest: 2D projector → **identical output** (golden).
2. **Φ2 — 3D meta:** το `use-bim3d-column-placement` καλεί `generateColumnPreview`/`assemblePlacementGhost`
   (όχι μόνο mesh ghost) και δημοσιεύει το meta σε νέο low-freq `Placement3DOverlayStore`.
3. **Φ3 — 3D overlay:** `BimPlacementOverlay2D.tsx` (mount στο `BimViewport3D`) → RAF: project meta μέσω
   `makeGripPlanToCanvas` → καλεί τους **ΙΔΙΟΥΣ** painters → occlusion `GripDepthOccluder`.
4. **Φ4 — verify:** browser-verify πλέγμα/διαστάσεις/οδηγοί/ίχνη στο 3D κατά τη σχεδίαση κολώνας = ίδια εικόνα
   με 2D· occlusion «μόνο μπροστινά»· ADR-040 micro-leaf (μηδέν 60fps re-render).

**Pre-commit:** αγγίζει micro-leaf/canvas-drawing αρχεία → CHECK 6B/6D → stage ADR-040 + ADR-544.

---

## 8. Changelog

- **2026-06-27** — Δημιουργία (Plan Mode research, Giorgio order «ίδιος κώδικας κολώνας 2D & 3D, μία πηγή
  αλήθειας»). Τεκμηρίωση 2D pipeline + ήδη-κοινής ραφής· ορισμός projector-abstraction seam· roadmap Φ1-Φ4.
  Παράλληλη ADR-543 (τοίχοι). Status: 🔬 RESEARCH/DESIGN — υλοποίηση εκκρεμεί ως ξεχωριστό task.
- **2026-06-27** — **Υλοποίηση Φ1-Φ3 (UNCOMMITTED).** SSoT audit (§2 grep) → επιβεβαίωση ότι ΔΕΝ υπήρχε
  projector type / 3D placement overlay / meta store· reuse ΟΛΩΝ των 3D helpers (`makeGripPlanToCanvas`,
  `GripDepthOccluder`, `overlay-raf`, camera-gate). Μηδέν διπλότυπο.
  - **Φ1 (projector seam):** NEW `canvas-v2/preview-canvas/overlay-projector.ts` (`OverlayProjector` =
    `(Point2D)=>Point2D` + `fromTransform` + `projectorScaleAt`). Project-only refactor: `polar-disk-paint`,
    `rect-grid-paint`, `alignment-guide-paint`, `tracking-paint` (×4). `ghost-face-dim-paint`
    (`paintGhostFaceDimensions`/`paintAlignedOverlayDimension`) + `preview-dimension-renderer`
    (`renderPreviewDimension`) πήραν **optional trailing `project`** (backward-compatible — wall-HUD/ADR-543
    + ADR-362 committed dims αμετάβλητα· `effScale` παράγεται από τον projector → **2D byte-identical**).
    `PreviewRenderer` χτίζει `fromTransform(...)` στους ~6 wrappers.
  - **Φ2 (3D meta):** NEW `bim-3d/stores/Placement3DOverlayStore.ts` (low-freq) + NEW pure
    `bim-3d/placement/placement-overlay-meta.ts` (`extractPlacement3DMeta`). Το `use-bim3d-column-placement`
    `onMove` καλεί το ΕΝΑ `generateColumnPreview` (ίδιο SSoT με 2D) → publish meta· clear σε miss/leave/teardown.
  - **Φ3 (3D overlay):** NEW pure `bim-3d/placement/placement-overlay-project.ts`
    (`makePlacementOverlayProjector` scene→plan-mm→px· `scenePointToPlanMm`) + NEW pure
    `bim-3d/viewport/placement/placement-overlay-paint.ts` (dispatcher στους ΙΔΙΟΥΣ painters) + NEW
    `bim-3d/viewport/placement/BimPlacementOverlay2D.tsx` (mirror `BimGripOverlay2D`: RAF, camera-gate,
    occlusion μέσω `GripDepthOccluder` «μόνο μπροστινά» στο σημείο κουμπώματος). Mount στο `BimViewport3D`.
  - **Tests:** 18/18 GREEN (overlay-projector parity, meta extractor, 3D projector unit-factor μέσω three,
    paint dispatcher routing) + regression `ghost-face-dim-paint` (2D αμετάβλητο).
  - **Γνωστός περιορισμός:** το zoom-adaptive βήμα πλέγματος/διαστάσεων διαβάζει το 2D `ImmediateTransformStore`
    (`worldPerPixel`)· στο 3D η πυκνότητα ακολουθεί το 2D zoom, όχι την κάμερα (bounded από rect/disk extent —
    οπτική βελτίωση για follow-up, μηδέν crash). Tracking traces (ADR-357) δεν τροφοδοτούνται ακόμη στο 3D
    overlay (το `generateColumnPreview` meta δεν τα περιλαμβάνει)· ο painter είναι ήδη project-ready.
  - **Pre-commit:** αγγίζει micro-leaf/canvas-drawing → CHECK 6B/6D → stage ADR-040 + ADR-544. 🔴 browser-verify.
- **2026-06-27 (parity fix μετά από browser-review Giorgio — 2D vs 3D top-view στιγμιότυπα).** Δύο κενά
  ισοτιμίας εντοπίστηκαν & διορθώθηκαν με **μία πηγή αλήθειας**:
  - **(α) Διαστάσεις σε λάθος θέση στο 3D** (εμφανίζονταν σε αυθαίρετη κάθετη οντότητα δεξιά αντί στον
    κέρσορα). **Root cause:** το `generateColumnPreview` → `resolveEffectivePreviewCursor` διάβαζε το 2D
    `ImmediateSnapStore` (`getImmediateSnap()`), που στο 3D κρατά **stale** 2D snap. **Fix:** προαιρετικό
    `effectiveCursorOverride` στο `generateColumnPreview` (2D αμετάβλητο)· το 3D περνά τον ΗΔΗ-snapped 3D cursor.
  - **(β) Δεν εμφανίζονταν OSNAP glyphs/labels («Γωνία κολόνας» κ.λπ.) στο 3D.** **Root cause:** το
    `computeSnap3DHover` (hover) κάνει raycast **μόνο** σε BIM solids — αστοχεί πάνω στην επίπεδη DXF κάτοψη.
    **Fix (SSoT):** νέο `resolvePlacementSnapWithView` (placement-snap.ts) — **ΜΙΑ** engine query (ίδιος
    `getGlobalSnapEngine` με 2D) επιστρέφει θέση **+** `SnapIndicatorView` (μέσω `toSnapIndicatorView`)· ο
    column placement hook δημοσιεύει το view στο **κοινό** `Snap3DOverlayStore` → ο υπάρχων ADR-542
    `BimSnapIndicatorOverlay3D` ζωγραφίζει το ΙΔΙΟ glyph+label. Ο `PlacementSnapMarker` (φτωχό 3D dot)
    **αφαιρέθηκε** από τον column hook (το glyph τον αντικαθιστά → πλήρης 2D parity). Guard στο
    `use-bim3d-pointer-handlers.updateSnap3D`: όσο το εργαλείο κολόνας είναι ενεργό, ο placement hook είναι
    ο **μοναδικός** κάτοχος του snap glyph (αλλιώς ο hover BIM-raycast θα το έσβηνε σε null).
  - Tests: +3 `resolvePlacementSnapWithView` (single-query + view), ενημέρωση column-placement mock. Σύνολο GREEN.
- **2026-06-27 (SSoT dedup μετά από hard audit Giorgio «κεντρικοποίησε»).** Εξάλειψη 3 διπλοτυπιών
  (2 μικρές δικές μου + 1 προϋπάρχουσα, κατά διαταγή «τα προϋπάρχοντα τα κεντρικοποιείς κι αυτά»):
  - **Occluder lifecycle** ήταν **verbatim σε 4 overlays** (grip/snap/crosshair + placement). → νέο
    `useGripDepthOccluder()` στο `overlay-raf.ts` (overlay-lifecycle SSoT)· `new GripDepthOccluder()`
    υπάρχει πλέον **σε 1 σημείο**· refactor και των 4.
  - **`scenePointToPlanMm`** (inverse του `planMmToScenePoint`) είχε μπει στο `placement-overlay-project`·
    → **μετακινήθηκε** στο `world-to-scene-point.ts` (coordinate-bridge SSoT, δίπλα στο sibling)· ο
    projector το reuse-άρει (μηδέν inline `/ mmToSceneUnits`).
  - **Overlay meta field-set** (`polarDiskGrid`/`rectGrid`/`faceDimensions`/`alignmentGuide`) διαβαζόταν
    με inline structural casts σε 2 σημεία (2D `drawing-hover-handler` + 3D extractor). → νέο canonical
    `PlacementOverlayFields` (`bim/placement/placement-overlay-fields.ts`)· και οι δύο readers το κάνουν
    `entity as PlacementOverlayFields` (2D: 4 casts → 1). Μηδέν διπλή γνώση πεδίων.
  - 43/43 jest GREEN μετά το dedup. Pre-commit CHECK 6D → ADR-544 staged.

- **2026-07-16 — το `PlacementOverlayFields` ΟΛΟΚΛΗΡΩΘΗΚΕ** (ADR-663 §4 part 4b· εντολή Giorgio).
  Το αρχικό audit (πάνω) κάλυψε **μόνο 4 πεδία** — πλέγμα/διαστάσεις/οδηγός. Τα υπόλοιπα ghost-meta
  πεδία **έμειναν εκτός**, κι έτσι το ίδιο ακριβώς αντι-μοτίβο **επέζησε σε ό,τι δεν μεταφέρθηκε**:
  - **Readers**: `drawing-hover-overlays` (×4), `WallPlacementGhost`, `wall-joint-miter-preview`,
    `preview-entity-paint` διάβαζαν με inline cast που **ξανα-δήλωνε το σχήμα** — το
    `drawing-hover-overlays:168` έγραφε στο χέρι `{ bandMm: readonly [number, number] }` ενώ το
    `OpeningConflictMeta` **εξάγεται** ήδη δίπλα του.
  - **Writers**: τα δίδυμα `attachColumnHud`/`attachFoundationPadHud` έκαναν
    `{ ...ghost, xHud } as ExtendedSceneEntity` — cast που **το TS απέρριπτε** (2× TS2352), γιατί το
    `ExtendedSceneEntity` **δεν δηλώνει κανένα** ghost-meta πεδίο.
  - **Τώρα δηλώνονται όλα εδώ, μία φορά**: `wallHud`, `hudSpecLabel`, `columnHud` (+`ColumnHudMeta`),
    `footprintHud` (+`FootprintHudMeta`), `wysiwygPreview`, `ghostStatusColor`, `openingConflict`,
    + `PlacementGhostEntity = ExtendedSceneEntity & PlacementOverlayFields` για τους writers (οι δύο
    twins πλέον **χωρίς κανένα cast**). Grep: **μηδέν** inline cast αυτών των πεδίων απομένει.
  - **Σκόπιμα ΕΚΤΟΣ**: το `liveDimHud` — σε αντίθεση με το `columnHud`, το **δηλώνει ο παραγωγός του**
    (`ExtendedLineEntity`/`ExtendedPolylineEntity`)· το cast του reader απλώς στενεύει το union σε μέλος
    που ήδη κατέχει το πεδίο, δεν είναι διπλή γνώση. Μεταφορά του θα δημιουργούσε **δεύτερη** δήλωση —
    ακριβώς αυτό που απαγορεύει το ADR-544. **Ο κανόνας**: το `PlacementOverlayFields` κατέχει meta που
    προσαρτώνται σε **πραγματικά entity ghosts** (που δεν μπορούν να τα δηλώσουν)· τα `Extended*`
    interfaces κατέχουν τα **δικά τους** preview πεδία.
  - **Εκκρεμεί (όχι regression)**: το `toWysiwygPreviewEntity` κρατά `as unknown as ExtendedSceneEntity`
    + **7 positional params** — τώρα που τα πεδία δηλώνονται, υποψήφιο για options object τυπωμένο με
    `PlacementOverlayFields` αντί για 8ο param. Ξεχωριστή αλλαγή.
  - **Δίδαγμα**: ένας **μερικώς** εφαρμοσμένος SSoT δεν μικραίνει το πρόβλημα — το **κρύβει στο υπόλοιπο**.
  - Verification: **1239/1239 tests** (125/126 suites· το 1 fail = προϋπάρχον circular-import στο
    `hooks/grips/`, άσχετο). `jscpd:diff` καθαρό (7 αρχεία). tsc: 62 → **60**.
