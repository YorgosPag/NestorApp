# ADR-402 — 3D Viewport BIM Element Editing

| Field | Value |
|---|---|
| Status | 🟢 ACCEPTED — Sub-Phase 0+1+2 DONE · GenArc gizmo port **Phase A** DONE · **Phase B resize (column/wall/beam/slab + axis-Y)** DONE · **Phase B snap-during-drag (move + horizontal resize)** DONE · **Phase C multi-select 3Δ (centroid move/rotate + snap-from-all)** DONE · **Sub-Phase 1 stair gizmo resize (width / run, gizmo handles)** DONE (pending commit, 🔴 browser verify) |
| Date | 2026-05-31 |
| Owner | Giorgio / Claude (Opus) |
| Related | ADR-366 (3D viewport), ADR-363 (BIM grips/commands), ADR-371 (Properties pipeline), ADR-040 (micro-leaf), ADR-188 (rotation), GenArc ADR-022 (gizmo system) |

---

## Context

Στο `/dxf/viewer`, η 3Δ προβολή (ADR-366) ήταν **μόνο θέαση + σχολιασμός**: επιλογή,
hover, διαστάσεις/τομές/σχόλια/φωτορεαλισμός. Η **επεξεργασία** δομικών στοιχείων
(wall/column/beam/slab/stair) γινόταν αποκλειστικά στη 2Δ κάτοψη.

Στόχος (Revit/ArchiCAD): **ένα μοντέλο, πολλές προβολές** — επεξεργασία του ίδιου
μοντέλου και μέσα από το 3Δ, με τις αλλαγές να φαίνονται παντού.

**Κρίσιμη διαπίστωση (έρευνα 3 Explore + 1 Plan agents):** οι εντολές μεταβολής
(`UpdateWallParamsCommand`, `MoveEntityCommand`, `RotateEntityCommand`, parametric
`commit*GripDrag`) είναι **100% ανεξάρτητες από προβολή** (μέσω `ISceneManager`). Το
3Δ scene **συγχρονίζεται αυτόματα** μετά από κάθε εντολή
(`command → setLevelScene → *PersistenceHost → Bim3DEntitiesStore → BimViewport3D
subscription → resyncBimScene`). Το `cascadeHostedOpeningsForWalls` ζει **μέσα** στις
εντολές → κουφώματα ακολουθούν & undo/redo δουλεύει δωρεάν.

**Συνέπεια:** Το 3Δ editing είναι **γέφυρα** — 3Δ gesture → προβολή στο floor XY-plane →
`Point2D` delta / pivot+angle → υπάρχουσα εντολή. Μηδέν νέα μαθηματικά/εντολές.

---

## Decision

### Σχέδιο σε υπο-φάσεις

| Sub-Phase | Περιγραφή | Κατάσταση |
|---|---|---|
| 0 | Barrel export `RotateEntityCommand`/`MirrorEntityCommand` + SSoT `bim3d-edit-math.ts` (`computeFloorPlane`, `worldDeltaToDxfDelta`) | ✅ DONE |
| 1 | Επεξεργάσιμο πάνελ ιδιοτήτων (`useBimGeometryEdit`, `BimGeometryTab` numeric inputs → `UpdateXxxParamsCommand`) | ✅ DONE (stair + browser verify εκκρεμεί) |
| 2 | Move gizmo v1 (απλό floor-plane handle, πλήκτρο G) | ✅ DONE → **αντικαταστάθηκε από GenArc port Phase A** |
| **GenArc Port A** | **Persistent auto-on-selection gizmo: Move (axis/plane/free) + Rotate-Y** | ✅ **DONE** (αυτό το έγγραφο) |
| **GenArc Port B** | **Resize handles (column/wall/beam/slab) + κατακόρυφος άξονας-Y + snap-during-drag (move + οριζόντιο resize)** | ✅ **DONE** |
| **GenArc Port C** | **Multi-select 3Δ (Shift+click → centroid move/rotate + snap-from-all, ΕΝΑ undo)** | ✅ **DONE** (resize σε multi εκτός scope) |

### GenArc Gizmo Port — Phase A (απόφαση Giorgio 2026-05-31)

Αντί για hand-rolled rotate/grips ένα-ένα, **port** του ολοκληρωμένου gizmo του GenArc
(`C:\genarc`, ADR-022) — ίδιο ownership (N.5 OK). ΕΝΑ **persistent, auto-on-selection**
gizmo (Revit/Cinema-4D): εμφανίζεται **μόλις** επιλέξεις στοιχείο στο 3Δ (όχι πλήκτρο),
σταθερό μέγεθος οθόνης, hover highlight.

**Στρατηγική hybrid:** port των **portable** GenArc layers (καθαρά THREE) ως gizmo
βιβλιοθήκη· **δικό μας** overlay/controller/bridge που συνδέεται με τις **δικές μας**
view-agnostic commands (cascade κουφωμάτων + undo — που το GenArc ΔΕΝ έχει).

#### Ported portable layers — `bim-3d/gizmo/` (THREE-only, header attribution)

| Αρχείο | Από GenArc | Ρόλος |
|---|---|---|
| `gizmo-constants.ts` | `gizmo.constants.ts` | χρώματα/μεγέθη, `GIZMO_SCREEN_SCALE=0.45`, renderOrder, thresholds |
| `gizmo-types.ts` | `gizmo.types.ts` | GizmoAxis/Plane/Handle/HandleId, `parseHandleId`, `handleToConstraint` |
| `gizmo-projection.ts` | `gizmoProjection.ts` | `projectOntoAxis/Plane/Vertical/Constrained` (pure) |
| `gizmo-hit-test.ts` | `gizmoHitTest.ts` | `testGizmoHit` (priority rotate>resize>center>plane>axis) |
| `gizmo-builders.ts` | `gizmoBuilders.ts` | arrow (line stem + concave chevron), plane (L-bracket) |
| `gizmo-handle-builders.ts` | `gizmoHandleBuilders.ts` | resize octahedron, center pyramid, origin reticle |
| `gizmo-geometry.ts` | `gizmoGeometry.ts` | `createGizmoMeshes()` factory (arrows+planes+resize+center+reticle+rotate rings) |

#### Bridge layer — `bim-3d/gizmo/` (δικό μας, mirror GenArc)

- **`bim-gizmo-overlay.ts`** — wrapper του `GizmoMeshSet` (root → `manager.scene`):
  `updatePosition` (entity bbox centroid), `updateScale` screen-constant
  (`dist·tan(fov/2)·0.45`), `setHoverHandle`, **Phase A visibility** (ορατά: axis-x,
  axis-z, plane-xz, center, rotate-y· κρυφά: resize, rotate-x/z, axis-y, planes με Y).
- **`bim-gizmo-controller.ts`** — pure FSM idle→hover→drag (NO React), driving overlay +
  bridge. `updateHover`/`beginDrag`/`updateDrag` (gizmo follow)/`endDrag`/`cancelDrag`.
- **`bim-gizmo-drag-bridge.ts`** — pure math: constrained projection → command-ready
  `BridgeOutcome`. **Move** (axis X→dxf x / axis Z→dxf y / plane XZ ή free→x,y) μέσω
  `worldDeltaToDxfDelta` (SSoT). **Rotate-Y** → angle περί world-Y + pivot =
  `worldToDxfPlan(anchor)`. Single-commit-on-release (καμία entity mutation στο drag).

#### Wiring (επέκταση committed Sub-Phase 2 υποδομής)

- `use-bim3d-edit-interaction.ts` — χτίζει overlay+controller· **auto-on-selection** μέσω
  `Selection3DStore` subscription· `setControlsEnabled(false)` κατά drag· re-anchor μετά
  resync· `updateScale` σε pointermove/wheel (καλύπτει orbit/zoom· manager ΑΘΙΚΤΟΣ).
- `bim3d-edit-interaction-handlers.ts` — ctx pointer bodies· dispatch `MoveEntityCommand`/
  `RotateEntityCommand` ανά outcome· multi-floor `resolveEntityLevelId`→targetLevelId·
  X/Z keyboard axis-lock = commit-time mask στο move delta.
- **DELETED** `Bim3DEditMoveHandle.ts` + `bim3d-edit-drag-controller.ts` (αντικαταστάθηκαν).
- Shortcuts: G = toggle gizmo (συμπληρώνει το auto-on-selection)· Escape = deactivate.

### Τίμια όρια Phase A
- Συνδέεται **μόνο το Y-ring** rotate: η `RotateEntityCommand` είναι plan-rotation (περί
  world-Y). Τα X/Z rings είναι κρυφά (δεν αντιστοιχίζονται σε 2Δ).
- ~~**Single-select**~~ → **Multi-select DONE Phase C** (`Selection3DStore` widened, Shift+click).
- **Resize**: COLUMN (resize-x→width / resize-z→depth) DONE Phase B· wall(thickness/length)/beam/slab +
  κατακόρυφη (Y)→elevation DONE Phase B. **Resize σε multi-select = εκτός scope** (Phase C: μόνο
  move+rotate σε πολλά· centroid scale = follow-up).
- **Snap-during-drag**: move (AutoCAD-style χαρακτηριστικά σημεία) + οριζόντιο resize DONE Phase B
  (σέβεται OSNAP toggle)· **multi-select snap από χαρακτηριστικά σημεία ΟΛΩΝ** DONE Phase C.
- **Stair resize (Sub-Phase 1)** DONE: plan-only handles (resize-x/z) → `width` (perp, symmetric) ή
  `totalRun`/`stepCount` (axial, whole-step snap = Revit add/remove risers)· dominant component =
  μία διάσταση/drag· axis-Y → null (ύψος = rise×stepCount, building-code → πάνελ). Reuse 2Δ
  `applyStairGripDrag` SSoT (μηδέν νέα stair math).
- **❌ υπόλοιπο:** stair 3Δ grips (πλήρες Revit, αναβλήθηκε ως επόμενη φάση) + cross-floor multi-move (Phase C limitation).

### Phase C — Multi-select 3Δ (απόφαση Giorgio 2026-05-31)
- **Επιλογή:** μόνο **Shift+click** (ένα-ένα add/remove)· απλό κλικ = replace· όχι box-select.
- **Gizmo:** ΕΝΑ gizmo στο **union centroid** της ομάδας· με >1 επιλεγμένα `editBimType=null` →
  `activeHandlesFor(null)` δείχνει **μόνο move + rotate-Y** (resize handles κρυφά).
- **Commands (reuse, μηδέν νέα λογική):** move → `MoveMultipleEntitiesCommand(ids[],…)` (batch +
  cascade κουφωμάτων)· rotate → `RotateEntityCommand(ids[], centroidPivot,…)` (ήδη array). ΕΝΑ undo step.
- **Snap:** χαρακτηριστικά σημεία (grips) **ΟΛΩΝ** των επιλεγμένων → union offsets από τον group
  anchor → `makeMoveSnapFn` (nearest-wins). Exclude = primary id.
- **Store SSoT:** `Selection3DStore.selectedBimIds[]` + derived compat `selectedBimId` (= primary),
  ώστε οι 9+ consumers να μη σπάνε. Highlighter widened σε `Set` με diff.
- **Limitations:** cross-floor multi-move χρησιμοποιεί το level του primary (same-floor = η κοινή
  περίπτωση, πλήρως λειτουργική)· snap exclude μόνο primary· centroid resize follow-up.

---

## SSoT reuse (μηδέν διπλά μαθηματικά/εντολές)
- Move/Rotate: `MoveEntityCommand` / `RotateEntityCommand` (zero change, μόνο barrel export).
- **Resize (Phase B):** `bim3d-resize-bridge.ts` (νέο SSoT γέφυρα — **μηδέν νέα math**) → καλεί τα 2Δ
  grip-drag SSoT `applyColumnGripDrag` (το οποίο κάνει `projectDeltaToLocal` → χειρίζεται περιστροφή) →
  `UpdateColumnParamsCommand`. mm→canvas μετατροπή μέσω `mmScaleFor` (ίδιο pattern με 2Δ commit path).
- **Stair resize (Sub-Phase 1):** `computeStairResizeParams` (ίδιο αρχείο `bim3d-resize-bridge.ts`) →
  καλεί το 2Δ SSoT `applyStairGripDrag('stair-width'|'stair-length')` → `UpdateStairParamsCommand`
  (**μηδέν νέα stair math/clamps/snapping**). Η σκάλα έχει ΔΥΟ in-plane διαστάσεις, οπότε: project το
  plan slide στο local frame (`directionToUnitVector`/`perp` stair SSoT), **dominant component** →
  μία διάσταση/drag. `resizeWidth`/`resizeLength` είναι ABSOLUTE-frame (διαβάζουν `currentPos` σχετικά
  με `basePoint`), αλλά το gizmo handle κάθεται σε screen-constant offset — όπως το wall-thickness NOTE,
  ξαναχτίζουμε RELATIVE drag (`currentPos = anchor + delta`, anchor = ο τύπος που αντιστρέφει ο
  transform). mm→drawing-units μέσω `mmToSceneUnits(inferSceneUnitsFromWidth)` (ίδιο factor με
  `getStairGrips`) → scene-correct σε mm/cm/m. axis-Y → null (ύψος building-code, πάνελ).
- Συντεταγμένες: `dxfPlanToWorld`/`worldToDxfPlan` (`coordinate-transforms.ts`),
  `computeFloorPlane`/`worldDeltaToDxfDelta` (`bim3d-edit-math.ts`).
- Adapter: `createSceneManagerAdapter` (`grip-commit-adapters.ts`).
- Cascade κουφωμάτων: δωρεάν (μέσα στις εντολές).
- **Snap (Phase B):** ΕΝΑ snap engine SSoT `getGlobalSnapEngine()` (`ProSnapEngineV2.findSnapPoint`) —
  **μηδέν νέα snap λογική**. Χαρακτηριστικά σημεία στοιχείου = `computeDxfEntityGrips` (το 2Δ grip SSoT).
  Νέα **pure** γέφυρα `bim3d-snap-bridge.ts` (`makeMoveSnapFn`/`makeResizeSnapFn`) — ο handler την στήνει
  (έχει scene/engine), ο pure bridge την δέχεται ως injected callback (μένει testable χωρίς engine).

## Edge cases & κανόνες
1. **Multi-floor** `floor3DScope='all'`: edit στοχεύει το επίπεδο του στοιχείου
   (`resolveEntityLevelId`), όχι το `currentLevelId`.
2. **Undo/redo**: single-commit-on-release (`isDragging=false`) → ένα undo step (2Δ parity).
3. **ADR-040 micro-leaf**: overlay/controller/bridge = pure classes· hook = ένα `useEffect`
   + AbortController· `Bim3DEditStore` micro-store· μηδέν `useSyncExternalStore` σε orchestrator.
4. **ADR-371 read-only**: `useLevelsOptional()===null` → gizmo disabled.
5. **manager ΑΘΙΚΤΟΣ** (499/500): gizmo στο hook μέσω public `manager.scene`/`bimLayer`/`viewport`.

## Verification
- **Tests:** `gizmo-projection` (6), `gizmo-hit-test` priority (3), `bim-gizmo-drag-bridge`
  (move/resize sign + rotate pivot/angle + **snap injection** 4), `bim-gizmo-overlay`,
  `bim3d-resize-bridge`, **`bim3d-snap-bridge` (7 — multi-grab nearest-wins / OSNAP off / fallback /
  resize)** — **57/57 gizmo PASS**. `npx tsc --noEmit` clean (0 errors).
- **🔴 Browser** `localhost:3000/dxf/viewer` 3Δ: επιλογή→gizmo auto· drag axis/plane→
  μετακίνηση + κουφώματα follow + ένα undo· Y-ring→rotate ταυτίζεται 2Δ· screen-constant
  κατά zoom/orbit· multi-floor σωστός όροφος. **Snap:** drag move κοντά σε γωνία άλλου στοιχείου →
  «κουμπώνει» + cyan δείκτης· OSNAP off → χωρίς snap· οριζόντιο resize handle → κουμπώνει σε γραμμή.

---

## Changelog
- **2026-06-02 (Opus 4.8, Developer A SOLO)** — **🐛 FIX: η σκάλα δεν μετακινούνταν/περιστρεφόταν με
  το gizmo (unit mismatch)** (pending commit, βγήκε στο browser verify). Σύρσιμο move/rotate gizmo σε
  σκάλα → μετακινούνταν μόνο το gizmo, η σκάλα «έφευγε»/δεν κουνιόταν. **Root cause:** wall/column/beam/
  slab αποθηκεύουν params σε **raw mm** (`BimToThreeConverter` fixed `MM_TO_M`), αλλά η **σκάλα** (ADR-358)
  σε **inferred drawing units** (`StairToThreeConverter` `sceneToM` από `inferSceneUnitsFromWidth`). Το
  `worldDeltaToDxfDelta`/`worldToDxfPlan` παράγουν **mm**· τα κοινά SSoT `moveStair`/`rotateEntity` (που στο
  2Δ δέχονται drawing-unit inputs) εφάρμοζαν το mm value **χωρίς μετατροπή** → σε σχέδιο μέτρων η σκάλα
  μετακινούνταν/περιστρεφόταν 1/sceneToM (×1000) εκτός. Το resize δούλευε γιατί το Sub-Phase 1 bridge ήδη
  μετέτρεπε. **Fix (ΜΗΔΕΝ άγγιγμα σε bim/stairs/core-commands):** νέο SSoT `mmToEntityUnitFactor(entity)`
  στο `bim3d-edit-math.ts` (1 για mm-types· `mmToSceneUnits(inferSceneUnitsFromWidth(width))` για σκάλα —
  ίδιος factor με `getStairGrips`/resize bridge)· εφαρμόζεται στο `buildEditCommand` σε **move delta**
  (single) + **rotate pivot** (single). Multi-select κρατά mm (mixed-unit batch = documented limitation).
  +3 tests στο `bim3d-edit-math.test.ts` (factor=1 για mm-types· stair drawing-unit factor· mm-scale vs
  m-scale divergence). 72/72 PASS (gizmo+edit-math), tsc 0. **⚠️ Same-root latent (flagged):** ο
  snap-from-grips για σκάλα (`buildDragSnapFn` offsets = drawing-unit grips − mm anchor) είναι ακόμα
  unit-mixed → snap σε σχέδιο μη-mm ανακριβές (δεν κρασάρει)· follow-up.
- **2026-06-02 (Opus 4.8, Developer A SOLO)** — **🐛 FIX: crash στο snap-during-drag όταν σέρνεις
  σκάλα/πλάκα** (pending commit, βγήκε στο browser verify Sub-Phase 1). `onEditPointerDown` →
  `buildDragSnapFn` δίνει το **domain `Entity`** (από το level-scene) στο `computeDxfEntityGrips` (cast
  σε `DxfEntityUnion`) για να μαζέψει χαρακτηριστικά σημεία snap. Τα wall/beam/column δουλεύουν γιατί το
  domain shape ταυτίζεται με το grip-input, αλλά τα **stair/slab** διάβαζαν nested wrapper field
  (`entity.stairEntity` / `entity.slabEntity`) που το domain entity ΔΕΝ έχει → `getStairGrips(undefined)`
  → `TypeError: entity is undefined` στο pointer-down. **Root-cause fix (1 αρχείο, `grip-computation.ts`):**
  τα cases `'stair'`/`'slab'` δέχονται πλέον **και** τις δύο μορφές (`entity.stairEntity ?? entity`),
  ομοιόμορφα με wall/beam/column. Το 2Δ είναι αποδεδειγμένα αναλλοίωτο (το wrapper έχει πάντα
  `.stairEntity`, άρα το `??` δεν πυροδοτείται). **ΜΗΔΕΝ άγγιγμα** σε `bim/stairs`/`bim/slabs`/snapping
  λογική. +NEW regression test `grip-computation-bim-domain-entity.test.ts` (αναπαράγει το crash + κλειδώνει
  parity domain↔wrapper grips, 2/2 PASS)· gizmo suite 63/63 PASS.
- **2026-06-01 (Opus 4.8, Developer A SOLO)** — **Sub-Phase 1: Stair gizmo resize (width / run)**
  (pending commit, 🔴 browser verify). Η σκάλα ήταν το μόνο BIM domain χωρίς 3Δ resize (move/rotate
  ήδη δούλευαν type-agnostic). Απόφαση Giorgio (AskUserQuestion): (1) αλλαγή **πλάτος + μήκος/βάθος**·
  (2) τρόπος = **gizmo handles τώρα** (συνεπές με Phase B), πλήρη Revit-style 3Δ grips ως επόμενη φάση.
  **Υλοποίηση (3 αρχεία κώδικα, μηδέν άγγιγμα stair λογικής):** (a) `bim3d-resize-bridge.ts` νέο SSoT
  `computeStairResizeParams(entity, drag)` — project plan slide στο stair-local frame, **dominant
  component** = μία διάσταση/drag (perp → `width` ×2 symmetric· axial → `totalRun`/`stepCount` με
  **whole-step snapping**, `tread` σταθερό = Revit add/remove risers)· anchor από params (ο τύπος που
  αντιστρέφει το `resizeWidth`/`resizeLength`) + RELATIVE drag (`currentPos = anchor + deltaScene`)
  → `applyStairGripDrag` (reuse 2Δ clamps/snapping)· mm→drawing-units μέσω
  `mmToSceneUnits(inferSceneUnitsFromWidth)` (ίδιο factor με `getStairGrips`, scene-safe mm/cm/m)· axis-Y
  → null (ύψος = rise×stepCount, building-code → πάνελ)· no-op guard (value-identical width/run/stepCount
  → null, αποφεύγει κενό undo). (b) `bim-gizmo-overlay.ts` `RESIZE_HANDLES_BY_TYPE.stair = [resize-x,
  resize-z]` (plan-only). (c) `bim3d-edit-interaction-handlers.ts` `buildResizeCommand` stair branch →
  `UpdateStairParamsCommand`. **+1 NEW test** (`bim3d-resize-bridge-stair.test.ts`, 6 tests). **bim-3d
  gizmo+animation 17 suites / 173 PASS, tsc clean (0).** Παραμένει: πλήρες stair 3Δ grips (deferred) +
  browser verify.
- **2026-05-31 (Opus 4.8, Developer A SOLO, Plan Mode)** — **Phase C: Multi-select 3Δ (centroid
  move/rotate + snap-from-all)** (pending commit, 🔴 browser verify). Επιλογή πολλών BIM στοιχείων με
  **Shift+click** → ΕΝΑ gizmo στο **union centroid** → move + rotate ΟΛΩΝ μαζί σε **ΕΝΑ undo step**.
  Με >1 επιλεγμένα τα resize handles κρύβονται (`editBimType=null`→`activeHandlesFor(null)`). Snap από
  χαρακτηριστικά σημεία **ΟΛΩΝ** (union offsets → `makeMoveSnapFn`, nearest-wins). **Widening** (μηδέν νέα
  command λογική — reuse `MoveMultipleEntitiesCommand` + `RotateEntityCommand(string[])`): `Selection3DStore`
  single→multi (`selectedBimIds[]`+`selectedBimTypes`, derived compat `selectedBimId`/`selectedBimType`,
  νέο `toggleEntity`)· `Bim3DEditStore` (`editEntityIds[]`, derived `editEntityId`, νέος `selectEditEntityKey`
  membership selector — re-anchor όταν αλλάζει το σύνολο)· `BimSelectionHighlighter` single→`Set` με
  **diff old-vs-new** (toggle αγγίζει μόνο τα meshes που άλλαξαν). `selectBimEntity` body εξήχθη σε
  `applyBimSelection` helper (`scene-manager-actions.ts`) + νέο `toggleBimEntity` → `ThreeJsSceneManager`
  μένει ≤500 γρ. Pointer handler: Shift+click→`toggleBimEntity`. **Consumer upgrades (needs-multi):**
  `computeFramingTargetBounds`/`scene-manager-a11y`/`AriaLiveRegion` (μήνυμα «N στοιχεία», νέο i18n
  `aria.live.selectionMultiple` el+en)/section highlight (`section-geometry`/`section-stencil-renderer`/
  `section-scene-sync`). **Limitations:** cross-floor multi-move→primary level· snap exclude=primary·
  centroid resize follow-up. **bim-3d 62 suites / 643 PASS** (5 νέα test files / 19 tests), tsc clean (0).
- **2026-05-31 (Opus 4.8)** — **Phase B: snap κατά το 3Δ gizmo drag (move + οριζόντιο resize)** (pending
  commit, 🔴 browser verify). Όταν σέρνεις στο 3Δ, το στοιχείο «κουμπώνει» σε χαρακτηριστικά σημεία της
  2Δ κάτοψης (endpoint/intersection/midpoint/grid) μέσω **reuse** του ΕΝΟΣ `getGlobalSnapEngine()` SSoT
  (`findSnapPoint`) — **μηδέν νέα snap λογική**. **Σχεδίαση (3 απαντήσεις Giorgio):** (1) **AutoCAD-style
  χαρακτηριστικά σημεία** — οποιαδήποτε γωνία/άκρη/μέσο του στοιχείου μπορεί να «πιάσει» στόχο· το πιο
  κοντινό κερδίζει & όλο το στοιχείο μετατοπίζεται ώστε να κουμπώσει εκεί (πηγή = `computeDxfEntityGrips`,
  το 2Δ grip SSoT). (2) snap **και στο resize** (οριζόντιο). (3) **μικρός 3Δ δείκτης** (cyan square frame,
  depthTest off) στο σημείο snap. **NEW pure SSoT `bim3d-gizmo/bim3d-snap-bridge.ts`** (`makeMoveSnapFn`
  πολλαπλό-grab nearest-wins + `makeResizeSnapFn` άμεσο handle + `SnapFn`/`SnapResolution`/`SnapQueryEngine`
  τύποι· δομικά συμβατό με `ProSnapEngineV2` → fake engine στα tests). **bridge μένει pure:** `setSnapFn`
  injected callback, `applySnap()` διορθώνει `liveTranslation` (gizmo follow ΚΑΙ outcome κουμπώνουν δωρεάν,
  χωρίς διπλό υπολογισμό)· `rawTranslation` ξεχωριστά για change-detection (snapped τιμή «παγώνει» μέσα
  στο tolerance)· `getActiveSnapWorld()` για marker· **rotate + κατακόρυφο (axis-Y) resize ΔΕΝ κάνουν
  snap**. **OSNAP toggle σεβαστό:** `engine.getSettings().enabled` false → `snapFn=null` (+ `findSnapPoint`
  ήδη `found:false` όταν off). Marker στο `bim-gizmo-overlay` (`showSnapMarker`/`hideSnapMarker`,
  screen-constant, hide σε end/cancel/setVisible-false). Wiring: `onEditPointerDown`→`buildDragSnapFn`→
  `controller.setSnapFn`→bridge· `updateDrag` οδηγεί τον marker. 6 source (5 MOD gizmo + handler, 1 NEW
  snap-bridge) + 2 test (snap-bridge 7 + drag-bridge +4) + constants. 57/57 gizmo PASS, tsc clean. **⚠️
  Latent:** το engine παίρνει viewport/scene από το 2Δ `useGlobalSnapSceneSync` (CanvasSection)· σε 3Δ το
  tolerance/scene προέρχεται από το 2Δ viewport — αν το engine είναι άδειο σε 3Δ, snap degrades gracefully
  (κανένα snap, ελεύθερο drag)· follow-up αν χρειαστεί 3Δ→engine scene push (ΟΧΙ σε αυτή τη φάση).
- **2026-05-31 (Opus 4.8)** — **Phase B: resize ΟΛΩΝ των τύπων (wall / beam / slab) + κατακόρυφος
  άξονας-Y** (pending commit, 🔴 browser verify) — κλείνει το «❌ Υπόλοιπο Phase B» της προηγούμενης
  entry. **Πρότυπο Revit (σημασία λαβών):** Τοίχος X/Z→πάχος, Y→ύψος (μήκος ΜΟΝΟ από grips, ΟΧΙ gizmo)·
  Δοκάρι X/Z→πλάτος διατομής, Y→**depth** (κατακόρυφο δομικό βάθος, ΟΧΙ `height`)· Κολώνα X→width,
  Z→depth, Y→height· Πλάκα **ΜΟΝΟ** Y→thickness (footprint per-vertex σε 2Δ). **NEW SSoT στο
  `bim3d-resize-bridge.ts`:** `computeWallResizeParams` / `computeBeamResizeParams` /
  `computeSlabResizeParams` + axis-Y branch στο `computeColumnResizeParams`. **Κρίσιμα unit contracts
  (3 διαφορετικά ανά 2D grip SSoT):** column `resize*` διαιρεί `/mmScaleFor`→περνά
  `toCanvasDelta(deltaMm, mmScaleFor)`· beam `resizeWidth` προσθέτει `delta·perp` ΑΠΕΥΘΕΙΑΣ σε mm→περνά
  **raw `deltaMm`** (ο 2D caller περνά canvas = latent bug σε metre scenes, ΔΕΝ αντιγράφεται)· wall
  `resizeThickness` είναι absolute-frame (grip ΠΑΝΩ στην όψη) → ΑΚΑΤΑΛΛΗΛΟ για gizmo→**relative inline**
  `thickness + 2·(deltaMm·perp)` με `perpUnit`/`unitVector` από `bim/grips/grip-math` SSoT (drops `dna`
  για validator parity)· axis-Y = direct mm patch (`height/depth/thickness + deltaUpMm`, όλα κατακόρυφα
  πεδία σε mm). **NEW** `worldUpDeltaToMm` στο `bim3d-edit-math.ts` (world-Y→mm, counterpart του
  `worldDeltaToDxfDelta`)· `BridgeOutcome`/`ResizeDragMm` +`deltaUpMm`· **🐛 FIX guard reorder** στο
  `bim-gizmo-drag-bridge.getOutcome()` (καθαρά κατακόρυφο drag, `deltaMm=0`, επέστρεφε `none` πριν το
  resize block → τώρα resize-first guard ελέγχει `deltaMm.x/y ΚΑΙ deltaUpMm`)· beam no-op fix (parallel
  drag → perp 0 → `resizeWidth` επιστρέφει fresh-object-same-width → short-circuit στο unchanged
  `width`). `RESIZE_HANDLES_BY_TYPE` (`bim-gizmo-overlay.ts`): column/wall/beam = resize-x/z/y, slab =
  resize-y. `buildResizeCommand` (`bim3d-edit-interaction-handlers.ts`) dispatch per `entity.type` →
  `Update{Column,Wall,Beam,Slab}ParamsCommand`. 6 source files, μηδέν άγγιγμα σε `bim/walls|beams|slabs|
  columns` (μόνο import των `apply*GripDrag` SSoT). **bim-3d 56 suites / 608 PASS (gizmo 41/41), tsc
  clean (0).** ❌ Επόμενη φάση: snap κατά resize + multi-select (+ Sub-Phase 1 stair).
- **2026-05-31 (Opus 4.8)** — **🐛 FIX: NaN gizmo geometry (center pyramid) → `computeBoundingSphere(): radius is NaN` κάθε frame** (Giorgio runtime: εμφανιζόταν μόλις γινόταν κλικ σε τοίχο 3Δ κι εμφανιζόταν το gizmo). Root στο `gizmo-handle-builders.ts` `buildCenterHandle`: η πορτοκαλί πυραμίδα «center» (handle σε ΟΛΕΣ τις επιλογές) χτίζει κάθετη βάση στο διαγώνιο `[1,1,1]` μέσω `[d1-d2, d2-d0, d0-d1]`· επειδή `dvec` έχει και τα 3 components ίσα → `[0,0,0]` → `/p1m` (=0) → `[NaN,NaN,NaN]` → όλες οι κορυφές της πυραμίδας NaN → THREE warning κάθε frame που ζωγραφιζόταν το gizmo. Υπάρχει από το Phase A (committed 55090f56). **Fix**: robust unit κάθετο μέσω `THREE.Vector3(dvec).cross([1,0,0]).normalize()` (p2 = dvec × p1, ήδη unit). +NEW test στο `bim-gizmo-overlay.test.ts` που σαρώνει ΟΛΗ τη gizmo geometry για non-finite κορυφές. 28/28 gizmo PASS, tsc clean. 🔴 browser verify (warning φεύγει).
- **2026-05-31 (Opus 4.8)** — **🐛 FIX: column resize handles ήταν αόρατα → resize «δεν λειτουργούσε»**
  (Giorgio runtime report). Root cause στο `gizmo-geometry.ts`: το resize octahedron visual καταχωρείται
  σε **δύο** ids — `resize-x` ΚΑΙ τη mirror του `resize-m-x` — που δείχνουν στο **ίδιο** mesh. Το
  `applyActiveHandles` (`bim-gizmo-overlay.ts`) έκανε per-id `visible = ids.has(id)`· επειδή το
  `activeHandlesFor('column')` περιέχει `resize-x`/`resize-z` αλλά ΟΧΙ `resize-m-x`, λόγω σειράς
  εισαγωγής στο Map το ανενεργό `resize-m-x` έσβηνε αμέσως το ίδιο mesh (`visible=false`) → το handle
  έμενε αόρατο, άρα μη-χρησιμοποιήσιμο. Τα Phase B tests κάλυπταν projection/hit-test/bridge **όχι**
  overlay visibility → ξέφυγε. **Fix**: `applyActiveHandles` → hide-all-then-reveal (OR-semantics: ένα
  visual μένει ορατό αν ΟΠΟΙΟΔΗΠΟΤΕ id που δείχνει σ' αυτό είναι active)· το hitbox filter ήταν ήδη
  σωστό. +NEW `bim-gizmo-overlay.test.ts` (3 tests: resize-x/z ορατά για column, κρυφά για base-only,
  hitboxes hittable). 27/27 gizmo PASS, tsc clean. Η drag→command math ήταν ήδη σωστή/tested. 🔴 browser verify.
- **2026-05-31 (Opus 4.8)** — **Phase B: resize scaffold + COLUMN resize** (pending commit, 🔴 browser
  verify). Γενικό resize pipeline: `projectConstrained` resize branch (slide κατά άξονα) ·
  `BridgeOutcome.resize{axis,mode,deltaMm,cursorMm}` + getOutcome branch · controller κρατά τον gizmo
  anchored (όπως rotate) · overlay `setActiveHandles()`/`activeHandlesFor(bimType)` (per-type visibility,
  αντικαθιστά το static `PHASE_A_HANDLES`) + resize idle color. **NEW SSoT** `bim3d-resize-bridge.ts`
  (`computeColumnResizeParams` → `applyColumnGripDrag` resize-x→width / resize-z→depth, mm→canvas
  `mmScaleFor`). `dispatchOutcome` → `buildEditCommand`/`buildResizeCommand` → `UpdateColumnParamsCommand`.
  Hook wiring `setActiveHandles` ανά επιλογή. **+Boy-Scout:** pre-existing `gizmo-hit-test` readonly
  `Mesh[]`→`Object3D[]` tsc error διορθώθηκε (spread). +11 tests (resize-bridge 8 + drag-bridge resize 3),
  **30/30 gizmo+dispatcher PASS, tsc clean (0)**. ❌ Υπόλοιπο Phase B: wall(thickness/length)/beam/slab
  resize · axis-Y→elevation · endpoint snap · multi-select centroid.
- **2026-05-31 (Opus)** — GenArc gizmo port **Phase A**: 7 ported portable layers
  (`bim-3d/gizmo/`) + 3 bridge αρχεία (overlay/controller/drag-bridge) + wiring (hook +
  handlers + store selector cleanup) + auto-on-selection (Selection3DStore) + 3 test files
  (19 tests). DELETED `Bim3DEditMoveHandle` + `bim3d-edit-drag-controller`. tsc clean.
- **2026-05-31** — Sub-Phase 2 (απλό move gizmo, πλήκτρο G) — committed 9632f8d8.
- **2026-05-31** — Sub-Phase 0 + 1 (barrel + SSoT math + επεξεργάσιμο πάνελ) — committed 9632f8d8.
