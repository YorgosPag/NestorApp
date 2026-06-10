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
  MepWaterHeaterGripKind,
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
  | 'wall-edge-length'
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
  // ADR-363 Slice C — rectangular / shear-wall 2-DOF corners (opposite corner fixed),
  // shared `rect-grip-engine` SSoT (wall/foundation parity). Other kinds skip these.
  | 'column-corner-ne'
  | 'column-corner-nw'
  | 'column-corner-sw'
  | 'column-corner-se'
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
 * ADR-436 Slice 1b — Foundation (pad) grip kind (parametric grip type). Routes
 * commit through `applyFoundationGripDrag()` + `UpdateFoundationParamsCommand`
 * (mirror of `ColumnGripKind`). pad = **width × length** (ΟΧΙ width × depth).
 *
 * Grips exposed by `FoundationEntity` (`bim/foundations/foundation-grips.ts`):
 *   - `foundation-center`   → translate `position` (NOT emitted — Alt+drag MOVE
 *                              glyph, declutter mirror column Φ1G.5 Slice 2).
 *   - `foundation-rotation` → rotate γύρω από `position` (anchor invariant).
 *   - `foundation-width`    → resize `width` edge midpoint (opposite edge fixed, local X).
 *   - `foundation-length`   → resize `length` edge midpoint (opposite edge fixed, local Y).
 *   - `foundation-corner-{ne,nw,sw,se}` → 2-DOF corner resize (opposite corner fixed),
 *     shared `rect-grip-engine` SSoT (wall/column parity, ADR-436 Slice 1c).
 *
 * Νέες διαστάσεις clamp στο `MIN_FOUNDATION_DIMENSION_MM`.
 *
 * ADR-436 Slice 2 — line-based kinds (strip / tie-beam) grips (mirror `BeamGripKind`):
 *   - `foundation-start`    → translate axis start endpoint.
 *   - `foundation-end`      → translate axis end endpoint.
 *   - `foundation-line-width` → resize band `width` perpendicular to axis (symmetric
 *                              γύρω από axis midpoint, mirror `beam-width`).
 */
export type FoundationGripKind =
  | 'foundation-center'
  | 'foundation-rotation'
  | 'foundation-width'
  | 'foundation-length'
  | 'foundation-corner-ne'
  | 'foundation-corner-nw'
  | 'foundation-corner-sw'
  | 'foundation-corner-se'
  | 'foundation-start'
  | 'foundation-end'
  | 'foundation-line-width';

// ADR-406/408/410/415/359 — placeable-object + linear-element grip kinds live in
// the sibling module `grip-kinds-placeable.ts` (SRP / N.7.1) and are re-exported
// here for backward compatibility (existing `import { … } from '../grip-kinds'`).
export type {
  MepFixtureGripKind,
  ElectricalPanelGripKind,
  MepManifoldGripKind,
  FurnitureGripKind,
  FloorplanSymbolGripKind,
  MepSegmentGripKind,
  XLineGripKind,
  RayGripKind,
} from './grip-kinds-placeable';
