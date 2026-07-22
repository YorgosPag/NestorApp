# ADR-402 — 3D Viewport BIM Element Editing

| Field | Value |
|---|---|
| Status | 🟢 ACCEPTED — Sub-Phase 0+1+2 DONE · GenArc gizmo port **Phase A** DONE · **Phase B resize (column/wall/beam/slab + axis-Y)** DONE · **Phase B snap-during-drag (move + horizontal resize)** DONE · **Phase C multi-select 3Δ (centroid move/rotate + snap-from-all)** DONE · **Sub-Phase 1 stair gizmo resize (width / run, gizmo handles)** DONE · **Live preview (move/rotate/resize — η οντότητα ακολουθεί ζωντανά)** DONE (pending commit, 🔴 browser verify) |
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
| **Live preview** | **Η οντότητα ακολουθεί ζωντανά τον κέρσορα κατά το drag (move/κάθετο/rotate/resize) — όχι «πήδημα» στο release** | ✅ **DONE** |

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

### Live preview — η οντότητα ακολουθεί ζωντανά (απόφαση Giorgio 2026-06-01)
**Πρόβλημα:** κατά το drag κινούνταν **μόνο το gizmo overlay**· το ίδιο το mesh έμενε ακίνητο και
«πηδούσε» στη νέα θέση μόνο στο `pointerup` (single-commit-on-release). Ο Giorgio ζήτησε η **ίδια η
οντότητα** να ακολουθεί ζωντανά (Revit/Forge), **χωρίς** να σπάσει το single-commit (ΕΝΑ undo step).

**Στρατηγική hybrid (Q1: «να κινείται το ίδιο το αντικείμενο», Q2: FULL):**
- **Move / κάθετο move / Rotate → rigid live mesh transform.** Κάθε BIM οντότητα = **direct child** του
  `bimLayer.group` με `userData['bimId']` (η σκάλα = πολλά children)· το group είναι identity → τα
  `position`/`quaternion` είναι ουσιαστικά world, οπότε world-space translate/rotate εφαρμόζεται απευθείας.
  Για την επιλεγμένη οντότητα, rigid translate/rotate = **ΑΚΡΙΒΩΣ** ό,τι παράγει η εντολή. **DXF CCW
  περιστροφή κατά θ ≡ world περιστροφή περί +Y κατά θ** (αφού `worldToDxfPlan`: world z = −DXF y) → το live
  rotate ταυτίζεται με το `RotateEntityCommand`.
- **Resize → per-frame geometry rebuild της ΜΙΑΣ οντότητας** μέσω των ΥΠΑΡΧΟΝΤΩΝ public converters
  (`wallToMesh`/`columnToMesh`/`beamToMesh`/`slabToMesh`/`stairToMeshes`) + των ΥΠΑΡΧΟΝΤΩΝ
  `compute*ResizeParams` (`bim3d-resize-bridge`) + `compute*Geometry`. Ένα transform δεν εκφράζει αλλαγή
  διάστασης· μόνο rebuild το κάνει σωστά (ghost === commit, με miters/openings της ίδιας οντότητας).
- **Lifecycle:** pointerdown→`captureTransform`/`captureResize`· pointermove→`applyMove`/`applyRotate`/
  `applyResize` + `markSceneDirty()` (ΟΧΙ νέο rAF — UnifiedFrameScheduler, ADR-040/366)· pointerup
  **committed**→`commit()` (drop refs· το resync αντικαθιστά τα meshes — μηδέν πήδημα γιατί το preview ήδη
  δείχνει το τελικό)· pointerup **no-op** ή **Esc/cancel**→`reset()` (restore originals, κανένα command).
- **Units:** το move δουλεύει σε **world** (`getLiveTranslation` ήδη snap-corrected) — καμία mm/drawing-unit
  μετατροπή (αυτές αφορούν μόνο την εντολή στο release).
- **Αρχεία:** ΝΕΑ `bim3d-edit-live-preview.ts` (pure THREE class: capture/applyMove/applyRotate/applyResize/
  commit/reset) + `bim3d-preview-rebuild.ts` (resize rebuild via converters + `resolveEntityBuilding` base
  elevation· διαβάζει τα ΙΔΙΑ canonical sources με το `BimSceneLayer` **χωρίς** να το αγγίζει)· MOD
  `bim-gizmo-drag-bridge` (`getLiveRotationRad`), `bim-gizmo-controller` (`getLivePreview` peek),
  `bim3d-edit-interaction-handlers` (capture/apply/commit-vs-reset· `dispatchOutcome` → boolean),
  `use-bim3d-edit-interaction` (instantiate + teardown reset).
- **Limitations (διορθώνονται στο release resync):** γειτονικά miters τοίχων & hosted κουφώματα ΔΕΝ
  ακολουθούν live σε move/rotate (Revit-parity· είναι άλλες οντότητες)· resize-live μόνο σε single-floor
  scope (`floor3DScope='all'`→commit-on-release)· attached top/base profiles flat κατά το resize drag.

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
- **2026-07-22 (Opus 4.8) §hide-drag-overlays — απόκρυψη snap marker + snap-type label + move-distance readout στο 3D edit drag (Giorgio screenshot, UNCOMMITTED, 🔴 browser verify).** Ο Giorgio (στιγμιότυπο μετακίνησης generic solid) ζήτησε να ΜΗΝ εμφανίζονται κατά τη μετακίνηση: (1) ο **κύβος** (3D snap marker, wireframe box) + (2) η **λέξη «Κάθετος»** (snap-type label, perpendicular snap) + (3) οι **μετρήσεις αποστάσεων** («130,15 cm», live move-distance readout). Διαβάζονται ως οπτικός θόρυβος. **Fix (2 αρχεία, μόνο το edit-drag path — το placement/άλλα contexts ανέγγιχτα):** (α) `bim-gizmo-controller.ts updateDrag()` — αφαιρέθηκε το `showSnapMarker()` call· ο marker μένει κρυμμένος (`hideSnapMarker` κάθε frame για μηδέν residual). (β) `bim3d-edit-live-preview-apply.ts` move branch — αφαιρέθηκαν οι `updateSnapLabel(ctx)` + `updateMoveReadout(ctx, t)` calls + διαγράφηκαν οι δύο πλέον-αχρησιμοποίητοι helpers. **Το snapping ΠΑΡΑΜΕΝΕΙ ενεργό** (η θέση διορθώνεται) — κρύβεται μόνο το οπτικό feedback. Η **dashed alignment line** (`updateAlignmentLine`) + τα **wall temporary dimensions** (`updateWallMoveDims`, μόνο σε τοίχους) **διατηρήθηκαν** (δεν ζητήθηκαν ρητά· pending Giorgio confirmation αν θέλει να φύγουν κι αυτά ως «μετρήσεις»). Τα overlay classes (`TempSnapLabelOverlay`/`TempMoveReadoutOverlay`/`showSnapMarker`) **δεν** διαγράφηκαν — τα χρησιμοποιεί το placement + tests. **Tests:** 252/252 (gizmo+animation) GREEN, tsc SKIP (N.17). Αρχεία: `bim-gizmo-controller.ts`, `bim3d-edit-live-preview-apply.ts` (+ ADR-402). 1 domain (3D gizmo). ✅ Google-level: YES — απόκρυψη μόνο στο edit path (surgical), snapping ανέπαφο, μηδέν επίδραση σε placement/tests. Stage ADR-402 (CHECK 6B/6D). 🔴 browser-verify (μετακίνηση 3Δ → κανένας κύβος/«Κάθετος»/απόσταση).
- **2026-07-22 (Opus 4.8) §axis-snap-jitter — 🐛 FIX: το αντικείμενο έκανε εγκάρσιο ζικ-ζακ κατά το drag βέλους άξονα (Giorgio screenshot, UNCOMMITTED, 🔴 browser verify).** Σύμπτωμα: επιλογή στοιχείου 3Δ → σύρσιμο του **βέλους ενός άξονα** (X/Z move arrow) → ενώ κινείται στην κατεύθυνση του βέλους, το αντικείμενο **ταλαντώνεται κάθετα** στον άξονα (jitter/zig-zag, κόκκινο βελάκι στο στιγμιότυπο). **Root cause:** το `applySnap()` (`bim-gizmo-drag-bridge.ts`) ρωτούσε το snap engine για ολόκληρο το 2D plan σημείο (`snapFn({x,y})`) και εφάρμοζε **ΚΑΙ τις δύο** συνιστώσες της snapped θέσης — **ακόμα και για single-axis (X/Z) constraint**. Καθώς ο δείκτης περνούσε κοντά σε off-axis features (γωνίες/άκρα κάθετα στον άξονα), το snap τραβούσε το στοιχείο εγκάρσια· βγαίνοντας απ' το tolerance γύρναγε στη raw on-axis θέση → oscillation. Το `axis-Y` / `resize-Y` είχαν ήδη guard (return νωρίς)· το **X/Z όχι**. **Fix (1 αρχείο, class-of-bug):** για `constraint.kind === 'axis' | 'resize'` προβάλλουμε τη snap-διορθωμένη μετατόπιση **ΜΟΝΟ στον άξονα του drag** (`snappedTranslation.copy(axisDir).multiplyScalar(snappedTranslation.dot(axisDir))`) — κρατάμε το on-axis snap component, μηδενίζουμε την κάθετη. Είναι η Revit/AutoCAD συμπεριφορά «object-snap + ortho/polar tracking» (το snap point προβάλλεται στη γραμμή του άξονα). `plane`/`endpoint` drags κρατούν το πλήρες 2D snap (σωστό). **Tests:** νέο regression `axis-X drag drops the perpendicular component of an off-axis snap` στο `bim-gizmo-drag-bridge.test.ts` (off-axis snap (5200,−3000) σε axis-X → deltaDxf.x=5200 kept, y=0 dropped). **189/189 gizmo tests GREEN**, tsc SKIP (N.17). Αρχεία: `bim-gizmo-drag-bridge.ts`, `__tests__/bim-gizmo-drag-bridge.test.ts` (+ ADR-402). 1 domain (3D gizmo). ✅ Google-level: YES — axis-constrained snapping = on-axis projection (μηδέν εγκάρσια διαρροή), regression test κλειδώνει τη συμπεριφορά, μηδέν επίδραση σε plane/endpoint. Stage ADR-402 (CHECK 6B/6D). 🔴 browser-verify (επίλεξε στοιχείο 3Δ → σύρε βέλος X/Z → ομαλή κίνηση στον άξονα, χωρίς κάθετο τρέμουλο).
- **2026-07-22 (Opus 4.8) §gizmo-cleanup (extension) — αφαιρέθηκαν και τα resize «διαμαντάκια» της ΣΚΑΛΑΣ (Giorgio screenshot, UNCOMMITTED, 🔴 browser verify).** Το §gizmo-cleanup της 2026-06-29 είχε αφαιρέσει τα resize octahedra από column/wall (+ beam/slab από ADR-408 Φ1), αφήνοντας **μόνο τη `stair`** να τα εκθέτει. Ο Giorgio (νέο στιγμιότυπο επιλεγμένης σκάλας 3Δ) ζήτησε να φύγουν και από εκεί — τα ίδια «διαμαντάκια» (`resize-x/-z/-y/-m-y`) διαβάζονται ως θόρυβος. **Fix:** το `RESIZE_HANDLES_BY_TYPE` (`bim-gizmo-overlay-handles.ts`) έγινε **ΚΕΝΟ** → **κανένας** BIM τύπος δεν εκθέτει πλέον resize handle. Πλάτος / Πλήθος Σκαλιών (run) / Ύψος / βάση της σκάλας εκδίδονται ΟΛΑ από το contextual panel «Ιδιότητες Κλίμακας» (ήδη υπάρχον, φαίνεται στο screenshot) — Revit-faithful, ίδιο σκεπτικό με column/wall/beam/slab. Το geometry (`gizmo-geometry.ts`) χτίζει ακόμη τα octahedra μία φορά αλλά το `applyActiveHandles` τα κρατά **κρυφά + μη-hittable** για κάθε επιλογή (μηδέν orphan). Η resolveResize*/`bim3d-resize-bridge` λογική μένει ανέγγιχτη (dead-but-intact, future opt-in· knip ignores dxf-viewer). **Tests:** `bim-gizmo-overlay.test.ts` ενημερωμένα — τα 2 mechanism-vehicle tests (shared-visual lock + collapse-to-move) οδηγούνται πλέον με **ρητό id-set** (decoupled από τον per-type πίνακα, πιο robust)· το «stair KEEPS resize» flip-άρισε σε «stair exposes NO resize». **188/188 gizmo tests GREEN**, jscpd:diff clean, tsc SKIP (N.17). Αρχεία: `bim-gizmo-overlay-handles.ts`, `gizmo-geometry.ts` (stale comment), `__tests__/bim-gizmo-overlay.test.ts` (+ ADR-402). 1 domain (3D gizmo). ✅ Google-level: YES — ΚΕΝΟ SSoT table (μηδέν per-type ασυνέπεια), sizes via panel (Revit-faithful), tests ελέγχουν τον μηχανισμό όχι τον τύπο. Stage ADR-402 (CHECK 6B/6D). 🔴 browser-verify (επίλεξε σκάλα 3Δ → κανένα κόκκινο διαμαντάκι, μένουν βέλη + κίτρινο δαχτυλίδι περιστροφής).
- **2026-07-15 (Opus 4.8) §cross-mode-selection** — **Η επιλογή 2D διατηρείται στη μετάβαση 2D↔3D (Giorgio, UNCOMMITTED, 🔴 browser verify).** Αίτημα: επιλέγω οντότητες στο 2D, πάω 3D → να **παραμένουν επιλεγμένες** (και αμφίδρομα, «τα πάντα»: DXF/BIM/MEP…). **Αρχή (Revit/ArchiCAD): ΜΙΑ αλήθεια = universal `SelectedEntitiesStore` (ADR-532)·** το `Selection3DStore` είναι προβολή της για το 3D highlight. **Δύο κενά που διορθώθηκαν:** (1) **2D→3D:** δεν υπήρχε hydration — μπαίνοντας 3D το `Selection3DStore` έμενε άδειο. Νέο `hydrateBimSelectionFromUniversal` (`scene-manager-actions.ts`, reuse `resolveBimEntityType`) + method `hydrateSelectionFromUniversal` στον manager, καλείται στο mount effect του `BimViewport3D` μετά το `resyncBimScene`: διαβάζει `SelectedEntitiesStore.getSelectedEntityIds()`, φωτίζει όσα έχουν 3D geometry (τα υπόλοιπα μένουν selected στο universal, απλώς χωρίς mesh εδώ). (2) **3D→2D wipe (ADR-543 fragility):** ο `use-3d-selection-universal-bridge` sync απέκτησε **mode-guard** (`mode==='2d' → skip`): το teardown `clearSelection()` του `BimViewport3D` unmount τρέχει **αφού** το `toggle2D3D()` έχει ήδη βάλει `mode='2d'` → ο push παρακάμπτεται → το universal **επιβιώνει** (πριν: σβηνόταν). **Re-entrancy guard:** νέο `withSuppressed3DToUniversalSync` — το hydration write στο 3D store δεν κάνει echo πίσω (αλλιώς `replaceEntitySelection([3D-subset])` θα **πετούσε** τις non-3D οντότητες από το universal). Νέα bulk action `Selection3DStore.setSelection(ids, types)` (atomic set, ένα subscribe fire). **Documented limitation:** αλλαγή επιλογής **μέσα** στο 3D (replace/toggle click) συμπτύσσει το universal στο 3D-visible subset (drop των non-3D) — η replace-semantics του υπάρχοντος bridge· follow-up = delta-based merge αν χρειαστεί. Αρχεία: `Selection3DStore.ts`, `use-3d-selection-universal-bridge.ts`, `scene-manager-actions.ts`, `ThreeJsSceneManager.ts`, `BimViewport3D.tsx` (+ ADR-402/532). 1 domain (selection).
  - **Addendum (2026-07-15) — raw DXF (πολυγραμμή) 3D→2D wipe, robust fix:** το mode-guard εξαρτιόταν από το ότι ο bridge sync διαβάζει `mode==='2d'` **έγκαιρα** στο teardown — εύθραυστο υπό HMR (η bridge subscription στήνεται **μία φορά** στο `DxfViewerContent` mount· edit του module δεν την ξανα-subscribe-άρει, κρατά το παλιό closure). Έκανα το unmount clear **timing/HMR-ανεξάρτητο**: το `BimViewport3D` unmount τυλίγει το `useSelection3DStore.clearSelection()` σε `withSuppressed3DToUniversalSync` → ο push **ποτέ** δεν διαδίδεται → η 2D επιλογή (raw DXF picked-in-3D **ΚΑΙ** BIM) επιβιώνει ανεξαρτήτως mode-timing. Το mode-guard μένει ως δεύτερο δίχτυ. Νέο integration test `use-3d-selection-universal-bridge.test.tsx` (3 tests: polyline-suppress-survives· mode-guard-2d· genuine-in-3D-clear-propagates) — **PASS**. **⚠️ Live instance:** χρειάζεται **FULL page reload** (Ctrl+Shift+R), όχι HMR, για να φορτωθεί η νέα bridge subscription.
  - **Addendum 2 (2026-07-15, Opus 4.8) — ΠΡΑΓΜΑΤΙΚΗ root cause (ground-truth instrumentation, ✅ οριστική διάγνωση):** τα δύο προηγούμενα fixes **δεν έλυναν** το bug («πάλι τα ίδια») γιατί κυνηγούσαν τον bridge/suppress/scope — ενώ ο wipe **ποτέ δεν περνούσε από τον bridge**. Με 4 temp debug logs + `console.trace` στο `SelectedEntitiesStore.commit()` (universal SSoT) πιάστηκε το ακριβές stack: **`use-bim3d-pointer-handlers.ts:175` → `clearByType('dxf-entity')`**. **Αιτία:** το κουμπί **«← 2D»** (και κάθε floating chrome: ViewCube/panels/toggles) ζει **μέσα** στο viewport `<div onClick={handleClick}>`· το click του **bubble-άρει** στο `handleClick`, το raycast αστοχεί (πάνω αριστερά = άδειος 3D χώρος) → το **empty-space branch** τρέχει `manager.selectBimEntity(null)` + `SelectedEntitiesStore.clearByType('dxf-entity')` → **σβήνει ΟΛΗ την επιλογή** (BIM+DXF) σύγχρονα, **πριν** το `toggle2D3D()` κάνει unmount. Γι' αυτό γύρναγες πάντα 2D με άδεια επιλογή. **Fix (big-player, class-of-bug, 1 guard):** στην αρχή του `handleClick`, μετά το `stopPropagation`, `const rendererCanvas = managerRef.current?.getRendererCanvas(); if (rendererCanvas && e.target !== rendererCanvas) return;` — ο scene picker δρα **μόνο** σε γνήσια clicks του renderer canvas. **Zero-regression:** τα camera-projected overlays (`BimOverlayDispatchCanvas`) είναι `pointer-events-none` → scene **ΚΑΙ** grip clicks φτάνουν στο renderer canvas (`e.target===rendererCanvas`, περνούν)· γνήσιο κλικ σε άδειο 3D χώρο → deselect δουλεύει (Revit)· click σε chrome (← 2D/ViewCube/panel) → φιλτράρεται → η επιλογή επιβιώνει. Καλύπτει **όλους** τους τύπους (DXF/BIM/MEP). Το v1 fix (suppress+mode-guard+hydration) **μένει** — απαραίτητο για 2D→3D hydration + genuine in-3D edits. Αρχείο: `use-bim3d-pointer-handlers.ts` (+ αφαίρεση 4 temp debug: PICK/EXIT/2D/WIPE από `use-bim3d-pointer-handlers.ts`/`BimViewport3D.tsx`/`dxf-canvas-renderer.ts`/`SelectedEntitiesStore.ts`). 1 domain. 🔴 browser verify (3D→κλικ πολυγραμμή→← 2D→**μένει επιλεγμένη**).
- **2026-06-29 (Opus 4.8) §gizmo-cleanup** — **Καθαρισμός οπτικού θορύβου gizmo (Giorgio screenshot, UNCOMMITTED, 🔴 browser verify)**. Τρία αιτήματα από στιγμιότυπο επιλεγμένης κολώνας 3Δ: **(1+3)** τα **κάθετα resize «διαμαντάκια»** (χρυσαφί octahedra `resize-y` πάνω + `resize-m-y` κάτω, χρώμα `GIZMO_COLOR_HOVER`) εμφανίζονταν «στη θέση του κάθετου άξονα» και διαβάζονταν ως σύγχυση. **Αφαιρέθηκαν από `column` + `wall`** στο `RESIZE_HANDLES_BY_TYPE` (`bim-gizmo-overlay-handles.ts`) → πλέον **μόνο `stair`** εκθέτει resize handles (ύψος/βάση κολώνας/τοίχου → contextual tab «Ύψος»· διατομή X/Z → Type· Revit-faithful, συνεπές με beam/slab). Η resolveResize* λογική + το bridge μένουν ανέπαφα (τα καλεί ακόμη το stair). **(2)** το **κυκλάκι στη συμβολή των αξόνων** (origin reticle: circle 0x444444 + crosshair) + οι **αρνητικοί ημιάξονες** που «προχωρούσαν προς τα πίσω» (`NEG_AXIS_*` faint half-lines) αφαιρέθηκαν στο `gizmo-geometry.ts`· **κρατήθηκε** το αόρατο `centerOriginHit` hitbox ώστε το κέντρο να μένει hover/drag-activatable. Boy-Scout (CHECK 3.22): νεκρή πλέον `buildOriginReticle` (`gizmo-handle-builders.ts`) + σταθερές `RETICLE_*`/`NEG_AXIS_*` (`gizmo-constants.ts`) διαγράφηκαν. Tests `bim-gizmo-overlay.test.ts` ενημερωμένα (column → κανένα resize ορατό· collapse-test → stair). **⚠️ 3 προϋπάρχοντα fails** (`.visible` checks σε snap/base-point markers) προέρχονται από ADR-537 (post-FX overlay, άλλος agent UNCOMMITTED) — επιβεβαιωμένα ίδια και χωρίς τις αλλαγές αυτές. 6 αρχεία (4 src + 1 test + ADR), 1 domain. Stage ADR-402 (CHECK 6B/6D).
- **2026-06-01 (Opus 4.8)** — **🐛 FIX (cross-cutting ADR-401/402/404, handoff «attached element vanish»): 3Δ gizmo move/rotate εκτόξευε wall/column/beam/slab 1000× εκτός οθόνης σε σχέδιο μη-mm** (pending commit, ✅ browser-verified τοίχος+δοκάρι, runtime instrumentation). Σύμπτωμα Giorgio: μετακίνηση/περιστροφή τοίχου/δοκαριού/κολώνας σε 3Δ → το στοιχείο **εξαφανίζεται** στο release· F5 το επαναφέρει στην αρχική (δεν persist-άρει). **Διάγνωση (runtime console.log στο resync/persist/syncWalls):** το mesh χτιζόταν κανονικά (`meshNull=false`, παρόν στο store, ΚΑΝΕΝΑ drop/revert) — άρα **οπτικός** vanish, όχι αφαίρεση. Το `bboxCenter` αποκάλυψε εκτόξευση: τοίχος `start=(10,7)` → μετά από μικρή μετακίνηση `start=(10,−5593)` (5.6 km), `sceneUnits='m'`. **Root cause:** το `mmToEntityUnitFactor` (που ο stair-fix εισήγαγε) επέστρεφε `1` για wall/column/beam/slab με τη ρητή υπόθεση «αποθηκεύουν raw mm» — **λάθος για non-mm σχέδια** (το «Ισόγειο 1.dxf» είναι μέτρα: `start/end` σε m). Το gizmo delta/pivot έρχεται σε **mm** (`worldDeltaToDxfDelta` ×1000) και εφαρμοζόταν ως μέτρα → ×1000. **Fix (μηδέν άγγιγμα persist/άλλου agent):** `mmToEntityUnitFactor` → `mmScaleFor(params)` = `mmToSceneUnits(sceneUnits ?? 'mm')` για τους 4 τύπους (mm-scene → `1` byte-for-byte· m-scene → `0.001`· cm → `0.1`). `bim3d-edit-command-builders`: ο factor εφαρμόζεται πλέον στο **move delta + rotate pivot** ΚΑΙ σε **single ΚΑΙ multi-select** (από τον primary entity — όλα τα στοιχεία ενός σχεδίου μοιράζονται units· mixed-unit batch μένει documented limitation). Αρχεία: `bim3d-edit-math.ts`, `bim3d-edit-command-builders.ts`. Tests: `bim3d-edit-math.test.ts` ανανεωμένο (mm=1 / absent=1 / m=0.001 / cm=0.1 για τους 4 τύπους + stair αμετάβλητα) → **12/12 PASS**, tsc 0. **⚠️ Same-root latent (flagged):** ο stair snap-from-grips (`buildDragSnapFn`) παραμένει unit-mixed (προϋπάρχον flag)· **resize path** δεν ελέγχθηκε για non-mm — πιθανό follow-up. **Open (ξεχωριστό):** rectangular κολώνα σε ~90° rotate «φαίνεται mirror» — στατικά σωστό (converter(rotateCCW θ)≡rotateY θ)· αναμένεται small-angle verify.
- **2026-06-01 (Opus 4.8, Developer A SOLO)** — **Live preview: η οντότητα ακολουθεί ζωντανά τον κέρσορα κατά το drag** (pending commit, 🔴 browser verify). Πρόβλημα Giorgio: κατά το σύρσιμο βέλους gizmo (μετακίνηση/περιστροφή/κάθετο/resize) κινούνταν **μόνο το gizmo overlay**· το ίδιο το mesh έμενε ακίνητο και «πηδούσε» στη νέα θέση μόνο στο `pointerup`. Απαντήσεις Giorgio: (Q1) **να κινείται το ίδιο το αντικείμενο** (Revit/Forge, όχι ghost clone)· (Q2) **FULL** (όλες οι κινήσεις). **Στρατηγική hybrid:** (α) **move/κάθετο/rotate → rigid live mesh transform** — κάθε οντότητα είναι direct child του `bimLayer.group` (identity → world space), οπότε world translate/rotate εφαρμόζεται απευθείας στα `position`/`quaternion`· για την επιλεγμένη οντότητα ταυτίζεται ΑΚΡΙΒΩΣ με την εντολή (DXF CCW θ ≡ world +Y θ, αφού world z = −DXF y). (β) **resize → per-frame geometry rebuild της ΜΙΑΣ οντότητας** μέσω των ΥΠΑΡΧΟΝΤΩΝ converters (`wallToMesh`/…) + `compute*ResizeParams` + `compute*Geometry` (ghost === commit). **Lifecycle:** capture@down → apply@move (`markSceneDirty`, ΟΧΙ νέο rAF) → committed@up `commit()` (το resync αντικαθιστά, μηδέν πήδημα) / no-op ή Esc `reset()` (restore, κανένα command)· `dispatchOutcome` επιστρέφει πλέον boolean (committed). **Αρχεία:** ΝΕΑ `bim3d-edit-live-preview.ts` (pure THREE) + `bim3d-preview-rebuild.ts` (resize via converters, διαβάζει `Bim3DEntitiesStore` + `resolveEntityBuilding` — **δεν αγγίζει** `BimSceneLayer`)· MOD `bim-gizmo-drag-bridge` (`getLiveRotationRad`), `bim-gizmo-controller` (`getLivePreview` peek), `bim3d-edit-interaction-handlers`, `use-bim3d-edit-interaction`. Tests: ΝΕΟ `bim3d-edit-live-preview.test.ts` (move/rotate/reset/commit/resize-swap) + `bim-gizmo-drag-bridge` (`getLiveRotationRad`) → 25/25 (live-preview+drag-bridge) PASS, tsc 0. **Limitations:** miters γειτόνων & hosted κουφώματα δεν ακολουθούν live σε move/rotate (διόρθωση στο release resync, Revit-parity)· resize-live μόνο single-floor scope· attached top/base profiles flat κατά το resize drag.
- **2026-06-02 (Opus 4.8, Developer A SOLO)** — **Κάθετο βελάκι ΜΕΤΑΚΙΝΗΣΗΣ (axis-Y move) σε ΟΛΑ τα στοιχεία** (pending commit, 🔴 browser verify). Πρόβλημα Giorgio: το gizmo είχε μόνο 2 **οριζόντια** βελάκια μετακίνησης (X κόκκινο, Z μπλε)· έλειπε το **κάθετο** (Y πράσινο = πάνω-κάτω). Σύγχυση ονομασίας: ο «άξονας Z» (κάθετος, AutoCAD) = **Y** στο three.js engine. Το `axis-y` ήταν εξ αρχής εκτός `BASE_HANDLES` (σκόπιμα, Phase A). **Υλοποίηση (mirror του resize-y precedent):** (1) `bim-gizmo-overlay.ts` → `axis-y` στα `BASE_HANDLES` (το βέλος+hitbox υπήρχαν ήδη στη γεωμετρία). (2) `bim-gizmo-drag-bridge.ts` → `BridgeOutcome.move` απέκτησε `deltaUpMm` (reuse `worldUpDeltaToMm`)· none-guard + snap-exclusion για axis-Y (η κάθετη μετακίνηση δεν snap-άρει plan, mirror resize-Y). (3) ΝΕΟ SSoT `bim3d-vertical-move.ts` (sibling του `bim3d-resize-bridge`): pure per-type elevation patch — wall/column `baseOffset`, beam `topElevation`, slab `levelElevation`, stair `basePoint.z` (×`mmToEntityUnitFactor`, drawing-units)· όλα +up (ADR-369). (4) `bim3d-edit-interaction-handlers.ts` → move arm route σε `buildVerticalMoveCommand` όταν `deltaUpMm≠0`· single → `Update*ParamsCommand`, multi → `CompoundCommand` (ΕΝΑ undo, μικτοί τύποι). `EditCommand` union += `CompoundCommand` + `UpdateStairParamsCommand` (έλειπε → tsc latent fix)· dispatch guard για optional `validate()`. (5) **Converter wiring (κρίσιμο):** ο **flat** path `wallToMesh`/`columnToMesh` αγνοούσε το `baseOffset` στο `mesh.position.y` → η κάθετη μετακίνηση τοίχου/κολώνας δεν φαινόταν· τώρα `(floorElevationMm + baseOffset)·MM_TO_M` ΜΟΝΟ στο flat path (το profiled/attached path ψήνει ήδη το baseOffset → αποφυγή διπλομέτρησης). beam/slab/stair αντιδρούσαν ήδη. Tests: ΝΕΑ `bim3d-vertical-move.test.ts` (12) + `wall-column-base-offset-y.test.ts` (5)· +`bim-gizmo-overlay` (axis-Y σε όλους) +`bim-gizmo-drag-bridge` (vertical move outcome). 103/103 (gizmo+converters+vertical) PASS, tsc 0 (όλη η εφαρμογή). **Documented limitations:** attached τοίχος → vertical move γράφει baseOffset (resolver μπορεί να το override-άρει· πιθανό follow-up «drag breaks attach»)· mixed-unit multi με σκάλα = OK (per-entity factor, σε αντίθεση με planar `MoveMultipleEntitiesCommand`).
- **2026-05-31 (Opus 4.8)** — **Wall axis-Y resize → ΔΥΟ grips (ADR-401 E.3 consumer)** (pending commit, 🔴 browser verify). Το `RESIZE_HANDLES_BY_TYPE.wall` axis-Y έσπασε σε **top** (`resize-y`, +Y → `height`) + **base** (`resize-m-y`, −Y → `baseOffset`, με αντίστροφο `height` ώστε η κορυφή να μένει σταθερή). Αξιοποιεί την υπάρχουσα `GizmoResizeMode 'normal'|'mirror'` (ήδη ρέει gizmo-types→parseHandleId→handleToConstraint→drag-bridge→`ResizeDragMm`) — **μηδέν νέο taxonomy**. `gizmo-geometry.ts`: δεύτερο Y octahedron @`−RESIZE_HANDLE_OFFSET` (όλα τα hitboxes του πάνω→`resize-y`, του κάτω→`resize-m-y`· X/Z αμετάβλητα). `bim3d-resize-bridge.computeWallResizeParams`: branch ανά `mode` + detach-on-drag (`detachWallSide` SSoT, Revit «edit breaks attach») — λεπτομέρειες στο **ADR-401 §5/§8**. Μόνο ο τοίχος (beam/column/slab κρατούν single vertical handle). Tests: `bim3d-resize-bridge.test.ts` +7, `bim-gizmo-overlay.test.ts` +2, `gizmo-hit-test` 3/3 αμετάβλητο, tsc 0.
- **2026-06-02 (Opus 4.8, Developer A SOLO)** — **🐛 FIX (cross-cutting): 3Δ gizmo edit δεν persist-άρει →
  optimistic revert** (pending commit). Σύμπτωμα: σκάλα → 3Δ move → πάει στη σωστή νέα θέση, μετά **επιστρέφει
  ακαριαία στην αρχική + αποεπιλέγεται**. **Root cause (ΟΛΟΙ οι BIM τύποι, όχι μόνο σκάλα):** το per-type
  Firestore persistence (`useStairPersistence`/`useWallPersistence`/…) κάνει auto-save **μόνο** το
  `primarySelectedId`, και το diff-merge subscription **επαναφέρει** κάθε scene-entity που δεν είναι «dirty»
  στα remote params. Το `primarySelectedId` προκύπτει από το **`universalSelection`** (2Δ), αλλά η **3Δ
  επιλογή** (`Selection3DStore`) **δεν** το τροφοδοτούσε → το 3Δ edit δεν μάρκαρε ποτέ dirty → δεν
  persist-άρει → snapshot revert. (Το Phase A/B «walls work» αφορούσε μόνο «εμφανίζεται gizmo» — η 3Δ
  persistence δεν είχε επαληθευτεί ποτέ.) **Fix (full SSoT, Revit/ArchiCAD unified-selection model, απόφαση
  Giorgio «full enterprise + SSoT»):** νέο one-way bridge `use3DSelectionUniversalBridge`
  (`bim-3d/systems/selection/`) — mirror της 3Δ επιλογής στο `universalSelection.replaceEntitySelection`
  (BIM entities = `dxf-entity`), με value diff-guard (loop-safe, καμία universal→3Δ φορά) + zustand subscribe
  (fires μόνο σε αλλαγή 3Δ set → pure-2Δ session ανέπαφο). Mount στο `DxfViewerContent`. **ΜΗΔΕΝ per-type
  wiring** — το ΥΠΑΡΧΟΝ auto-save των 7 hosts ενεργοποιείται αυτόματα για move/rotate/resize ΟΛΩΝ· bonus:
  το 2Δ contextual ribbon ακολουθεί την 3Δ επιλογή. Selection3DStore/Bim3DEditStore/gizmo/edit-math 88/88
  PASS, tsc 0. 🔴 browser verify (σκάλα **+ τοίχος**: move/rotate/resize → μένει στη νέα θέση μετά το release).
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
