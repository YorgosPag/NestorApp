# ADR-397 — BIM Grip & Glyph Behavior System (FULL SSoT) — Wall reference → Column parity

**Status**: 🟢 IMPLEMENTED (2026-05-29) — Phases 1+2+3 DONE, 325/325 tests PASS, tsc clean. D5 (persistence-store register) deferred (no ColumnPropertiesTab consumer yet). Pending commit.
**Date**: 2026-05-29
**Category**: Drawing System / DXF Viewer / BIM
**Author**: Giorgio Pagonis + Claude (Opus 4.8)
**Related ADRs**: ADR-040 (canvas perf / micro-leaf), ADR-294 (SSoT ratchet), ADR-358 (stair), ADR-363 (BIM wall drawing + corner/hot-grips — **primary reference**), ADR-375 (BIM line weights / V/G), ADR-382 (visibility resolver), ADR-393 (stair extended grips)

---

## 1. Context

Ο Giorgio ζήτησε **βαθιά μελέτη** του BIM **τοίχου**: ποια χερούλια (grips) έχει, το **σημάδι μετακίνησης** (move glyph) και **περιστροφής** (rotation glyph), και τις **συμπεριφορές όλων** των grips/σημαδιών. Μετά τη μελέτη: να γραφτεί ADR με αυτές τις συμπεριφορές, και να εφαρμοστεί **η ίδια ακριβώς λογική στις κολώνες**.

Απαίτηση: **FULL SSoT** — όλα τα entities να κοιτούν **μία και μοναδική πηγή αλήθειας** για grip glyphs, click-count behavior, και grip math. Όχι copy-paste τοίχου → κολώνας.

Αυτό το ADR τεκμηριώνει το **πλήρες behavior του τοίχου** (η de-facto canonical εμπειρία), εντοπίζει τη διπλοτυπία που εμποδίζει το FULL SSoT, και ορίζει το decision: **γενίκευση** του wall hot-grip/glyph συστήματος σε shared BIM grip-behavior SSoT, μετά **wiring** της κολώνας.

---

## 2. Wall Grip Catalog (η canonical συμπεριφορά)

**SSoT type**: `WallGripKind` — `hooks/grip-types.ts:95-106`.
**Positions SSoT**: `getWallGrips(entity)` — `bim/walls/wall-grips.ts:101-273`.

| `WallGripKind` | Δράση | Glyph | Position source | Hot-grip op |
|---|---|---|---|---|
| `wall-start` | translate άξονα start | square | `project2D(params.start)` (raw param) | — (press-drag) |
| `wall-end` | translate άξονα end | square | `project2D(params.end)` | — |
| `wall-midpoint` | translate ΟΛΟΥ του τοίχου | **move (4-arrow)** | αριθμητικό midpoint start/end | **`move` (3-click)** |
| `wall-thickness` (±perp) | resize πάχους συμμετρικά | square | midpoint `geometry.outerEdge`/`innerEdge` | — |
| `wall-corner-{start,end}-{pos,neg}` | γωνία 2-DOF ασύμμετρη | square | vertex `geometry.outer/innerEdge` | **`corner` (2-click)** |
| `wall-rotation` | rotate ΟΛΟΥ γύρω από pivot | **rotation (curved arrow)** | midpoint +perp face (από geometry) | **`rotate` (6-click)** |
| `wall-curve` | move Bezier control point | square | `project2D(params.curveControl)` | — |
| `wall-vertex-${n}` | translate interior vertex N | square | `project2D(verts[i])` | — |

### 2.1 Straight-wall suppression (Phase 1C-ter)
`suppressRedundantStraightGrips()` — `wall-grips.ts:291-302`. Ίσιος τοίχος **εμφανίζει 6 grips**: midpoint (move) + 4 corners + rotation. Suppressed (αλλά computed): start, end, ±thickness. Οι 4 corners κατέχουν και τους δύο άξονες.
- straight → 6 grips · curved → 5 (start/end/mid/thickness/curve) · polyline → 4 + (N-2) interior.

---

## 3. Glyph SSoT (move & rotation σημάδια)

**Drawing primitives — ήδη SSoT, μηδέν διπλοτυπία:**

| Concern | File | Notes |
|---|---|---|
| `GripShape` union (`square`/`circle`/`diamond`/`move`/`rotation`) | `rendering/grips/types.ts:41-47` | Single def, όλα τα entities import |
| `renderMoveGlyph()` | `rendering/grips/GripShapeRenderer.ts:240-265` | **4-way arrow**: δύο crossed lines + filled arrowheads· arm=`max(5,size)`, head=`max(2.5,size*0.5)`· temperature color |
| `renderRotationGlyph()` | `rendering/grips/GripShapeRenderer.ts:267-295` | **~270° curved arc** (-π·0.75 → π·0.9) + filled arrowhead στο CCW tangent· radius=`max(5,size*0.9)` |
| Shape dispatch | `systems/phase-manager/renderers/GripPhaseRenderer.ts:186` | `grip.shape ?? 'square'` |

**Per-entity kind→shape mapping — ΔΙΠΛΟΤΥΠΙΑ (το πρόβλημα του FULL SSoT):**
- `wallGripGlyphShape(kind)` — `bim/walls/wall-grips.ts:63-72`
- `stairGripGlyphShape(kind)` — `bim/stairs/stair-grips.ts:64`
- **`columnGripGlyphShape` — ΔΕΝ ΥΠΑΡΧΕΙ** (γι' αυτό οι κολώνες δείχνουν plain squares).

Κάθε renderer κάνει `shape: xGripGlyphShape(g.xGripKind)` στο `getGrips()` (`WallRenderer.ts:146`, `StairRenderer.ts:184`). Η κολώνα **δεν περνά καθόλου `shape`** (`ColumnRenderer.ts:414-432`).

---

## 4. Glyph color temperature (hover/drag feedback)

**SSoT resolver**: `rendering/grips/grip-temperature.ts → resolveGripTemperature(entityId, gripIndex, { hovered, active, dragging })` — η ΜΟΝΗ υλοποίηση της προτεραιότητας hot/warm/cold (pure, unit-tested, exported από `rendering/grips/index.ts`). `GripPhaseRenderer.getGripTemperature()` ΔΕΝ ξανα-υλοποιεί τη λογική· κάνει map το phase-manager naming (`{hoveredGrip, selectedGrip, dragginGrip}`) → canonical (`{hovered, active, dragging}`) και delegate:
- `hot` (κόκκινο `#FF0000`, size ×1.5) — `active` grip (`selectedGrip ?? dragginGrip`): πατημένο/υπό-drag grip μένει HOT για όλη την πράξη
- `warm` (πορτοκαλί `#FF7F00`, ×1.25) — grip σε hover (1s warm-up timer)
- `cold` (μπλε, ×1.0) — αλλιώς

Hover state SSoT: `hoveredGrip` στο `hooks/grips/useUnifiedGripInteraction.ts` (throttle 100ms non-drag) → `buildGripInteractionState()` → `DxfGripInteractionState`. **Entity-level** hover (outline) είναι ξεχωριστό: `systems/hover/HoverStore.ts` (ADR-040 micro-leaf). Διαφορετικά concerns, όχι διπλοτυπία.

---

## 5. Hot-Grip click-click FSM (ADR-363 Phase 1G) — το «behavior» των σημαδιών

**SSoT (σήμερα wall-specific)**: `hooks/grips/wall-hot-grip-fsm.ts` — pure, zero React, unit-tested.

| Grip | Op | Entry step | Clicks | Roή |
|---|---|---|---|---|
| 4 corners | `corner` | `tracking` | **2** | click grip (=anchor) → click commit |
| `wall-midpoint` | `move` | `await-base` | **3** | click glyph → pick base → track → click commit |
| `wall-rotation` | `rotate` | `await-base` | **6** | click glyph → centre → ref-start → ref-end → align-start → align-end |

Types: `WallHotGripOp = 'corner'|'move'|'rotate'` (line 40), `HotGripStep = 'await-base'|'tracking'|'await-ref-start'|'await-ref-end'|'await-align-start'|'await-align-end'` (line 77).
Step engine: `hotGripOpForKind()` (43), `initialHotGripStep()` (86), `advanceHotGripStep()` (99-111).
- `corner`: tracking (terminal)
- `move`: await-base → tracking (terminal)
- `rotate`: await-base → await-ref-start → await-ref-end → await-align-start → await-align-end (terminal)

**Mouse routing**: `hooks/grips/grip-mouse-handlers.ts` — `runGripMouseDown` (120) entry via `resolveHotGripMouseDown`· `runGripMouseUp` (318) → `resolveHotGripMouseUp` → `'arm'|'stay'|'advance'|'commit'|'none'`. Το `movedSinceArm` flag ξεχωρίζει deliberate click από το double-fire mouseup artifact (canvas+container pair).
**Multi-step picks**: `hooks/grips/grip-hotgrip-actions.ts` — `advanceHotGripPick`, `commitRotateReference`.
**Rotate context bridge**: `bim/walls/wall-rotate-hotgrip-store.ts` — singleton `{pivot, anchor}` (ο generic dispatcher περνά μόνο `(grip, delta)`).
**Live preview**: `hooks/grips/grip-projections.ts` — `buildRotateReferencePreview` (dashed ref line + align line + rotating ghost).

Όλα τα υπόλοιπα grips = **press-drag-release** (`hotGripOpForKind` → null).

---

## 6. Ctrl-Copy στο final move click (ADR-363 Phase 1G.4)

**`CtrlKeyTracker`** — `keyboard/CtrlKeyTracker.ts`: singleton, capture-phase window listeners (Control + Meta), `getSnapshot(): boolean`. Χρειάζεται γιατί το `mouseup` που commit-άρει χάνει το native `ctrlKey` μέχρι το async commit.

Trigger — `grip-mouse-handlers.ts:368`:
```typescript
if (hotOp === 'move' && activeGrip.wallGripKind === 'wall-midpoint' && CtrlKeyTracker.getSnapshot()) {
  commitWallCopy(activeGrip, delta, dxfCommitDeps);   // AutoCAD MOVE→COPY
} else {
  commitDxfGripDragModeAware(activeGrip, delta, dxfCommitDeps, GripModeStore.getSnapshot());
}
```
`commitWallCopy` (`hooks/grips/grip-parametric-commits.ts:161`) → `applyWallGripDrag` translated params → `buildWallEntity` (νέο enterprise ID) → **`addWallToScene`** (`bim/walls/add-wall-to-scene.ts`). Το `addWallToScene` είναι **SSoT insertion** — το ίδιο καλεί ο draw tool (`useSpecialTools.ts:326`) και το Ctrl-COPY. Broadcast `drawing:entity-created` → `useWallPersistence` → Firestore.

---

## 7. ESC incremental back-step (ADR-363 Phase 1H)

**Priorities SSoT**: `systems/escape-bus/escape-priority.ts` (raw numbers forbidden).
```
900 DYNAMIC_INPUT
800 POPOVER_DROPDOWN     (ribbon dimension widget revert)
525 WALL_ALIGNMENT_BACK  ← useWallTool.ts:229
500 DRAW_TOOL            (generic cancel)
450 GRIP_DRAG            ← useCanvasEscapeRegistrations.ts:109 → handleGripEscape()
```
`backToAwaitingEnd()` (`hooks/drawing/useWallTool.ts:221`): στο `awaitingAlignment` → πίσω σε `awaitingEnd` (όχι deactivate). Στο 525 νικά το generic 500. `handleGripEscape()` (`useUnifiedGripInteraction.ts:310`) → `resetToIdle()` για drag & hotGrip.

---

## 8. Length editable field + Canvas↔mm SSoT

**Length math SSoT**: `bim/walls/wall-length-edit.ts` — `getWallLengthMeters` (28), `setWallLengthMeters` (44, μετακινεί end κατά `unitAxis`, κρατά start+bearing — Revit location-line). UI: `ui/ribbon/components/RibbonWallDimensionWidget.tsx` (length/height/thickness CONFIGS, debounce 200ms, blur/Enter immediate).

**Canvas↔mm SSoT**: `utils/scene-units.ts:mmScaleFor()` (= `mmToSceneUnits(params.sceneUnits ?? 'mm')`), 14+ consumers. Inverse `canvasToMmScaleFor`. Drag transforms (`bim/walls/wall-grip-transforms.ts`): `resizeThickness` (182), `moveCorner` (224), `rotateWall` (152). **Params**: start/end/curveControl σε canvas space· thickness/height σε mm.

**⚠️ Latent bug εντοπίστηκε**: `RibbonWallDimensionWidget` height/thickness configs διαβάζουν `w.params.height / 1000` απευθείας (γραμμές 87-88) αντί `mmScaleFor` — σωστό μόνο όταν `sceneUnits==='mm'`, λάθος σε metre scenes. (Flag, εκτός scope αυτού του ADR — βλ. §13.)

---

## 9. THE INVARIANT — geometry SSoT, never re-derive

Κάθε entity: `applyXxxGripDrag()` επιστρέφει **μόνο νέα params** → `UpdateXxxParamsCommand.execute()` καλεί `computeXxxGeometry()` → geometry ξαναγράφεται atomically. Grip positions του επόμενου render διαβάζονται από τη **φρεσκο-γραμμένη geometry**, ΠΟΤΕ re-derive από raw mm params. (Walls το παραβίαζαν → off-screen rotation grip σε metre scenes· fixed — `wall-grips.ts:209-215`.)

Wall: `applyWallGripDrag` (`wall-grip-transforms.ts:85`) → `UpdateWallParamsCommand.applyPatch` (`core/commands/entity-commands/UpdateWallParamsCommand.ts:59`) → `computeWallGeometry` (`bim/geometry/wall-geometry.ts:71`). Single caller.

---

## 10. Shared grip architecture (3-layer funnel)

1. **Layer 1 — dispatch**: `computeDxfEntityGrips(entity)` (`hooks/grip-computation.ts:123`) — switch σε `entity.type` → `getXxxGrips()`.
2. **Layer 2 — data type**: `GripInfo` (`hooks/grip-types.ts:263`) — union optional discriminators (`wallGripKind?`, `stairGripKind?`, `columnGripKind?`, …)· `wrapDxfGrip()` (`grip-registry.ts:26`) → `UnifiedGripInfo`.
3. **Layer 3 — per-entity 3-file split**: positions / math / transforms ανά entity. **Δεν υπάρχει shared base class/factory** — sharing είναι structural (ίδιο `GripInfo`, ίδιο pattern, ίδιο command), όχι abstraction.

---

## 11. Column gap analysis (τι ΛΕΙΠΕΙ vs wall)

**Type**: `ColumnKind` 7 (rectangular/circular/L/T/polygon/shear-wall/I) — `bim/types/column-types.ts:47`. Geometry SSoT: `computeColumnGeometry` (`bim/geometry/column-geometry.ts`). Grips: `getColumnGrips`/`applyColumnGripDrag` (`bim/columns/column-grips.ts`).

| Column grip | index | type | σήμερα glyph |
|---|---|---|---|
| `column-center` (translate) | 0 | center, `movesEntity:true` | **plain square** (έπρεπε move) |
| `column-rotation` | 1 | vertex | **plain square** (έπρεπε rotation) |
| `column-width` | 2 | vertex | square |
| `column-depth` | 3 | vertex (skip circular/polygon) | square |
| variant (`column-arm-*`/`flange-*`/`web-*`/`i-*`) | 4-5 | edge | square |

| Feature | Column | Wall |
|---|---|---|
| Move glyph (4-arrow) σε translate | **❌** | ✅ `wall-midpoint` |
| Rotation glyph σε rotation handle | **❌** | ✅ `wall-rotation` |
| `xxxGripGlyphShape()` | **❌ MISSING** | ✅ `wallGripGlyphShape` |
| Hot-grip FSM (2/3/6-click) | **❌ MISSING** | ✅ `wall-hot-grip-fsm.ts` |
| Rotate hot-grip context store | **❌ MISSING** | ✅ `wall-rotate-hotgrip-store.ts` |
| Ctrl-COPY | **❌ MISSING** | ✅ `commitWallCopy` + `addWallToScene` |
| `BimPersistenceStateStore` register | **❌ MISSING** | ✅ `WallPersistenceHost.tsx:84` |

Shared seams ήδη: `BaseEntityRenderer`, `resolveIsEntityVisible` (ADR-382), `resolveSubcategoryStyle`/`resolveVgFillTint` (ADR-375), `GripInfo`/`GripShape`, `GripShapeRenderer` (η κολώνα ΔΕΝ το connect-άρει), `computeColumnGeometry`.

---

## 12. Decision — FULL SSoT generalization (όχι copy-paste)

Ο Giorgio θέλει «όλα να κοιτούν την μία πηγή». Επομένως **δεν** αντιγράφουμε wall→column. Γενικεύουμε:

### D1 — Shared glyph mapping SSoT
Νέο `bim/grips/grip-glyph-shape.ts`: ενιαία mapping συμπεριφορά. Επειδή τα kind unions διαφέρουν, χρησιμοποιούμε **declarative table per entity** (semantic role → shape): `{ translate→'move', rotate→'rotation', else→'square' }`. Τα `wallGripGlyphShape`/`stairGripGlyphShape` γίνονται thin wrappers ή αντικαθίστανται. Νέο `columnGripGlyphShape` παράγεται από το ίδιο SSoT. Καμία τρίτη copy.

### D2 — Shared hot-grip FSM SSoT
Γενίκευση `wall-hot-grip-fsm.ts` → `hooks/grips/bim-hot-grip-fsm.ts` (entity-agnostic: op = `corner|move|rotate`, ίδιο step engine). `hotGripOpForKind` γίνεται registry: ανά entity ένα map `gripKind → op`. Wall + Column (+ μελλοντικά stair/beam/slab) καταναλώνουν το ίδιο engine. `WallRotateHotGripStore` → γενικό `BimRotateHotGripStore` (ή entity-keyed).

### D3 — Shared grip math SSoT (εκκαθάριση flagged duplication)
`project2D`/`perpUnit`/`unitAxis`/`moveCorner` (decompose-recenter) διπλά σε wall/beam/stair (ADR-393 §8.2 pending-ratchet). Εξαγωγή σε `bim/grips/grip-math.ts`. Column transforms το καταναλώνουν αντί νέας copy.

### D3.1 — Shared centred rotatable-box grip SSoT (2026-06-03, ADR-408 Φ3)
**Επέκταση του D3** σε ΟΛΟΚΛΗΡΗ τη δομή grip για **point-based centre-anchored ορθογώνια**. Πριν, το `mep-fixture-grips.ts` (ADR-406, rectangular) και το `electrical-panel-grips.ts` (ADR-408 Φ3) είχαν **~200 γραμμές byte-identical** grip math (`cornerWorld`/`rotationHandleWorld`/`moveCentre`/`rotateAboutCentre`/`resizeCorner`). Εξαγωγή σε **NEW `bim/grips/centred-box-grips.ts`** (`getCentredBoxGrips` + `applyCentredBoxGripDrag`, entity-agnostic ROLE `'move'`/`'rotation'`/`'corner-*'`, παραμετρικό `minDimensionMm`, επιστρέφει `CentredBoxPatch | null`). Κάθε entity = **thin role↔kind adapter** (~90 γρ., κρατά μόνο τα entity-specific grip-kind strings που χρειάζονται τα union/registries). Το **fixture** delegate-άρει το rectangular path + κρατά μόνο το `circular`/`diameter` extension που δεν έχει box equivalent· ο **πίνακας** delegate-άρει 100%. Future point-based rectangular MEP elements opt-in με νέο adapter, μηδέν copy. **Boy-Scout N.0.2** — το διπλότυπο εντοπίστηκε ΑΠΟ τον Giorgio σε review και κεντρικοποιήθηκε επιτόπου. 11 SSoT tests + fixture/panel regression (118 PASS), tsc 0, μηδέν raw cos/sin (delegate σε D3 grip-math + canonical `rotatePoint`).

### D3.2 — Shared axis-rotation SSoT (`rotateAxisPointsAboutPivot`, 2026-06-03, ADR-363 Φ5.5d)
**Επέκταση του D3** για τα **axis-based** entities (τοίχος/δοκάρι — `start`/`end`/`curveControl` σημεία, σε αντίθεση με τα centre-anchored ορθογώνια του D3.1). Πριν, το `rotateWall` (`wall-grip-transforms.ts`) είχε inline το pattern «anchor-relative swept angle → rotate κάθε σημείο γύρω από pivot» — και το νέο `rotateBeam` θα ήταν byte-για-byte το ίδιο. **N.0.2 πριν γράψω** (μάθημα D3.1): εξαγωγή σε **`bim/grips/grip-math.ts` → `rotateAxisPointsAboutPivot(points[], { pivot, anchor, currentPos })`** που επιστρέφει `Point2D[] | null` (null σε degenerate swept angle ώστε ο caller να no-op-άρει διατηρώντας referential identity). Το Z δεν χειρίζεται εδώ (plan-footprint points· οι callers ξαναβάζουν το αρχικό z). **ΚΑΙ ο τοίχος (`rotateWall`) ΚΑΙ το δοκάρι (`rotateBeam`) καταναλώνουν τον ΙΔΙΟ helper** — ο τοίχος refactor-αρίστηκε να μην έχει πια inline `sweptAngleDegAboutPivot`+`rotatePoint` (αλλιώς θα έμενε μισό-SSoT). Μηδέν raw cos/sin (delegate σε `sweptAngleDegAboutPivot` + canonical `rotatePoint` ADR-188). Future axis-based rotation grips (π.χ. stair-direction) opt-in καλώντας τον ίδιο helper, μηδέν copy. Απόφαση εγκεκριμένη από Giorgio (AskUserQuestion πριν την υλοποίηση). 3 νέα SSoT tests + wall/beam regression PASS, tsc 0.

### D4 — Column wiring
- `columnGripGlyphShape` + `shape:` στο `ColumnRenderer.getGrips` (move για `column-center`, rotation για `column-rotation`).
- Column hot-grip: `column-center`→move(3-click), `column-rotation`→rotate(6-click ή 3-click απλό — βλ. Q). Routing στο `grip-mouse-handlers.ts` γενικευμένο σε entity-agnostic dispatch.
- Ctrl-COPY: `commitColumnCopy` + `addColumnToScene` SSoT (mirror `addWallToScene`· χρησιμοποιείται και από column draw tool).
- `ColumnPersistenceHost` → register στο `BimPersistenceStateStore` (D5 hygiene).

### D5 — Invariant διατήρηση
Column ήδη: `applyColumnGripDrag` → `UpdateColumnParamsCommand` → `computeColumnGeometry`. Τα νέα glyphs/hot-grips δεν παραβιάζουν το §9 invariant.

---

## 12b. Implemented files (2026-05-29)

**Phase 1 — Shared SSoT (infra):**
- NEW `bim/grips/grip-glyph-registry.ts` — `GRIP_GLYPH_REGISTRY` + `gripGlyphShape()` (D1). `wallGripGlyphShape`/`stairGripGlyphShape` → thin wrappers.
- NEW `bim/grips/grip-math.ts` — `project2D`/`perpUnit`/`unitVector`/`rotatePointAround` (D3). `wall-grip-math.ts` re-exports (wall dedup· beam/stair migration = Boy-Scout follow-up).
- NEW `bim/grips/bim-rotate-hotgrip-store.ts` — `BimRotateHotGripStore` (D2, ex-`WallRotateHotGripStore`). Old path = re-export shim. 3 importers updated.
- MOD `hooks/grips/wall-hot-grip-fsm.ts` — `HOT_GRIP_OP_REGISTRY` + `hotGripOpForKind(string)` + `hotGripKindOf(grip)` (entity-agnostic). Column kinds registered.

**Phase 2 — Column glyphs + hot-grip:**
- MOD `bim/renderers/ColumnRenderer.ts` — `getGrips` adds `shape: gripGlyphShape(g.columnGripKind)`.
- MOD `hooks/grips/grip-mouse-handlers.ts` — `wallGripKind` reads → `hotGripKindOf(grip)` (column auto-enters hotGrip).
- MOD `bim/columns/column-grips.ts` — `ColumnGripDragInput` +`currentPos?`/`pivot?` + `rotateAroundPivot()` (6-click orbit). Legacy `rotateAroundPosition` = no-pivot fallback.
- MOD `hooks/grips/grip-parametric-commits.ts` — `commitColumnGripDrag` reads `BimRotateHotGripStore` (pivot+currentPos for `column-rotation`).

**Phase 3 — Ctrl-COPY + insertion SSoT:**
- NEW `bim/columns/add-column-to-scene.ts` — append + `drawing:entity-created` (tool 'column'). `useSpecialTools.onColumnCreated` refactored to it (DRAW + COPY share one routine).
- MOD `grip-parametric-commits.ts` — `commitColumnCopy` (mirror `commitWallCopy`) + `commitHotGripCopy` entity-agnostic dispatcher.
- MOD `grip-mouse-handlers.ts:368` — Ctrl-COPY block → `commitHotGripCopy` (no per-entity branching).

**Tests:** 325/325 PASS (grips + columns + walls). NEW: `grip-glyph-registry.test.ts`, `grip-math.test.ts`, `add-column-to-scene.test.ts` + column rotate-pivot + FSM column coverage.

**Deferred (not built — speculative):** D-persistence — `BimPersistenceStateStore.setColumn` register σε `ColumnPersistenceHost`. ΔΕΝ υπάρχει `ColumnPropertiesTab` consumer (μόνο Wall+Stair). Θα προστεθεί όταν/αν δημιουργηθεί column properties panel (αλλιώς = unused dead-code, knip ratchet). Core parity (glyphs/hot-grip/Ctrl-COPY) πλήρες χωρίς αυτό.

## 12c. SSoT self-audit + corrections (2026-05-29)

Μετά από αυστηρό SSoT review εντοπίστηκαν + διορθώθηκαν 3 σημεία (αποφυγή διπλοτύπων):

1. **`rotatePointAround` ήταν διπλότυπο** του κανονικού `rotatePoint` (`utils/rotation-math.ts`, ADR-188 — single source για rotation, χρησιμοποιείται από RotateEntityCommand / bim-rotate-geometry / array / guides / rotation tools). **Διόρθωση:** αφαιρέθηκε από `grip-math.ts`· το `column-grips.rotateAroundPivot` καλεί `rotatePoint(pos, pivot, deg)`. Καμία re-implemented cos/sin.
2. **`project2D`/`perpUnit`/axis-unit** ήταν τριπλό (wall/beam/stair, flagged ADR-393 §8.2). **Διόρθωση:** wall + **beam** → `bim/grips/grip-math.ts` SSoT. Stair ήδη delegate-άρει `perpUnit→perp` στο `stair-geometry-shared` (δικός του SSoT seam)· το `project2D` του stair μένει (trivial, module-local· πλήρης stair unify = follow-up).
3. **append+broadcast `drawing:entity-created`** ήταν scattered (addWall / addColumn / `appendAndBroadcast`). **Διόρθωση:** νέο `bim/scene/append-entity-to-scene.ts` SSoT· `addColumnToScene` + `useSpecialTools.appendAndBroadcast` (slab/beam) delegate σε αυτό. `addWallToScene` παραμένει bespoke (trim-recompute πάνω σε όλη τη λίστα — τεκμηριωμένη εξαίρεση).

**Bonus fix (Boy Scout):** το pre-existing stale beam-grips test "curved without control" (expected 5, η Phase 5.5b/5.5c πρόσθεσε width+depth → 6) διορθώθηκε στη σωστή συμπεριφορά (6 grips + width/depth kind checks). 526/526 tests PASS.

**Εναπομείναντα γνωστά (όχι regression ADR-397, pre-existing tech-debt):** stair `project2D` local· `opening`/`slab-opening` tools inline emit (δικό τους resolver pattern)· wall `rotateWall` inlines spin. Καταγράφονται ως Boy-Scout/ratchet follow-ups, όχι silent.

## 12d. Runtime fixes — column grips δεν δούλευαν end-to-end (2026-05-29, Giorgio test)

Ο Giorgio δοκίμασε ορθογώνια κολώνα: δεν επιλεγόταν, φαινόταν ΜΟΝΟ το move glyph, όχι rotation/width/depth. Διάγνωση (parallel Explore) αποκάλυψε **4 pre-existing bugs** που έκαναν τις κολώνες μη-λειτουργικές — το ADR-397 Phase 2 ισχυριζόταν parity αλλά τα unit tests έλεγχαν `getColumnGrips` ΑΠΟΜΟΝΩΜΕΝΑ, όχι το πλήρες interactive pipeline. Διορθώθηκαν:

1. **🔴 `computeDxfEntityGrips` (`hooks/grip-computation.ts`) δεν είχε `case 'column'`** → ο interactive grip registry έπαιρνε ΜΗΔΕΝ column grips (hover/hot-grip/drag ποτέ δεν πυροδοτούνταν· φαινόταν μόνο το render-loop move glyph). **Fix:** προστέθηκε `case 'column'` → `getColumnGrips` (mirror wall/beam). **Root cause του «μόνο move glyph».**
2. **🔴 Unit mismatch (off-screen grips)** — `params.position` σε scene-units αλλά width/depth/`ROTATION_HANDLE_OFFSET_MM` σε mm, ΧΩΡΙΣ `mmScaleFor` (η ίδια παραβίαση [[feedback_grip_positions_read_geometry]] που είχαν οι τοίχοι). Σε metre scene τα handles έπεφταν 1000× μακριά· μόνο το centroid (anchor=center, shift=0) έμενε on-screen. **Fix:** `computeCentroidWorld` + `localToWorld` (→ καλύπτει ΚΑΙ variant handles) + width/depth/rotation handle fns scale by `mmScaleFor`.
3. **🟡 Selection** — `HitTestingService.convertToEntityModel` `case 'column'` δεν είχε geometry-recompute fallback (το stair είχε)· Firestore-loaded column χωρίς `geometry` → dropped από spatial index → body-click δεν επέλεγε. **Fix:** `computeColumnGeometry(params)` fallback.
4. **🟡 Drag math** — `resizeWidth`/`resizeDepth` ανέμειγναν scene-unit delta με mm param. **Fix:** `÷ mmScaleFor` (mirror wall `resizeThickness`).

**Tests:** +2 νέα (metre-scene grip-position scaling + width-resize tracking). Existing mm tests intact (s=1 no-op).

## 12e. Live-ghost preview pipeline — η κολώνα ΕΛΕΙΠΕ από 5 layers (2026-05-29, «column rotation δεν συμπεριφέρεται σωστά»)

Ο Giorgio ζήτησε να διαβάσω ΠΟΙΟΣ κώδικας τρέχει στο rotation click τοίχου vs κολώνας. Ο **commit** μοιράζεται (`commitRotateReference`→`commitDxfGripDragModeAware`→`commitColumnGripDrag`), αλλά το **live-ghost preview pipeline** ήταν **wall-only** — η κολώνα δεν εμφάνιζε κανένα ghost κατά move/rotate/resize (ο commit δούλευε μόνο on-release → «δεν συμπεριφέρεται σωστά»). Έλειπε από **5 σημεία**, όλα διορθώθηκαν για πλήρες SSoT:

1. `apply-entity-preview.ts` (ghost SSoT) — **καμία `column` branch** (υπήρχαν wall/beam/slab/slab-opening/stair). +column parametric branch (move/rotation+pivot/resize via `applyColumnGripDrag`+`computeColumnGeometry`, mirror wall) + `case 'column'` στο movesEntity switch (toolbar Move).
2. `EntityPreviewTransform` interface — **χωρίς `columnGripKind`**. +field.
3. `grip-projections.buildRotateReferencePreview` — προωθούσε **μόνο `wallGripKind`**. +`columnGripKind`.
4. `useGripGhostPreview` — hand-picked fields, **έκοβε `columnGripKind`**. +pass-through.
5. `draw-ghost-entity.ts` (ghost renderer) — **καμία `case 'column'`** → ακόμα κι αν περνούσε το transformed column, δεν ζωγραφιζόταν. +footprint polygon (mirror beam).

Τώρα: build→preview→apply→draw όλα entity-agnostic για column. Ghost παρ === commit. +3 tests (`apply-entity-preview-column.test.ts`: move + 6-click rotation orbit + no-op). **Μάθημα:** ο commit path ≠ preview path· για πλήρη grip parity ένα entity πρέπει να είναι και στα ΔΥΟ (+ στο `computeDxfEntityGrips` + HitTestingService).

## 12f. Snap-back μετά την περιστροφή — column PERSISTENCE διέφερε από wall SSoT (2026-05-29)

Giorgio: «κάνω περιστροφή και επανέρχεται στην αρχική θέση η κολώνα. SSoT ή όχι;». **Απάντηση: ΟΧΙ** — το `useColumnPersistence` ήταν **μερικό αντίγραφο** του `useWallPersistence` template που έχασε ΔΥΟ κρίσιμα κομμάτια (το preview/commit pivot ΗΤΑΝ μία πηγή — το bug ήταν 100% persistence, όχι math):

1. **🔴 Λείπε το `lastSavedParamsRef` seed** στο Firestore subscribe callback (wall: `useWallPersistence` το έχει). Κολώνα φορτωμένη από Firestore (όχι freshly-drawn) → ποτέ «known» → auto-save gate (`lastSavedParamsRef.has(id)`) skip → ο επόμενος snapshot έβρισκε `dirty=false` → `dequal(local rotated, doc old)` false → **ξανάγραφε την παλιά un-rotated** → snap-back. **Fix:** seed loop (mirror wall).
2. **🟡 `persist()` πάντα `setDoc` (saveColumn)** αντί `isNew ? saveColumn : updateColumn(updateDoc)`. `setDoc` resets immutable `createdAt` → Firestore UPDATE rule reject → silent fail. **Fix:** isNew branch → `updateColumn` (υπήρχε ήδη στο service, απλώς δεν καλούνταν).

**Boy Scout:** Το `useBeamPersistence` είχε ΤΟ ΙΔΙΟ διπλό bug (ίδιο template· beam move/resize σε saved beam θα έκανε snap-back) → fixed κι αυτό. tsc clean. (Δεν υπάρχουν column/beam persistence unit tests — μόνο `useWallSplitPersistence.test`· το fix mirror-άρει το proven wall pattern· Firestore-mock test = follow-up.)

**Μάθημα (ενισχυμένο):** όταν κάνεις mirror ένα SSoT template (wall→column), πρέπει να αντιγραφεί ΟΛΟΚΛΗΡΟ — εδώ ο τοίχος είχε seed + isNew/updateDoc που το column-copy παρέλειψε. Partial copy = SSoT divergence = silent revert.
**Εναπομείνον (flagged):** variant **resize drag** (L/T/I `resizeArmLength`/`resizeFlangeLength`/… σε `column-variant-grips.ts`) έχει το ίδιο mm/scene mismatch — οι POSITIONS διορθώθηκαν (via `localToWorld`), το resize-drag των variants σε non-mm scenes μένει follow-up (Giorgio δοκίμασε rectangular). `calculatePriority` column case (cosmetic) deferred.

---

## 13. Out of scope / flagged
- §8 latent bug: `RibbonWallDimensionWidget` height/thickness `/1000` σε metre scenes (ξεχωριστό fix).
- Stair/Beam/Slab full hot-grip parity (μελλοντική φάση — το shared engine D2 το διευκολύνει).
- `gripState.dragginGrip` typo στο `GripPhaseRenderer` (cosmetic).

---

## 14. Resolved questions (Giorgio, 2026-05-29)
- **Q1 — Rotation behavior κολώνας**: ✅ **6-click reference flow** (πλήρης parity με τοίχο). Glyph → κέντρο → ref γραμμή → align γραμμή. Καμία απλοποίηση — ίδια ακριβώς εμπειρία σε όλα τα BIM entities.
- **Q2 — Execution mode**: ✅ **Plan Mode (single agent)**, φάση-φάση, χαμηλό κόστος.

---

## 15. Changelog
- **2026-07-01 (Opus 4.8) — §15b: ΔΕΥΤΕΡΗ ένδειξη τόξου = ΓΩΝΙΑ ΚΟΡΥΦΗΣ των 2 ενωμένων τοίχων κατά την περιστροφή (Giorgio, στιγμιότυπο 153825, UNCOMMITTED).** Ζητούμενο: όταν περιστρέφεις τοίχο ΕΝΩΜΕΝΟ με άλλον, εκτός από την ένδειξη #1 (πόσο **γύρισε** ο τοίχος ως προς την αρχική θέση — υπάρχει ήδη, §15/direction-arc) να βλέπεις ΚΑΙ ένδειξη #2 = η **πραγματική γωνία κορυφής** που σχηματίζουν οι δύο **ΑΞΟΝΕΣ** αυτή τη στιγμή (90°→60°→30°→120° ζωντανά). **Απόφαση Giorgio (AskUserQuestion):** ίδιο 🟢/🔴 στυλ με την περιστροφή. **Λύση (FULL SSoT, μηδέν νέος paint):** επαναχρήση ΟΛΟΚΛΗΡΟΥ του `paintDirectionArc` — η #2 = **δεύτερη κλήση** του με pivot=κόμβος ένωσης, anchor=σημείο στον άξονα του ΓΕΙΤΟΝΑ (σταθερή αναφορά), cursor=σημείο στον ΖΩΝΤΑΝΟ άξονα του περιστρεφόμενου τοίχου, sweepDeg=signed γωνία μεταξύ των outward directions (=γωνία κορυφής· 90° L, 180° ευθεία). NEW pure `bim/walls/wall-rotation-neighbor-angle.ts` (`resolveNeighborAxisAngle`): σαρώνει και τα 2 άκρα του περιστρεφόμενου έναντι κάθε άκρου γείτονα, junction όταν εντός **SSoT `JOIN_THRESHOLD_MM`** (ίδιο κατώφλι με τον trim-solver + το §wall-joint-miter-preview → «ό,τι θα ένωνε το commit»)· ενωμένος και στα 2 άκρα → κερδίζει ο κόμβος ΠΛΗΣΙΕΣΤΕΡΑ στο rotation pivot (η γωνία που περιστρέφεις). Radius = 35% του live μήκους τοίχου (proportional, σταθερό ανεξ. περιστροφής, διακριτό από #1). Wiring: `useGripGhostPreview` — 1 block ΜΕΤΑ το `transformed` (live rotated wall params → η γωνία ενημερώνεται ζωντανά)· no-op όταν ελεύθερος τοίχος (χωρίς γείτονα) ή όχι περιστροφή. **Files: 1 NEW pure + 1 MOD** (`useGripGhostPreview.ts`: +import +block) **+ 1 NEW test** (`wall-rotation-neighbor-angle.test.ts`, 6/6: 90°/30° magnitude, sign CCW, free→null, both-ends→prefer-near, guard). Ghost/walls suites GREEN (⚠️2 pre-existing MTEXT text-resize failures, αμετάβλητα αρχεία, άσχετα). tsc SKIP (N.17). Co-staged **ADR-040** (CHECK 6D — `useGripGhostPreview`). ✅ Google-level: YES — reuse ολόκληρου του direction-arc paint (μηδέν νέος μηχανισμός/χρώμα), SSoT `JOIN_THRESHOLD_MM` neighbour detection, pure resolver, live (cursor-driven), no-op-safe. 🔴 browser-verify (περίστρεψε ενωμένο τοίχο → 2 τόξα: #1 περιστροφή + #2 γωνία κορυφής ζωντανά· ελεύθερος τοίχος → μόνο #1) + commit.
- **2026-07-01 (Opus 4.8) — SSoT relocation + κοινή χρήση στο WALL DRAWING (Giorgio «εφάρμοσε τα τόξα και στον τοίχο»).** Το direction-arc painter ανήκει πλέον σε **2 features** → μετακινήθηκε στο σωστό SSoT σπίτι: `hooks/tools/rotation-direction-arc.ts` → **`canvas-v2/preview-canvas/direction-arc-paint.ts`** (γενικά ονόματα: `paintDirectionArc`/`resolveDirectionArc`/`resolveDirectionArcColor`/`DirectionArc`/`DIRECTION_ARC_MIN_SWEEP_DEG`· το «rotation» στο όνομα ήταν παραπλανητικό για wall). Το `useGripGhostPreview` (rotation) εισάγει πλέον από εκεί (μηδέν αλλαγή συμπεριφοράς). **Wall reuse (wall drawing):** μετά το 1ο κλικ του τοίχου (`drawing-hover-handler`, `activeTool==='wall'` + `lastRefPt`), ΙΔΙΟ τόξο/χρώμα/βελάκι/baseline/μοίρες με **άξονα αναφοράς τον world-X** — `bearingDeg = atan2(dy,dx)` (world Y-up → πάνω από τον x-άξονα 🟢, κάτω 🔴, η αρχική προδιαγραφή). Renderer-side wiring: NEW `PreviewRenderer.drawDirectionArc` + `PreviewCanvas` handle (μοτίβο `drawWallHud`). 10 jest (μετακινημένα + renamed). Co-staged ADR-040. (Η §wall εγγραφή στο ADR-508 παραλείφθηκε σκόπιμα — εκείνο το αρχείο έχει ξένη uncommitted §end-reference δουλειά· το feature τεκμηριώνεται εδώ + ADR-040.) 🔴 browser-verify + commit.
- **2026-07-01 (Opus 4.8) — Direction arc refinement (Giorgio, 2ο στιγμιότυπο): σβήσιμο λευκού pill + χρωματιστές μοίρες + baseline 0°.** (i) **Αφαιρέθηκε το λευκό readout pill** (`drawDimPill(formatMoveAngle(rotateSweepDeg))`) από το `useGripGhostPreview` rotation branch — ήταν το μόνο label με λευκό φόντο (το POLAR tracking tooltip είναι γκρι ΧΩΡΙΣ φόντο, ανήκει σε άλλη uncommitted δουλειά, ΔΕΝ το άγγιξα). Νεκρό `ROTATE_READOUT_OFFSET_PX` διαγράφηκε (CHECK 3.22). (ii) Το `(+)/(−)` glyph **αντικαταστάθηκε από ΧΡΩΜΑΤΙΣΤΗ ζωντανή γωνία** (signed, **2 δεκαδικά** μέσω `formatAngleLocale(sweepDeg, 2)` SSoT): 🔴 κόκκινη όταν `<0`, 🟢 πράσινη όταν `≥0` (ίδιο `resolveRotationArcColor`). Το πρόσημο («−») + οι μοίρες δεξιά του, στη διχοτόμο. (iii) **NEW διακεκομμένη baseline 0°** (`drawBaseline`, pivot→άξονας αναφοράς στην ακτίνα του τόξου, ουδέτερο ημιδιάφανο λευκό) — δείχνει το σημείο έναρξης μέτρησης γωνιών (Giorgio «ροζ 1»). `RotationDirectionArc` += `labelPos` (rename από `signGlyphPos`) + `baselineEnd`. 10 jest (+baseline geometry: ακτινική απόσταση = radius, κατεύθυνση = refAngle, και σε λοξό άξονα). 🔴 browser-verify + commit.
- **2026-07-01 (Opus 4.8) — Ένδειξη ΦΟΡΑΣ περιστροφής: χρωματισμένο τόξο + βελάκι + (+)/(−) glyph (Giorgio «Revit/Maxon/Figma-grade, FULL SSoT»).** Κατά το hot-grip rotate (αφού οριστεί κέντρο), εμφανίζεται **τόξο φοράς** από τον άξονα αναφοράς (pivot→`anchorPos`) προς τον κέρσορα (`rotateReadoutAnchor`), χρωματισμένο ανά **πρόσημο της γωνίας sweep**: `rotateSweepDeg > 0` (CCW, ανεβαίνει) → 🟢 πράσινο + βελάκι + `(+)`· `< 0` (CW, κατεβαίνει) → 🔴 κόκκινο + βελάκι + `(−)`. Οι live signed μοίρες ζωγραφίζονται ΗΔΗ από το readout pill (`formatMoveAngle`). **SSoT audit (grep) ΠΡΙΝ γραφτεί κώδικας — μηδέν διπλότυπα:** χρώμα 🟢/🔴 από το **`resolveGhostStatusColor`** (`bim/ghosts/ghost-status-color.ts`, `beam`=`#2e9e44`/`overlap`=`#d23b3b` — μηδέν hardcode hex)· signed sweep + γωνία από το υπάρχον `rotateSweepDeg` (`grip-projections.rotateSweepDegFromDirs`, +CCW/−CW)· προβολή world→screen από `CoordinateTransforms.worldToScreen`· pivot ⊙ από `drawRotationPivotMarker` (ήδη). Δεν υπήρχε εξαγόμενο ελαφρύ single-arrowhead primitive (`renderArrowhead`=dim-block heavyweight, `drawMemberLoadArrows`=UDL band/internal) → μικρό arrowhead στο νέο pure helper (ίδιο μοτίβο γεμάτου τριγώνου με τα UDL βέλη). Το `drawAngleArc` (endpoint-reshape) ΔΕΝ είναι reusable (σταθερό neutral χρώμα, ξεκινά στον +X, σταθερή ακτίνα) → διακριτό. **Απόφαση Giorgio (AskUserQuestion):** πρόσημο/χρώμα ως προς τον **άξονα αναφοράς** (sign(`rotateSweepDeg`)), ΟΧΙ world-X — ώστε να ισχύει και σε λοξό άξονα. **Decoupling:** η ΦΟΡΑ σχεδίασης του τόξου στην οθόνη υπολογίζεται από screen θέσεις (Y-flip safe), το ΧΡΩΜΑ από το world sweep — διακριτές ευθύνες. **NEW pure `canvas-v2/preview-canvas/direction-arc-paint.ts`** (`resolveRotationDirectionArc` geometry + `resolveRotationArcColor` + `paintDirectionArc`, ADR-040 micro-leaf safe: zero React/stores/DOM-state)· wiring στο `useGripGhostPreview` rotation branch ΜΕΤΑ το readout pill (απλή προσθήκη, μηδέν αλλαγή στο POLAR+AutoAlign overlay). 9 jest (πρόσημο→χρώμα + screen-space φορά/clamp/decoupling). Co-staged: **ADR-040** (CHECK 6D — `useGripGhostPreview`). 🔴 browser-verify (επίλεξε οντότητα → λαβή περιστροφής → όρισε κέντρο → γύρνα πάνω → 🟢 τόξο+(+)+θετικές μοίρες· κάτω → 🔴 τόξο+(−)+αρνητικές μοίρες) + commit (git add ΜΟΝΟ δικά μου).
- **2026-07-01 (Opus 4.8) — POLAR + AutoAlign ίχνη κατά την ΠΕΡΙΣΤΡΟΦΗ (Giorgio «FULL SSoT»).** Στη σχεδίαση τοίχου εμφανίζονται πορτοκαλί POLAR + λευκή AutoAlign γραμμή· στην **περιστροφή** ΟΧΙ (παρόλο που F10/AutoAlign on). **Ρίζα (SSoT audit):** το alignment-tracking resolve ζούσε **inline μόνο** στο `drawing-hover-handler.processDrawingHover`· η περιστροφή (`useGripGhostPreview`) ποτέ δεν το καλούσε — διαφορετικό pipeline, ίδιο PreviewCanvas ctx. **FULL SSoT fix (μηδέν παράλληλη μηχανή):** (i) εξαγωγή του block → NEW **`systems/tracking/resolve-alignment-tracking.ts`** (`resolveAlignmentTracking`)· το drawing handler το καλεί αντί inline (byte-parity, καθαρισμός 3 αχρησιμοποίητων imports). (ii) NEW **`hooks/tools/rotation-tracking-overlay.ts`** (`resolveRotationTracking` + `paintRotationTracking`) που αλυσιδώνει τα ΙΔΙΑ primitives με τη σχεδίαση: `resolveOrthoPolarStep` POLAR/ORTHO angle-lock **γύρω από το pivot** → `resolveAlignmentTracking` override (ίδια σειρά/προτεραιότητα) → paint με τους ΙΔΙΟΥΣ `paintPolarTrackingLine`/`paintAlignmentPaths`/`paintIntersections`/`paintTooltip`. (iii) wiring στο `useGripGhostPreview` rotation cursor-driven branch: ο polar/alignment-locked cursor τροφοδοτεί το `resolveLiveRotationFromCursor` sweep → **η γραμμή συμπίπτει με τον περιστρεφόμενο τοίχο** (preview ≡ commit, AutoCAD/Revit). F8/F10/AutoAlign event-time από `cadToggleState` + `ambientAlignmentConfigStore` getters (μηδέν νέο `useSyncExternalStore` — ADR-040 CHECK 6C ασφαλές). Ίδιο μοτίβο με **ADR-508 §column place+rotate** (που ήδη έδειχνε πορτοκαλί γραμμή στην περιστροφή κολώνας). 3 jest (POLAR lock γύρω από pivot + off-state + null anchors). Co-staged: **ADR-040** (CHECK 6D — `useGripGhostPreview`/`drawing-hover-handler`) + **ADR-357**. 🔴 browser-verify (επίλεξε τοίχο → λαβή περιστροφής → όρισε κέντρο → γύρνα με POLAR+AutoAlign on → πορτοκαλί+λευκές γραμμές όπως στη σχεδίαση) + commit.
- **2026-06-17 (Opus 4.8) — Πλήρης αφαίρεση «Έλξη» από ΟΛΟ το grip hover-menu (Giorgio, συνέχεια της Φάσης 1).** Η Φάση 1 αφαίρεσε το «Έλξη» μόνο από τα `movesEntity` grips (`if (grip.movesEntity) return []`)· οι **8 resize λαβές + η περιστροφή** της κολώνας ΔΕΝ είναι `movesEntity` → έπεφταν στο `default: return [stretch]` → εμφάνιζαν ακόμη «Έλξη». **Revit-grade απόφαση:** το σύρσιμο λαβής ΕΙΝΑΙ ήδη το stretch — Revit/AutoCAD ΠΟΤΕ δεν δείχνουν πλεοναστικό «Stretch» entry. Αφαιρέθηκε ολοσχερώς το `'stretch'` από το `GripMenuActionId` union + `META` + ΚΑΘΕ output του `resolveMenuActions` (`grip-menu-resolver.ts`) → μένουν ΜΟΝΟ τα γνήσια multifunctional (`lengthen`/`addVertex`/`removeVertex`/`radius`). Αποτέλεσμα: column/BIM anchors + circle/text + line midpoint + arc center + MOVE glyph → `[]` → **κανένα hover menu** (Revit-clean)· line endpoint→`[lengthen]`, arc midpoint→`[radius]`, arc endpoint→`[lengthen]`, polyline vertex→`[addVertex(,removeVertex)]`. `grip-menu-actions.ts`: αφαιρέθηκε το νεκρό `case 'stretch'`. Νεκρή i18n key `gripMenu.stretch` διαγράφηκε (el+en)· το `gripMode.stretch` (Spacebar mode-cycle, διαφορετική έννοια) + το Stretch tool (`useStretchTool`) **ΑΝΕΠΑΦΑ**. NEW `systems/grip/__tests__/grip-menu-resolver.test.ts` (17 jest) κλειδώνει το «καμία Έλξη ποτέ». Λεπτομέρειες SSoT στο ADR-349 §Changelog v1.3. 🔴 browser-verify (επίλεξε κολώνα → hover 8 λαβές + περιστροφή → καμία «Έλξη»· line/arc/polyline κρατούν lengthen/radius/addVertex) + commit (git add ΜΟΝΟ δικά μου).
- **2026-06-17 (Opus 4.8) — Πλήρες AutoCAD/Revit ROTATE handle, Σ1+Σ2+Σ3 (Giorgio «full enterprise + full SSoT, Revit-grade»).** Η λαβή περιστροφής ΟΛΩΝ των BIM οντοτήτων αλλάζει από **6-click-by-default** σε **FREE rotate-by-default** (AutoCAD/Revit): glyph → κέντρο → η οντότητα **γυρίζει ζωντανά με τον κέρσορα** → κλικ/Enter οριστικοποιεί· **πληκτρολόγηση αριθμού → ακριβής γωνία με ΟΡΑΤΗ ένδειξη ° στον κέρσορα** (Σ3). Το «R» κρατά την παλιά **6-click ευθεία αναφοράς** ως opt-in (ΑΝΕΠΑΦΗ). **SSoT audit (grep) πρώτα → μηδέν διπλότυπα, μέγιστο reuse:** ο commit είναι ο ΙΔΙΟΣ `commitDxfGripDragModeAware` + `BimRotateHotGripStore` (μηδέν νέα εντολή)· το preview ο ΙΔΙΟΣ `buildRotateReferencePreview` (νέο `rotate-free` branch, ΙΔΙΑ identity `anchor=pivot+refDir`, `delta=alignDir−refDir`)· το digit-buffer SSoT για τη Σ3 = `DirectDistanceEntry` (ADR-344, ήδη «angle for rotation»)· ο angle formatter = `formatMoveAngle`/`formatAngleLocale` (move-readout.ts, ήδη). **Σ1 — Free rotate + click commit:** `wall-hot-grip-fsm` νέο step `'rotate-free'` (terminal) + `advanceHotGripStep('rotate','await-base')→'rotate-free'` (αντί `await-ref-start`)· `grip-hotgrip-actions.advanceHotGripPick` rotate branch → `rotate-free` (centre lock + arm snap targets, αμετάβλητα) + **νέα `commitFreeRotate`** (sweep = angle(align)−angle(ref) με refDir=baseline−pivot, alignDir=cursor−pivot)· `grip-mouse-handlers` commit dispatch: `rotate-free`→`commitFreeRotate`, αλλιώς→`commitRotateReference`· `grip-projections.buildRotateReferencePreview` += `freeBaseline` param + `rotate-free` branch (no baseline→pivot ⊙ μόνο)· `useUnifiedGripInteraction` += `hotGripRotateBaseRef` (baseline = κέρσορας στο **1ο move μετά το κέντρο**, min-distance gate → no jump· στο centre-pick ο κέρσορας είναι ΠΑΝΩ στο pivot=undefined angle) + preview/ctx wiring + reset×2. **Σ2 — «R» → reference:** pure `isReferenceFlowKey` στο `wall-hot-grip-fsm` (testable, μηδέν heavy deps) + `enterReferenceFromFree` (jump σε `await-ref-start`, drop baseline + clear ref/align slots, κρατά κέντρο+snap)· νέα **`handleHotGripKeyDown(key)`** + `hotGripIsActive` στο return του hook (closure στα refs)· wiring στο `useCanvasKeyboardShortcuts` με το ΙΔΙΟ guard-and-delegate pattern των tools (scale/stretch/trim/extend) + `stopImmediatePropagation` (το «R» δεν διαρρέει σε global tool)· `CanvasSection` περνά τα 2 props. i18n: `gripContextMenu.prompts.rotateFree` (el+en). **Σ3 — typed γωνία + ΟΡΑΤΗ ένδειξη:** το digit buffer είναι το ΥΠΑΡΧΟΝ `DirectDistanceEntry` (μηδέν νέο buffer logic, μηδέν νέο store — η αρχική πρόταση `RotateAngleEntryStore` ΑΠΟΡΡΙΦΘΗΚΕ από το audit: το DDE + 2 React state αρκούν). `useUnifiedGripInteraction`: `rotateDdeRef` (DDE instance) + `typedRotate` state `{buffer, deg}` (re-triggers το preview memo — τα keystrokes δεν κουνούν τον κέρσορα)· `handleHotGripKeyDown` επεκτείνεται: ψηφία/`-`/`.`→DDE buffer, **Backspace**→edit (swallowed→ποτέ smart-delete), **Enter**→`commitTypedRotate` (exact), «R»→reference. `grip-projections`: pure `rotateDeltaForAngleDeg` (unit-East: anchor=pivot+(1,0), delta=(cosθ−1,sinθ)→sweep ακριβώς θ) + `rotateSweepDegFromDirs` (signed, normalized (−180,180])· `buildRotateReferencePreview` += `typedAngleDeg` param (overrides cursor) + νέα preview fields `rotateSweepDeg`+`rotateReadoutAnchor`. `commitTypedRotate` (grip-hotgrip-actions) reuse `commitDxfGripDragModeAware`+`BimRotateHotGripStore` (μηδέν νέα εντολή). **Readout rendering:** `useGripGhostPreview` ζωγραφίζει angle pill (`drawDimPill`+`formatMoveAngle`, signed) στον κέρσορα όταν `rotateSweepDeg` set — ΙΔΙΟ pill SSoT με το move readout· live cursor sweep ΚΑΙ typed. `Esc` cancel μέσω του υπάρχοντος EscapeCommandBus GRIP_DRAG slot (resetToIdle καθαρίζει DDE+typed). i18n: `gripContextMenu.prompts.rotateFree` (el+en, ενημερωμένο). **Fix (browser, Giorgio): ESC δεν ακύρωνε την περιστροφή κολώνας.** **ΑΛΗΘΙΝΗ root cause (Giorgio repro, αποφασιστικό): editable-focus guard.** Ο escape-bus παρακάμπτει (`runHandlerChain` γρ.70) κάθε handler χωρίς `allowWhenEditable` όταν `document.activeElement` είναι INPUT/editable. Με **επιλεγμένη BIM οντότητα** το ribbon δείχνει **editable numeric comboboxes** (`RibbonEditableCombobox`)· το κλικ στον καμβά **ΔΕΝ τα blur-άρει** (ο καμβάς δεν είναι focusable) → το focus μένει σε INPUT για ΟΛΗ τη ροή → ο grip ESC handler παρακάμπτεται → ESC νεκρό. Repro-proof: άνοιγμα+κλείσιμο dialog («Λεπτομέρεια Οπλισμού») → reset focus → ESC ξαναδουλεύει. **Λύση (2 σκέλη, μέσω escape-bus SSoT):** (1) νέα προτεραιότητα `ESC_PRIORITY.HOT_GRIP_OP = 975` (κάτω μόνο από `MODAL_DIALOG`) + handler `canvas/hot-grip-op-cancel` (gated `hotGripActive`=phase hotGrip, `handle: handleGripEscape`) → η ενεργή hot-grip πράξη κερδίζει το ESC από κάθε tool/numeric handler (το παλιό `GRIP_DRAG` ήταν **P450**, από τα χαμηλότερα)· (2) **`allowWhenEditable: true`** στον handler → τρέχει ΚΑΙ με input focused (ίδιο pattern με `useDimToolRouting`/`useDynamicInputKeyboard`). Έτσι το ESC ακυρώνει την περιστροφή σε ΚΑΘΕ βήμα (free + «R»/reference), με ή χωρίς focused ribbon combobox. ΑΠΟΡΡΙΦΘΗΚΑΝ 2 attempts: (α) ESC owned στο `handleHotGripKeyDown`/capture-bypass· (β) μόνο priority P975 (το focus guard το παρέκαμπτε ακόμη). ΜΑΘΗΜΑ: «dialog open/close το φτιάχνει» = σχεδόν πάντα focus issue· ο canvas δεν είναι focusable, ώστε ribbon inputs κρατούν focus πάνω από canvas gestures → canvas-level ESC handlers χρειάζονται `allowWhenEditable`. **55 jest** (FSM rotate-free terminal + `isReferenceFlowKey` + free-rotate sweep **+CCW/−CW** + typed-angle override + pure helpers). tsc καθαρό. `BaseEntityRenderer`/render leaves δεν χρειάστηκαν αλλαγή (preview pipeline reuse)· `useGripGhostPreview` = ΕΚΤΟΣ ADR-040 (PreviewCanvas overlay, όπως το move readout)· `CanvasSection` orchestrator μόνο 2 props προς keyboard hook → ADR-040-safe. 🔴 browser-verify (κέντρο→γύρνα ζωντανά→κλικ· πληκτρολόγησε 45→Enter· «R»→6-click ευθεία αναφοράς όπως πριν· κολώνα/τοίχος/δοκός/θεμέλιο) + commit (git add ΜΟΝΟ δικά μου).
- **2026-06-17 (Opus 4.8) — Directional move handle, Φάση 2 (Giorgio «full enterprise + full SSoT, Revit-grade»).** Δύο δυνατότητες, για ΟΛΕΣ τις BIM οντότητες: **(Α) per-σκέλος hover highlight** (πριν: hover→όλος ο σταυρός πορτοκαλί· τώρα ΜΟΝΟ το σκέλος κάτω από τον κέρσορα). **(Β) click σε σκέλος → πεδίο τιμής → κατευθυντική μετακίνηση** κατά τον τοπικό άξονα· click στο κέντρο → υπάρχουσα 3-click await-base (αμετάβλητη). **SSoT ταξινόμησης (ΕΝΑ classification, μοιράζονται hover+click):** επέκταση `bim/grips/move-glyph-zones.ts` με `resolveMoveGlyphZoneForGrip` (world-frame, reuse του υπάρχοντος coordinate-agnostic `resolveMoveGlyphZone`), `directionForZone` (zone→±axisX/±axisY) και `worldZoneToLocalArm` (canvas Y-flip: world `y+`↔drawn `y-`, X αμετάβλητο). **NEW `bim/grips/move-glyph-zone-store.ts`** (zero-React singleton, mirror `rotation-snap-store`): η hovered world-zone· writer=hook, reader=renderer. **Highlight wiring:** `useUnifiedGripInteraction.handleMouseMove` ταξινομεί (μόνο move grips φέρουν `moveGlyphFrame`) → `MoveGlyphZoneStore.set` + `markSystemsDirty(['dxf-canvas'])` σε αλλαγή (το grip id δεν αλλάζει μεταξύ σκελών → χρειάζεται explicit repaint) → `BaseEntityRenderer.renderGrips` διαβάζει store, map→drawn-local arm, attach `GripInfo.moveHoveredZone` (skip όταν active) → `GripPhaseRenderer` (force `'cold'` βάση + forward `hoveredZone`) → `UnifiedGripRenderer` (`hoveredZone` στο batch key + warm `highlightColor`) → `GripShapeRenderer.renderMoveGlyph` per-σκέλος (cold cross, ΕΝΑ arm warm· `'center'`→disc). **Click wiring:** `useGripRegistry` προσαρτά `moveGlyphFrame`+`moveGlyphMmScale` (`mmScaleFor(params)`) στα move grips (kind→'move' via `hotGripOpForKind`) · `grip-mouse-handlers.runGripMouseDown` στο move-entry: directional zone → **`getPromptDialogStore().prompt()`** (ΤΟ SSoT, ίδιο με «γωνία περιστροφής» — ΟΧΙ το tool-bound `dynamic-input`, που το SSoT audit απέδειξε ότι ΔΕΝ ανοίγει προγραμματιστικά) → `value(mm)×mmScale×axis` (**signed**, AutoCAD direct-distance parity: το σκέλος=θετική φορά, αρνητική τιμή→αντίθετη κατεύθυνση) → reuse `commitDxfGripDragModeAware` (μηδέν νέα εντολή) + `markDragFinished()` (suppress trailing click → δεν χάνεται η επιλογή). i18n: `promptDialog.moveDistance`/`moveDistanceLabel` (el+en). **18→33 jest** (+`directionForZone`/`worldZoneToLocalArm`/`resolveMoveGlyphZoneForGrip` + **end-to-end consistency** με τον ΠΡΑΓΜΑΤΙΚΟ `CoordinateTransforms` ×4 γωνίες: το φωτισμένο βέλος δείχνει ΑΚΡΙΒΩΣ εκεί που μετακινείται η οντότητα). `BaseEntityRenderer` renderer-coupled → **stage ADR-040** (CHECK 6B/6D). **UX refinements (Giorgio):** (i) το **hovered σκέλος μεγαλώνει** (μήκος ×1.6 + κεφαλή ×1.6 + παχύτερη γραμμή) στο `renderMoveGlyph`· (ii) η **πινακίδα διαστάσεων κατεβαίνει** κάτω από το κέντρο (`BIM_LABEL_CENTER_OFFSET_Y_PX=34` στο `bim-dim-labels.drawEntityDimLabel`) ώστε να μην επικαλύπτει το 4-βέλο και να διαβάζεται. (iii) **fix κεντρικού δίσκου** που κατάπινε τον σταυρό: η ταξινόμηση χρησιμοποιεί band **arm-relative** (`ARM_PICK_BAND_FRACTION`), ΟΧΙ το hit-tolerance (~16px>arm 14px). 🔴 browser-verify (hover ΕΝΑ σκέλος→μεγαλώνει μόνο αυτό· click σκέλος→πεδίο→μετακίνηση προς εκείνη τη διεύθυνση· click κέντρο→παλιά await-base· κολώνα/τοίχος/δοκός) + commit.
- **2026-06-17 (Opus 4.8) — Directional move handle, Φάση 1/2 (Giorgio «το 4-βέλο να περιστρέφεται με την οντότητα + κατάργηση Έλξη»).** Δύο αλλαγές: (1) **Κατάργηση «Έλξη» hover-menu** στις λαβές μετακίνησης: `grip-menu-resolver.resolveMenuActions` → `if (grip.movesEntity) return []` (το μόνο entry ήταν `gripMenu.stretch`=«Έλξη», stretch==move → σύγχυση). Καλύπτει ΟΛΑ τα BIM (column-center/wall-midpoint/beam-midpoint/*-move εκπέμπονται με `movesEntity:true`). (2) **Το 4-βέλο MOVE glyph περιστρέφεται μαζί με την οντότητα** (πριν: πάντα screen-axis-aligned· σε κολώνα στραμμένη 45° το σημάδι έμενε ίσιο). **NEW SSoT `bim/grips/move-glyph-frame.ts`** `resolveMoveGlyphFrame(entity)` → local +X/+Y ως WORLD unit vectors (box entities από `params.rotation`° · linear wall/beam/segment/strip από `start→end` άξονα · αλλιώς null=αμετάβλητο) + `withMoveGlyphRotation(grips, entity, worldToScreen)` που υπολογίζει τη **screen-space** γωνία (project axisX μέσω worldToScreen → handles Y-flip+scale) και τη βάζει ΜΟΝΟ στα `shape:'move'` grips. Wiring: `GripInfo`/`GripRenderConfig` += `glyphRotationRad?` · `BaseEntityRenderer.renderGrips` καλεί `withMoveGlyphRotation` κεντρικά (ΕΝΑ σημείο→όλες οι οντότητες) · `GripPhaseRenderer.renderStandardGrips` forward · `UnifiedGripRenderer.renderGripSetBatched` (rotation στο batch key, αλλιώς 2 οντότητες διαφορετικής γωνίας θα έπεφταν σε ένα group) → `GripShapeRenderer.renderMoveGlyph` (`translate+rotate` γύρω από το grip origin). 11 jest (move-glyph-frame: box/linear/Y-flip/null) + 158 grip regression PASS (1 pre-existing fail grip-commit-alt-bypass mock=ΟΧΙ δικό μου). `BaseEntityRenderer` renderer-coupled → **stage ADR-040** (CHECK 6B/6D). **Φάση 2 (εκκρεμεί):** κλικ σε μεμονωμένο βέλος → πεδίο τιμής → κατευθυντική μετακίνηση κατά τον τοπικό άξονα (reuse `resolveMoveGlyphFrame.axisX/axisY` + dynamic-input + `commitDxfGripDragModeAware`)· κλικ στο κέντρο → υπάρχουσα ροή await-base. 🔴 browser-verify Φ1 (στρίψε κολώνα 45°→το 4-βέλο ακολουθεί· καμία «Έλξη» στο hover) + commit.
- **2026-06-11 (Opus 4.8) — Rotation-process visual feedback (Giorgio «press→hot + pivot marker», FULL SSoT).** Δύο gaps στο 6-click ROTATE→Reference flow που έκαναν τη διαδικασία αόρατη στον χρήστη: (1) **press→HOT**: στο press του rotation handle ο χρήστης δεν έβλεπε ότι ξεκίνησε η περιστροφή. Root cause: `grip-projections.buildGripInteractionState` εξέπεμπε `activeGrip` ΜΟΝΟ για `phase==='dragging'`, ΟΧΙ `'hotGrip'` (το click-armed rotate). **Fix (1 γρ.):** `phase==='dragging' || phase==='hotGrip'` → το πατημένο grip μένει HOT σε ΟΛΗ τη διαδικασία (`BaseEntityRenderer.stateForGrip` δίνει `active`→'hot' προτεραιότητα πάνω από `hovered`→'warm'). Καλύπτει **ΟΛΕΣ** τις BIM οντότητες (BaseEntityRenderer=βάση όλων). (2) **pivot marker**: μετά το click ορισμού κέντρου περιστροφής δεν εμφανιζόταν τίποτα μέχρι να τραβηχτεί reference line (`buildRotateReferencePreview` επέστρεφε null στο `await-ref-start`). **Fix:** return `base` (rotatePivot set, delta 0) στο `await-ref-start` → εμφανίζεται marker μόλις κλειδώσει το κέντρο. **NEW SSoT glyph `rendering/ui/rotation-pivot-marker.ts` `drawRotationPivotMarker`** (⊙ ring+crosshair, screen-stable px, κόκκινο) — **κοινό** σε ΑΜΦΟΤΕΡΑ τα rotation paths: grip 6-click (`useGripGhostPreview`) ΚΑΙ toolbar Rotate tool (`useRotationPreview`, ADR-188). **Boy-Scout (N.0.2):** το inline crosshair του `useRotationPreview` αντικαταστάθηκε από το ΙΔΙΟ SSoT (το tool-rotate κέρδισε το ⊙ ring → οι δύο flows οπτικά πανομοιότυπα). **ΚΡΙΣΙΜΟ wiring fix (browser-driven, Giorgio «δεν παραμένει HOT»):** το F1 (activeGrip σε hotGrip) ήταν αναγκαίο ΑΛΛΑ ΟΧΙ αρκετό — τα BIM grips renderάρονται μέσω `PhaseManager → GripPhaseRenderer.getGripTemperature`, που για **HOT** διαβάζει ΜΟΝΟ το `gripState.dragginGrip`. Στο `BaseEntityRenderer.renderGrips` το `dragginGrip` ήταν **hardcoded `undefined`** («Currently not implementing drag detection») ενώ το `active` πήγαινε στο αγνοούμενο `selectedGrip` → **κανένα** grip δεν γινόταν ποτέ hot (το hover→warm δούλευε γιατί διαβάζεται το `hoveredGrip`). Fix: `dragginGrip: this.gripInteraction.active`. Τώρα το πατημένο grip (drag Ή click-armed hot-grip rotate/move) γίνεται hot. 6 αρχεία (1 NEW SSoT + grip-projections 2 edits + 2 preview hooks + `BaseEntityRenderer.renderGrips`)· 336/337 rendering/phase-manager/grip jest (1 pre-existing fail grip-commit-alt-bypass `sceneManager.getEntity` mock gap=ΟΧΙ δικό μου) + tsc καθαρό. `BaseEntityRenderer` = renderer-coupled → **stage ADR-040** (CHECK 6B/6D). 🔴 browser-verify (press rotation handle→glyph κόκκινο & μένει· click κέντρο→⊙ marker).
- **2026-05-29** — ADR created. Deep study του wall grip/glyph/hot-grip συστήματος (4 parallel domain explorers). Catalog + glyph SSoT + hot-grip FSM + Ctrl-copy + ESC + length/mm + invariant τεκμηριωμένα. Column gap analysis. Decision D1-D5 FULL SSoT generalization. Q1=6-click reference, Q2=Plan Mode.
- **2026-05-29 (later)** — **IMPLEMENTED Phases 1+2+3** (§12b). Phase 1: shared `grip-glyph-registry` + `grip-math` + `BimRotateHotGripStore` + generalized `wall-hot-grip-fsm` (registry + `hotGripKindOf`). Phase 2: column move/rotation glyphs + entity-agnostic mouse-handler + `rotateAroundPivot` (6-click orbit) + `commitColumnGripDrag` rotate-store read. Phase 3: `addColumnToScene` SSoT + `commitColumnCopy` + `commitHotGripCopy` dispatcher. Κολώνα = πλήρης parity τοίχου (move 3-click, rotate 6-click reference, Ctrl-COPY). 325/325 tests PASS, tsc clean. D5 persistence-store register deferred (no ColumnPropertiesTab consumer). Pending commit.
- **2026-06-03 (Opus 4.8)** — **Electrical panel opt-in (ADR-408 Φ3)** — ΝΕΕΣ rows panel στο shared glyph + hot-grip registry SSoT (μηδέν fork, μόνο εγγραφή): `GRIP_GLYPH_REGISTRY` += `electrical-panel-move:'move'` / `electrical-panel-rotation:'rotation'`· `HOT_GRIP_OP_REGISTRY` += `electrical-panel-move:'move'` / `-rotation:'rotate'` / 4× `-corner-*:'corner'`· `hotGripKindOf` += `?? grip.electricalPanelGripKind`. Reuse `grip-math` (D3) στο NEW `electrical-panel-grips.ts` — μηδέν raw cos/sin. Επιβεβαιώνει την entity-agnostic γενίκευση D1/D2/D3: 4ο entity (μετά wall/column/mep-fixture) opt-in μέσω rows. 58/58 grip/ghost tests PASS, tsc 0. Λεπτομέρειες υλοποίησης: ADR-408 §Changelog (Φ3 grip UX wall-parity). Pending commit.
- **2026-06-03 (Opus 4.8, Giorgio review) — D3.1 κεντρικοποίηση box-grips SSoT.** Ο Giorgio εντόπισε σε review ότι το `electrical-panel-grips.ts` ήταν ~90% διπλότυπο του `mep-fixture-grips.ts`. **Boy-Scout N.0.2 fix επιτόπου:** εξαγωγή NEW `bim/grips/centred-box-grips.ts` (`getCentredBoxGrips` + `applyCentredBoxGripDrag`, entity-agnostic ROLE + `CentredBoxPatch|null`, βλ. §D3.1). **ΚΑΙ** fixture **ΚΑΙ** panel γίνανε thin role↔kind adapters (fixture κρατά μόνο το `circular`/`diameter` extension). ~200 γρ. διπλότυπο → ΕΝΑΣ SSoT. 11 νέα SSoT tests + 118 PASS regression (fixture circular/rectangular + panel + hot-grip + ghost + glyph), tsc 0. Pending commit.
- **2026-06-03 (Opus 4.8) — D3.2 shared axis-rotation SSoT + δοκάρι opt-in (ADR-363 Φ5.5d).** Δοκάρι παίρνει πλήρες grip UX μετακίνησης+περιστροφής «όπως ο τοίχος» (axis-based). **N.0.2 ΠΡΙΝ γράψω (έγκριση Giorgio AskUserQuestion):** το inline rotate-axis-points-about-pivot του `rotateWall` εξήχθη σε **NEW `grip-math.ts → rotateAxisPointsAboutPivot`** (βλ. §D3.2)· **ΚΑΙ ο τοίχος refactor-αρίστηκε** να το καταναλώνει (όχι μισό-SSoT) **ΚΑΙ** το νέο `rotateBeam`. Opt-in μέσω rows (μηδέν fork): `GRIP_GLYPH_REGISTRY` += `beam-midpoint:'move'`/`beam-rotation:'rotation'`· `HOT_GRIP_OP_REGISTRY` += `beam-midpoint:'move'`/`beam-rotation:'rotate'`· `hotGripKindOf` += `?? grip.beamGripKind`. `BeamRenderer.getGrips` += `shape: gripGlyphShape(g.beamGripKind)`. `commitBeamGripDrag` διαβάζει `BimRotateHotGripStore` (pivot+currentPos για `beam-rotation`)· beam live ghost branch (`apply-entity-preview`) + `buildRotateReferencePreview` forward `beamGripKind`. Ctrl-COPY: NEW `addBeamToScene` + `commitBeamCopy` + register στο `commitHotGripCopy`. Νέο grip `beam-rotation` σε axis-fraction 0.75 (scale-free). Μηδέν raw cos/sin. 114+16 grip/math tests PASS, tsc 0. Λεπτομέρειες: ADR-363 §6 Phase 5.5d. Pending commit.
- **2026-06-11 (Opus 4.8) — §4 temperature SSoT unification.** Το `GripPhaseRenderer.getGripTemperature()` ξανα-υλοποιούσε inline τη hot/warm/cold priority logic — δεύτερη πηγή αλήθειας. **N.0.2 fix:** NEW `rendering/grips/grip-temperature.ts → resolveGripTemperature(entityId, gripIndex, { hovered, active, dragging })` (pure, exported από `grips/index.ts`)· ο GripPhaseRenderer τώρα κάνει map το phase-manager naming (`{hoveredGrip, selectedGrip, dragginGrip}`) → canonical και delegate. `BaseEntityRenderer` ταΐζει το πατημένο grip μέσω `selectedGrip` (active: `selectedGrip ?? dragginGrip`) → μένει HOT για όλη την πράξη, χωρίς το παλιό `dragginGrip` workaround. +unit test (`__tests__/grip-temperature.test.ts`). Λεπτομέρειες: `HANDOFFS/HANDOFF_2026-06-11_grip-temperature-SSoT-unification.md`. Pending commit.
- **2026-06-11 (Opus 4.8) — temperature 3→1 SSoT (Phase C) + rotation snap & σιελ λαβές (FULL ENTERPRISE).** **(A) Temperature unification ολοκληρώθηκε:** ο `GripInteractionDetector.detectTemperature` έγινε thin façade πάνω στο `resolveGripTemperature` (μηδέν δεύτερη logic)· διαγράφηκαν τα **dead** `BaseEntityRenderer.stateForGrip` + `drawGripAtWorld` (μηδέν callers)· οι **3 διπλοί ορισμοί** `GripTemperature` ενοποιήθηκαν — `systems/phase-manager/types.ts` + `hooks/grips/unified-grip-types.ts` κάνουν πλέον re-export τον canonical (`rendering/grips/types.ts`). Το 🔴 DUPLICATE στο `docs/systems/grip-rendering.md` → ✅ UNIFIED. **(B) Rotation snap + σιελ λαβές (Giorgio):** κατά την περιστροφή BIM (6-click grip flow), το **κέντρο ⊙** και οι **λαβές** της οντότητας γίνονται **snap targets** (έλκουν τον κέρσορα όταν OSNAP on). Η λαβή γίνεται **σιελ** (`#00BCD4`, reuse `GUIDE_X`) **ΜΟΝΟ proximity** — όταν ο κέρσορας πλησιάζει/snap-άρει σε αυτήν (σαν hover, αλλά cyan)· ΟΧΙ μόνιμα όλο το set (διόρθωση Giorgio: οι λαβές μένουν πορτοκαλί, μία τη φορά σιελ). **SSoT design:** NEW `rendering/grips/grip-temperature.ts` τιμή `temperature='snappable'` (priority **hot > snappable > warm > cold**, key `snappableKeys: ReadonlySet<string>`) → ισχύει αυτόματα σε ΟΛΕΣ τις BIM οντότητες μέσω του ΕΝΟΣ `GripPhaseRenderer` path. NEW `bim/grips/rotation-snap-store.ts` (imperative singleton: pivot + entity grips, armed στο centre-pick `advanceHotGripPick`, cleared στο `resetToIdle`· **`getActiveRotationGripSnapKey()`** = διαβάζει το live `ImmediateSnapStore`, επιστρέφει ΜΟΝΟ τη λαβή που είναι τώρα snapped). NEW `snapping/engines/RotationSnapEngine.ts` (`RotationPivotSnapEngine` pri −2.5 + `RotationGripSnapEngine` pri 0, διαβάζουν το store, αγνοούν `excludeEntityId`) + 2 ExtendedSnapType + registry + ⊙/◇ glyphs (`SnapIndicatorOverlay`) + `SnapContext` contextual force-on με OSNAP (όχι ALL_MODES → δουλεύει για υπάρχοντες χρήστες χωρίς stored toggle). **ΚΛΕΙΔΙ (zero new injection):** το υπάρχον snap pipeline (`mouse-handler-move` `isGripDragging` path) τρέχει ήδη `findSnapPoint` στο hotGrip rotate → preview ΚΑΙ commit snap-άρουν αυτόματα μόλις γεμίσει το store· το `BaseEntityRenderer` cyan δένεται στο live snap result → σβήνει μόλις φύγει ο κέρσορας / OSNAP off. `snappable` size = cold (colour-only cue). 32 NEW jest (grip-temperature 19 + RotationSnapEngine/store 13) + 260/261 regression (1 pre-existing fail grip-commit-alt-bypass). `BaseEntityRenderer`/`GripPhaseRenderer` renderer-coupled → **stage ADR-040** (CHECK 6B/6D). 🔴 browser-verify (OSNAP on: κέρσορας έλκεται σε ⊙+λαβές· η λαβή που πλησιάζει→σιελ, οι υπόλοιπες πορτοκαλί· OSNAP off: τίποτα) + commit.
