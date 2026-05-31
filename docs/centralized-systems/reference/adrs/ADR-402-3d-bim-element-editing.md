# ADR-402 — 3D Viewport BIM Element Editing

| Field | Value |
|---|---|
| Status | 🟢 ACCEPTED — Sub-Phase 0+1+2 DONE · GenArc gizmo port **Phase A** DONE · **Phase B resize scaffold + COLUMN resize** DONE (pending commit) |
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
| GenArc Port B | Resize handles + axis-Y→elevation + endpoint snap + multi-select 3Δ | ⏳ Phase B (επόμενη συνεδρία) |

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
- **Single-select** (το `Selection3DStore` είναι single)· multi-select centroid = Phase B.
- **Resize**: COLUMN (resize-x→width / resize-z→depth) DONE Phase B· wall(thickness/length)/beam/slab +
  κατακόρυφη (Y)→elevation + endpoint snap = υπόλοιπο Phase B.

---

## SSoT reuse (μηδέν διπλά μαθηματικά/εντολές)
- Move/Rotate: `MoveEntityCommand` / `RotateEntityCommand` (zero change, μόνο barrel export).
- **Resize (Phase B):** `bim3d-resize-bridge.ts` (νέο SSoT γέφυρα — **μηδέν νέα math**) → καλεί τα 2Δ
  grip-drag SSoT `applyColumnGripDrag` (το οποίο κάνει `projectDeltaToLocal` → χειρίζεται περιστροφή) →
  `UpdateColumnParamsCommand`. mm→canvas μετατροπή μέσω `mmScaleFor` (ίδιο pattern με 2Δ commit path).
- Συντεταγμένες: `dxfPlanToWorld`/`worldToDxfPlan` (`coordinate-transforms.ts`),
  `computeFloorPlane`/`worldDeltaToDxfDelta` (`bim3d-edit-math.ts`).
- Adapter: `createSceneManagerAdapter` (`grip-commit-adapters.ts`).
- Cascade κουφωμάτων: δωρεάν (μέσα στις εντολές).

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
  (move sign + rotate pivot/angle, 4), `bim3d-edit-math` (6) — 19/19 PASS. Dispatcher
  edit-keys 13/13 PASS. `npx tsc --noEmit` clean (0 errors).
- **🔴 Browser** `localhost:3000/dxf/viewer` 3Δ: επιλογή→gizmo auto· drag axis/plane→
  μετακίνηση + κουφώματα follow + ένα undo· Y-ring→rotate ταυτίζεται 2Δ· screen-constant
  κατά zoom/orbit· multi-floor σωστός όροφος.

---

## Changelog
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
