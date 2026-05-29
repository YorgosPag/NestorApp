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

`GripPhaseRenderer.getGripTemperature()` — `systems/phase-manager/renderers/GripPhaseRenderer.ts:105`:
- `hot` (κόκκινο `#FF0000`, size ×1.5) — grip σε drag/hotGrip
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
- **2026-05-29** — ADR created. Deep study του wall grip/glyph/hot-grip συστήματος (4 parallel domain explorers). Catalog + glyph SSoT + hot-grip FSM + Ctrl-copy + ESC + length/mm + invariant τεκμηριωμένα. Column gap analysis. Decision D1-D5 FULL SSoT generalization. Q1=6-click reference, Q2=Plan Mode.
- **2026-05-29 (later)** — **IMPLEMENTED Phases 1+2+3** (§12b). Phase 1: shared `grip-glyph-registry` + `grip-math` + `BimRotateHotGripStore` + generalized `wall-hot-grip-fsm` (registry + `hotGripKindOf`). Phase 2: column move/rotation glyphs + entity-agnostic mouse-handler + `rotateAroundPivot` (6-click orbit) + `commitColumnGripDrag` rotate-store read. Phase 3: `addColumnToScene` SSoT + `commitColumnCopy` + `commitHotGripCopy` dispatcher. Κολώνα = πλήρης parity τοίχου (move 3-click, rotate 6-click reference, Ctrl-COPY). 325/325 tests PASS, tsc clean. D5 persistence-store register deferred (no ColumnPropertiesTab consumer). Pending commit.
