/**
 * Parametric grip-kind discriminator unions — extracted from `grip-types.ts`
 * (SRP / Google file-size standard N.7.1). These are the per-entity grip-kind
 * string-literal unions referenced by `GripInfo` and consumed across the grip
 * subsystem. Re-exported from `grip-types.ts` for backward compatibility, so
 * existing `import { WallGripKind } from '../grip-types'` call-sites keep working.
 *
 * MEP heating / underfloor kinds live in the sibling module
 * `grip-kinds-mep-heating.ts` and are re-exported below.
 */

export type {
  MepRadiatorGripKind,
  MepBoilerGripKind,
  MepUnderfloorGripKind,
} from './grip-kinds-mep-heating';

/** Grip type enumeration */
export type GripType = 'vertex' | 'center' | 'edge' | 'corner' | 'midpoint';

/**
 * ADR-358 Phase 5b + ADR-393 — Stair grip kind (parametric grip type).
 *
 * ADR-358 Phase 5b base grips: base point translate, direction rotate, width
 * resize, length (stepCount) resize.
 *
 * ADR-393 (2026-05-28) extends with asymmetric corner grips + a mid-front
 * start grip + per-flight landing-edge grips (replacing the legacy
 * `stair-split` centroid grip) + landing depth / corner-radius grips:
 *   - `stair-corner-{start,end}-{left,right}` → 2-DOF asymmetric (mirror
 *     ADR-363 Phase 1C-bis wall corners): axial moves nearest end, perp grows
 *     width symmetrically with axis recenter.
 *   - `stair-start-side` → mid-front edge, moves basePoint along direction.
 *   - `stair-flight1-end` / `stair-flight2-start` → landing entry/exit edges
 *     (L/U/Γ only); replace the removed `stair-split` ratio grip.
 *   - `stair-landing-depth` → resize landing depth (L/U/Γ only).
 *   - `stair-landing-corner-radius` → resize landing corner radius (emitted
 *     only when `landingCornerStyle !== 'sharp'`).
 *
 * See `bim/stairs/stair-grips.ts`.
 */
export type StairGripKind =
  | 'stair-base'
  | 'stair-direction'
  | 'stair-width'
  | 'stair-length'
  // ADR-393 Phase A1 — asymmetric corner grips (straight)
  | 'stair-corner-start-left'
  | 'stair-corner-start-right'
  | 'stair-corner-end-left'
  | 'stair-corner-end-right'
  // ADR-393 Phase A2 — mid-front start grip (straight)
  | 'stair-start-side'
  // ADR-393 Phase B1 — per-flight landing edges (L/U/Γ) — replace 'stair-split'
  | 'stair-flight1-end'
  | 'stair-flight2-start'
  // ADR-393 Phase B2 — landing depth + corner radius (L/U/Γ)
  | 'stair-landing-depth'
  | 'stair-landing-corner-radius';

/**
 * ADR-362 Phase I2 — Dimension grip kind.
 * Routes grip commit through `applyDimensionGripDrag` + direct scene patch
 * instead of the standard `StretchEntityCommand` vertex path.
 * See `hooks/dimensions/useDimensionGrips.ts`.
 */
export type DimensionGripKind =
  | 'dim-defpoint-0'  // ext line origin 1 → defPoints[0]
  | 'dim-defpoint-1'  // ext line origin 2 → defPoints[1]
  | 'dim-line-ref'    // dim line reference → defPoints[2]
  | 'dim-text'        // text label → textMidpoint
  | 'dim-extra';      // type-specific 5th grip (rotation handle / arcPoint / datum / etc.)

/**
 * ADR-363 Phase 1C — Wall grip kind (parametric grip type).
 * Routes commit through `applyWallGripDrag()` + `UpdateWallParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Wall grips exposed by `WallEntity` (`bim/walls/wall-grips.ts`):
 *   - `wall-start`     → translate axis start endpoint
 *   - `wall-end`       → translate axis end endpoint
 *   - `wall-midpoint`  → translate whole wall (axis midpoint anchor)
 *   - `wall-thickness` → resize thickness perpendicular to axis (symmetric)
 *   - `wall-curve`     → move quadratic Bezier control point (curved kind only)
 *   - `wall-vertex-N`  → translate polyline interior vertex N (polyline kind only)
 *
 * Phase 1C-bis (2026-05-27) — Asymmetric corner grips (ArchiCAD / Vectorworks /
 * AutoCAD reference-line pattern). Each corner exposes 2 DOF:
 *   - axial component → moves only the nearest axis endpoint (start or end);
 *   - perpendicular component → grows/shrinks ONLY the corner's side, keeps
 *     the opposite face fixed, and re-centers the axis by half the displacement
 *     so the wall stays rectangular (parallel faces preserved).
 *
 *   - `wall-corner-start-pos` → start endpoint + positive perpendicular face
 *   - `wall-corner-start-neg` → start endpoint + negative perpendicular face
 *   - `wall-corner-end-pos`   → end   endpoint + positive perpendicular face
 *   - `wall-corner-end-neg`   → end   endpoint + negative perpendicular face
 *
 * Phase 1C-ter (2026-05-28) — `wall-midpoint` renders the 4-arrow MOVE glyph and
 * `wall-rotation` (a handle just outside the end short edge) renders the curved
 * ROTATION glyph — same icon vocabulary as the stair base/direction grips
 * (`stairGripGlyphShape`). `wall-rotation` rotates the whole wall around its
 * midpoint (anchor-relative swept angle, mirror of stair `rotateDirection`).
 */
export type WallGripKind =
  | 'wall-start'
  | 'wall-end'
  | 'wall-midpoint'
  | 'wall-thickness'
  | 'wall-rotation'
  | 'wall-corner-start-pos'
  | 'wall-corner-start-neg'
  | 'wall-corner-end-pos'
  | 'wall-corner-end-neg'
  | 'wall-curve'
  | `wall-vertex-${number}`;

/**
 * ADR-363 Phase 2.5 + facing-flip — Opening grip kinds (parametric grip types).
 * Routes commit through `applyOpeningGripDrag()` + `UpdateOpeningParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Grips (Revit parity — two independent flip axes):
 *   - `opening-move`        → drag the whole opening along the host wall axis.
 *   - `opening-rotation`    → click-to-toggle handing (left↔right hinge side).
 *   - `opening-facing`      → click-to-toggle openDirection (inward↔outward face).
 *                             Hinged kinds only (door / french-door).
 *   - `opening-corner-{ne,nw,sw,se}` → resize WIDTH along the wall (opposite jamb
 *     pinned). E corners (ne/se) move the end jamb, W corners (nw/sw) the start jamb.
 */
export type OpeningGripKind =
  | 'opening-move'
  | 'opening-rotation'
  | 'opening-facing'
  | 'opening-corner-ne'
  | 'opening-corner-nw'
  | 'opening-corner-sw'
  | 'opening-corner-se';

/**
 * ADR-363 Phase 3.5 + 3.6 — Slab grip kind (parametric grip type).
 * Routes commit through `applySlabGripDrag()` + `UpdateSlabParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Two grip families exposed by `SlabEntity` (`bim/slabs/slab-grips.ts`):
 *   - `slab-vertex-N`        → translate polygon outline vertex N (XY only, z preserved).
 *   - `slab-edge-midpoint-N` → insert new vertex at edge N midpoint + delta
 *                              (Phase 3.6 — splits edge `[N, N+1]`).
 */
export type SlabGripKind =
  | `slab-vertex-${number}`
  | `slab-edge-midpoint-${number}`;

/**
 * ADR-363 Phase 3.7a — Slab-opening grip kind (parametric grip type).
 * Routes commit through `applySlabOpeningGripDrag()` +
 * `UpdateSlabOpeningParamsCommand` instead of the standard `StretchEntityCommand`
 * vertex path.
 *
 * Two grip families exposed by `SlabOpeningEntity`
 * (`bim/slab-openings/slab-opening-grips.ts`):
 *   - `slab-opening-vertex-N`        → translate cutout outline vertex N
 *                                      (XY only, z preserved).
 *   - `slab-opening-edge-midpoint-N` → insert new vertex at edge N midpoint +
 *                                      delta (splits edge `[N, N+1]`).
 */
export type SlabOpeningGripKind =
  | `slab-opening-vertex-${number}`
  | `slab-opening-edge-midpoint-${number}`;

/**
 * ADR-417 Φ1-part-2 #2 — Roof grip kind (parametric grip type, Revit «Edit
 * Footprint»). Routes commit through `applyRoofGripDrag()` +
 * `UpdateRoofParamsCommand` instead of the standard `StretchEntityCommand`
 * vertex path.
 *
 * Two grip families exposed by `RoofEntity` (`bim/roofs/roof-grips.ts`):
 *   - `roof-vertex-N`        → translate footprint outline vertex N (XY only,
 *                              z preserved; `edges` count unchanged).
 *   - `roof-edge-midpoint-N` → insert new vertex at edge N midpoint + delta
 *                              (splits edge `[N, N+1]` + splices a copy of
 *                              `edges[N]` so `edges` stays in lockstep with
 *                              `outline.vertices`).
 */
export type RoofGripKind =
  | `roof-vertex-${number}`
  | `roof-edge-midpoint-${number}`;

/**
 * ADR-419 — Floor finish grip kind (parametric grip type).
 * Routes commit through `applyFloorFinishGripDrag()` +
 * `UpdateFloorFinishParamsCommand` instead of the standard
 * `StretchEntityCommand` vertex path.
 *
 * Two grip families exposed by `FloorFinishEntity`:
 *   - `floor-finish-vertex-N`        → translate footprint outline vertex N.
 *   - `floor-finish-edge-midpoint-N` → insert new vertex at edge N midpoint.
 */
export type FloorFinishGripKind =
  | `floor-finish-vertex-${number}`
  | `floor-finish-edge-midpoint-${number}`;

/**
 * ADR-363 Phase 5.5a + 5.5b + 5.5c — Beam grip kind (parametric grip type).
 * Routes commit through `applyBeamGripDrag()` + `UpdateBeamParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Grips exposed by `BeamEntity` (`bim/beams/beam-grips.ts`):
 *   - `beam-start`    → translate axis start endpoint
 *   - `beam-end`      → translate axis end endpoint
 *   - `beam-midpoint` → translate whole beam (axis midpoint anchor, moves
 *                       startPoint + endPoint + curveControl όπου υπάρχει)
 *   - `beam-rotation` → rotate the whole beam (startPoint + endPoint +
 *                       curveControl) about a picked centre / the axis midpoint.
 *                       Curved ROTATION glyph + 6-click ROTATE→Reference hot-grip,
 *                       full wall parity (mirror `wall-rotation`). Anchor-relative
 *                       swept angle via the shared `rotateAxisPointsAboutPivot`
 *                       SSoT (NEVER raw cos/sin).
 *   - `beam-curve`    → move quadratic Bezier control point (curved kind only;
 *                       seeded από axis midpoint όταν undefined)
 *   - `beam-width`    → resize width perpendicular to axis (symmetric γύρω από
 *                       axis midpoint). Clamps στο `MIN_BEAM_WIDTH_MM`. Mirror
 *                       του `wall-thickness` pattern (Phase 1C).
 *   - `beam-depth`    → Phase 5.5c — out-of-plane (gravity axis) dimension
 *                       indicator. Handle stands στο axis midpoint κατά το
 *                       NEGATIVE perpendicular (αντίθετη πλευρά από το
 *                       width handle), με offset `width/2 + DEPTH_GRIP_OFFSET_MM`
 *                       ώστε να είναι ξεκάθαρα έξω από το footprint.
 *                       Dashed visual indicator + label "d=Xmm" στον renderer.
 *                       Symmetric drag projection × 2 → new depth, clamps
 *                       στο `MIN_BEAM_DEPTH_MM`. Δεν αλλάζει το footprint
 *                       (depth ζει στον z-axis), μόνο το `params.depth`.
 */
export type BeamGripKind =
  | 'beam-start'
  | 'beam-end'
  | 'beam-midpoint'
  | 'beam-rotation'
  | 'beam-curve'
  | 'beam-width'
  | 'beam-depth';

/**
 * ADR-363 Phase 4.5 + 4.5b + Phase 8C — Column grip kind (parametric grip type).
 * Routes commit through `applyColumnGripDrag()` + `UpdateColumnParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Base grips exposed by `ColumnEntity` (`bim/columns/column-grips.ts`):
 *   - `column-center`   → translate `position` (anchor stays)
 *   - `column-rotation` → rotate γύρω από `position` (non-circular only)
 *   - `column-width`    → resize width on the far edge from anchor (= diameter
 *                          για `circular` + `polygon` kinds)
 *   - `column-depth`    → resize depth on the far edge from anchor (skipped
 *                          για `circular` + `polygon` kinds — depth meaningless)
 *
 * Variant-specific grips (Phase 4.5b — L-shape / T-shape):
 *   - `column-arm-length`    → L-shape only (`params.lshape.armLength`,
 *                               Y-axis δευτερεύοντος βραχίονα). Asymmetric
 *                               edge handle στο inner-corner edge κατά τοπικό
 *                               +Y. Drag projection × 1.
 *   - `column-arm-width`     → L-shape only (`params.lshape.armWidth`,
 *                               πάχος δευτερεύοντος βραχίονα). Asymmetric
 *                               edge handle στο inner-corner edge κατά τοπικό
 *                               +X. Drag projection × 1.
 *   - `column-flange-length` → T-shape only (`params.tshape.flangeLength`,
 *                               X-axis πέλματος). Symmetric — handle στη
 *                               δεξιά πλευρά πέλματος. Drag projection × 2
 *                               (mirror του column-width symmetric pattern).
 *   - `column-web-thickness` → T-shape only (`params.tshape.webThickness`,
 *                               πάχος κορμού κατά X). Symmetric — handle
 *                               στη δεξιά πλευρά κορμού. Drag projection × 2.
 *
 * Variant-specific grips (Phase 8C — I-shape):
 *   - `column-i-flange-thickness` → I-shape only (`params.ishape.flangeThickness`,
 *                                    πάχος πέλματος tf). Asymmetric edge handle
 *                                    στο top-flange bottom-edge midpoint κατά
 *                                    τοπικό +Y. Drag projection × 1 (bottom
 *                                    flange mirrors automatically μέσω geometry).
 *   - `column-i-web-thickness`    → I-shape only (`params.ishape.webThickness`,
 *                                    πάχος κορμού tw). Symmetric — handle στη
 *                                    αριστερή πλευρά κορμού. Drag projection
 *                                    × 2 (web centered around vertical axis).
 *
 * Όλες οι νέες διαστάσεις clamp στο `MIN_COLUMN_DIMENSION_MM` (250 mm) — εκτός
 * των I-shape plate thicknesses που clamp στο `MIN_I_PLATE_THICKNESS_MM` (5 mm).
 * Όταν `params.lshape` / `params.tshape` / `params.ishape` undefined, ο handler
 * materializes defaults από `width/3 + depth/3` (L) ή `width + depth/3` (T) ή
 * `DEFAULT_I_FLANGE_THICKNESS_MM` / `DEFAULT_I_WEB_THICKNESS_MM` (I) — mirror
 * των `computeColumnGeometry` defaults — ώστε το επόμενο drag να ξεκινά από τα
 * ήδη υπολογισμένα values. Circular + shear-wall kinds δεν εκπέμπουν
 * variant-specific grips (shear-wall = rect parity).
 */
export type ColumnGripKind =
  | 'column-center'
  | 'column-rotation'
  | 'column-width'
  | 'column-depth'
  | 'column-arm-length'
  | 'column-arm-width'
  | 'column-flange-length'
  | 'column-web-thickness'
  | 'column-i-flange-thickness'
  | 'column-i-web-thickness'
  // ADR-363 Phase 2b — manual parametric Π (U-shape χωρίς polygon) variant grips.
  | 'column-leg-thickness'
  | 'column-base-thickness'
  // ADR-363 Phase 2b — polygon-backed U-shape/composite per-vertex grips. The
  // vertex index is encoded in the kind string (mirror του `slab-vertex-${n}`
  // pattern) ώστε το dispatch να μη χρειάζεται ξεχωριστό index πεδίο.
  | `column-poly-vertex-${number}`;

/**
 * ADR-406 — MEP fixture (light fixture) grip kind (parametric grip type).
 * Routes commit through `applyMepFixtureGripDrag()` + `UpdateMepFixtureParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Grips exposed by `MepFixtureEntity` (`bim/mep-fixtures/mep-fixture-grips.ts`):
 *   - `mep-fixture-move`     → translate `position` (whole-entity MOVE glyph).
 *   - `mep-fixture-rotation` → rotate about `position` (curved ROTATION glyph;
 *                              rectangular only).
 *   - `mep-fixture-corner-{ne,nw,sw,se}` → two-direction resize of width × length.
 *     The DIAGONALLY-OPPOSITE corner stays pinned (anchor); the body grows/shrinks
 *     toward the dragged corner and `position` re-centres to the new box centre.
 *     ORTHO (F8) constrains the drag to the dominant local axis (pure width OR
 *     pure length). Clamped to `MIN_FIXTURE_DIMENSION_MM`.
 *   - `mep-fixture-diameter` → circular kind only: resize diameter (symmetric 2×,
 *                              centre fixed). Minimal fallback for the non-live
 *                              circular shape.
 */
export type MepFixtureGripKind =
  | 'mep-fixture-move'
  | 'mep-fixture-rotation'
  | 'mep-fixture-diameter'
  | 'mep-fixture-corner-ne'
  | 'mep-fixture-corner-nw'
  | 'mep-fixture-corner-sw'
  | 'mep-fixture-corner-se';

/**
 * ADR-408 Φ3 — Electrical panel grip kind (parametric grip type).
 * Routes commit through `applyElectricalPanelGripDrag()` +
 * `UpdateElectricalPanelParamsCommand` instead of the standard
 * `StretchEntityCommand` vertex path.
 *
 * Grips exposed by `ElectricalPanelEntity`
 * (`bim/electrical-panels/electrical-panel-grips.ts`) — full wall-parity mirror
 * of the rectangular MEP fixture (the panel is rectangular-only → no diameter):
 *   - `electrical-panel-move`     → translate `position` (whole-entity MOVE glyph).
 *   - `electrical-panel-rotation` → rotate about `position` (curved ROTATION glyph).
 *   - `electrical-panel-corner-{ne,nw,sw,se}` → two-direction resize of width ×
 *     length. The DIAGONALLY-OPPOSITE corner stays pinned (anchor); the body
 *     grows/shrinks toward the dragged corner and `position` re-centres. ORTHO
 *     (F8) constrains the drag to the dominant local axis (pure width OR pure
 *     length). Clamped to `MIN_PANEL_DIMENSION_MM`.
 */
export type ElectricalPanelGripKind =
  | 'electrical-panel-move'
  | 'electrical-panel-rotation'
  | 'electrical-panel-corner-ne'
  | 'electrical-panel-corner-nw'
  | 'electrical-panel-corner-sw'
  | 'electrical-panel-corner-se';

/**
 * ADR-408 Φ12 — Plumbing manifold grip kind (parametric grip type). Routes
 * commit through `applyMepManifoldGripDrag()` + `UpdateMepManifoldParamsCommand`.
 * Full wall-parity mirror of the electrical panel (rectangular-only → no diameter).
 *
 * The `outlet-add` / `outlet-remove` kinds are the Revit "array control" ▲/▼:
 * single-click ACTION grips (not drags) that bump `outletCount` ±1, routed through
 * `commitMepManifoldOutletCountGrip` (fire before the zero-delta guard, like
 * `opening-rotation`).
 */
export type MepManifoldGripKind =
  | 'mep-manifold-move'
  | 'mep-manifold-rotation'
  | 'mep-manifold-corner-ne'
  | 'mep-manifold-corner-nw'
  | 'mep-manifold-corner-sw'
  | 'mep-manifold-corner-se'
  | 'mep-manifold-outlet-add'
  | 'mep-manifold-outlet-remove';

/**
 * ADR-410 — Furniture grip kind (parametric grip type).
 * Routes commit through `applyFurnitureGripDrag()` +
 * `UpdateFurnitureParamsCommand` instead of the standard `StretchEntityCommand`
 * vertex path.
 *
 * Grips exposed by `FurnitureEntity` (`bim/furniture/furniture-grips.ts`) —
 * rectangular-only (no diameter), full wall-parity mirror of the rectangular
 * MEP fixture / electrical panel:
 *   - `furniture-move`     → translate `position` (whole-entity MOVE glyph).
 *   - `furniture-rotation` → rotate about `position` (curved ROTATION glyph).
 *   - `furniture-corner-{ne,nw,sw,se}` → two-direction resize of width × depth.
 *     The DIAGONALLY-OPPOSITE corner stays pinned (anchor); the body grows/shrinks
 *     toward the dragged corner and `position` re-centres. ORTHO (F8) constrains
 *     the drag to the dominant local axis (pure width OR pure depth). Clamped to
 *     `MIN_FURNITURE_DIMENSION_MM`.
 */
export type FurnitureGripKind =
  | 'furniture-move'
  | 'furniture-rotation'
  | 'furniture-corner-ne'
  | 'furniture-corner-nw'
  | 'furniture-corner-sw'
  | 'furniture-corner-se';

/**
 * ADR-415 — floorplan-symbol grip kind (parametric grip type). 1:1 mirror of
 * `FurnitureGripKind`: routes commit through `applyFloorplanSymbolGripDrag()` +
 * `UpdateFloorplanSymbolParamsCommand` (centre translate + rotation + opposite-
 * corner-anchored width/depth resize). Shares the centred-box grip SSoT.
 */
export type FloorplanSymbolGripKind =
  | 'floorplan-symbol-move'
  | 'floorplan-symbol-rotation'
  | 'floorplan-symbol-corner-ne'
  | 'floorplan-symbol-corner-nw'
  | 'floorplan-symbol-corner-sw'
  | 'floorplan-symbol-corner-se';

/**
 * ADR-408 Φ8 — MEP segment (duct / pipe) grip kind (parametric grip type).
 * Routes commit through `applyMepSegmentGripDrag()` + `UpdateMepSegmentParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Grips exposed by `MepSegmentEntity` (`bim/mep-segments/mep-segment-grips.ts`) —
 * mirrors `BeamGripKind` for a linear 2-click element:
 *   - `mep-segment-start`    → translate axis start endpoint.
 *   - `mep-segment-end`      → translate axis end endpoint.
 *   - `mep-segment-midpoint` → translate whole segment (both endpoints); renders
 *                              the 4-arrow MOVE glyph + 3-click hot-grip.
 *   - `mep-segment-section`  → resize section width (plan axis, symmetric × 2)
 *                              perpendicular to the axis at midpoint. For
 *                              rectangular duct: resizes `width`; for round duct /
 *                              pipe: resizes `diameter`. Clamped to
 *                              `MIN_SEGMENT_DIMENSION_MM`.
 *   - `mep-segment-rotation` → rotate the whole segment (startPoint + endPoint)
 *                              about a picked centre / the axis midpoint. Curved
 *                              ROTATION glyph + 6-click ROTATE→Reference hot-grip
 *                              (full beam-rotation parity). Skipped on degenerate
 *                              (zero-length) axis.
 */
export type MepSegmentGripKind =
  | 'mep-segment-start'
  | 'mep-segment-end'
  | 'mep-segment-midpoint'
  | 'mep-segment-section'
  | 'mep-segment-rotation';

/**
 * ADR-359 Phase 11 — XLine grip kind.
 * Routes commit through `applyXLineGripDrag()` + direct scene patch instead of
 * the standard `StretchEntityCommand` vertex path.
 *   - `xline-base` → translate basePoint (direction invariant).
 *   - `xline-dir`  → rotate: recompute direction = normalize(cursor − basePoint).
 */
export type XLineGripKind = 'xline-base' | 'xline-dir';

/**
 * ADR-359 Phase 11 — Ray grip kind.
 * Routes commit through `applyRayGripDrag()` + direct scene patch.
 *   - `ray-base` → translate basePoint (direction invariant).
 *   - `ray-dir`  → rotate: recompute direction = normalize(cursor − basePoint).
 */
export type RayGripKind = 'ray-base' | 'ray-dir';
