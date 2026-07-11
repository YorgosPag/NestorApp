/**
 * ADR-358 Phase 5b + ADR-393 — Stair parametric grip drag transforms.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Each function
 * maps a grip-drag input → new `StairParams`. Geometry is NOT recomputed here —
 * the caller (`UpdateStairParamsCommand.execute`) runs `computeStairGeometry()`
 * so the math SSoT stays in one place and command merging preserves delta
 * semantics.
 *
 * ADR-393 (2026-05-28) — corner / mid-front / per-flight / landing transforms.
 * The 4 corner transforms mirror the wall corner pattern
 * (`bim/walls/wall-grips.ts:moveCorner`, ADR-363 Phase 1C-bis): `width` plays
 * the role of wall `thickness`, and `basePoint`/`totalRun` play the role of the
 * wall start/end endpoints.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-393-bim-stair-extended-grips.md
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.12
 */

import type { Point2D, Point3D } from '../../rendering/types/Types';
import type { StairGripKind } from '../../hooks/useGripMovement';
import type {
  StairGeometry,
  StairParams,
  StairVariantParams,
} from '../../bim/types/stair-types';
import { mmFactorFromWidth } from './stair-floor-link';
import {
  RAD_TO_DEG,
  MIN_STEP_COUNT,
  MIN_FLIGHT_SPLIT_RATIO,
  MAX_FLIGHT_SPLIT_RATIO,
  LINKED_LENGTH_SNAP_RATIO,
  hasSplitGrip,
  unitVectorFromDirection,
  perpUnit,
  minWidthFloorFor,
  recomputeRunSteps,
  projectCursorAxial,
  flightCount,
  setFlightSplitCount,
  lastSegmentDir,
  withFlightSplitStepCounts,
} from './stair-grip-math';
// ADR-393 Phase C — straight-stair corners + width/length edges resize via the shared
// axis-box engine (opposite-element-fixed, ίδιος κώδικας με τοίχο/δοκό/πεδιλοδοκό).
import { applyRectStairGrip } from './stair-rect-adapter';
// ADR-393 Phase C / ADR-397 §D3 — pivot-aware rotation is the shared SSoT
// `rotateAxisPointsAboutPivot` (swept angle + canonical rotatePoint), the SAME
// primitive the wall/beam/column rotation grips use. No re-implemented cos/sin.
import { rotateAxisPointsAboutPivot } from '../grips/grip-math';
// ADR-637 Phase 4-A — intermediate rest-landing (πλατύσκαλο) transforms live in their
// own SRP module (N.7.1); the dispatcher below delegates to them.
import { slideRestLanding, resizeRestLandingLength } from './stair-grip-rest-landing';

export interface StairGripDragInput {
  /** Original params at drag start (preserves invariants when needed). */
  readonly originalParams: StairParams;
  /** World-space delta from drag anchor to current cursor position. */
  readonly delta: Point2D;
  /** Current world cursor position (used for direction/width/length resolves). */
  readonly currentPos: Point2D;
  /**
   * ADR-393 v2 Phase 2 — geometry at drag start. The multi-flight corner
   * transforms read the last flight's direction from `walkline` (SSoT — no
   * re-implementation of the per-variant turn→direction math the geometry
   * builders own). Optional: straight corners + the ADR-358 base grips ignore it.
   */
  readonly geometry?: StairGeometry;
  /**
   * ADR-393 Phase C — optional rotation pivot for `stair-direction`. When set (the
   * 6-click hot-grip rotate flow published in `BimRotateHotGripStore`) the stair
   * rotates around this picked centre — both `basePoint` and `direction` change,
   * mirror of the wall. Undefined → pivot defaults to `basePoint` (legacy behaviour:
   * spin about the front-edge centre, `direction` only).
   */
  readonly pivot?: Point2D;
  /**
   * ADR-637 Phase 4-A — target rest-landing id for the `stair-rest-landing-*`
   * grips. The slide / length transforms patch the matching `restLandings[i]` by
   * this id; ignored by every other grip kind.
   */
  readonly landingId?: string;
}

/**
 * Pure transform: stair grip kind + drag input → new `StairParams`.
 */
export function applyStairGripDrag(
  gripKind: StairGripKind,
  input: Readonly<StairGripDragInput>,
): StairParams {
  // ADR-393 Phase C — straight-stair corners + width/length edges (incl. the 2
  // opposite mid-edges) resize through the shared axis-box engine (opposite-element-
  // fixed, wall parity). Returns null for non-straight stairs, non-rect kinds, OR
  // `stair-direction` (rotation stays bespoke) → fall through to the handlers below.
  const rect = applyRectStairGrip(gripKind, input.originalParams, input.delta);
  if (rect) return rect;
  switch (gripKind) {
    case 'stair-base':
      return moveBasePoint(input);
    case 'stair-direction':
      return rotateStair(input);
    case 'stair-width':
      return resizeWidth(input);
    case 'stair-length':
      return resizeLength(input);
    // ADR-393 Phase C — the 2 opposite mid-edges are STRAIGHT-only, always caught by
    // the shared axis-box path above. Non-straight can never emit them → no-op here
    // (keeps the exhaustive discriminant complete).
    case 'stair-width-far':
    case 'stair-length-start':
      return input.originalParams;
    case 'stair-corner-start-left':
      return moveCornerDispatch(input, 'start', +1);
    case 'stair-corner-start-right':
      return moveCornerDispatch(input, 'start', -1);
    case 'stair-corner-end-left':
      return moveCornerDispatch(input, 'end', +1);
    case 'stair-corner-end-right':
      return moveCornerDispatch(input, 'end', -1);
    case 'stair-start-side':
      return moveStartSide(input);
    case 'stair-flight1-end':
    case 'stair-flight2-start':
      return adjustFlightSplit(input);
    case 'stair-landing-depth':
      return resizeLandingDepth(input);
    case 'stair-landing-corner-radius':
      return resizeLandingCornerRadius(input);
    // ADR-637 Phase 4-A — intermediate rest-landing (πλατύσκαλο) grips.
    case 'stair-rest-landing-slide':
      return slideRestLanding(input);
    case 'stair-rest-landing-length-lo':
    case 'stair-rest-landing-length-hi':
      return resizeRestLandingLength(input);
    default: {
      const _exhaustive: never = gripKind;
      return input.originalParams;
    }
  }
}

// ─── Base / direction / width / length (ADR-358 Phase 5b) ────────────────────

function moveBasePoint(input: Readonly<StairGripDragInput>): StairParams {
  const { originalParams, delta } = input;
  const newBase: Point3D = {
    x: originalParams.basePoint.x + delta.x,
    y: originalParams.basePoint.y + delta.y,
    z: originalParams.basePoint.z,
  };
  return { ...originalParams, basePoint: newBase };
}

/**
 * ADR-393 Phase C — rotate the whole straight stair about a picked pivot (wall
 * parity), unifying the legacy ADR-393 v2 `rotateDirection`. The swept angle is
 * anchor-relative (`currentPos − delta` → `currentPos`), so grabbing the handle OFF
 * the axis does not snap the stair. When no `pivot` is supplied the centre defaults
 * to `basePoint`: rotating the axis `[base, base+run·u]` about `base` leaves `base`
 * put and only changes `direction` — EXACTLY the old front-centre spin. When a pivot
 * is picked, both `basePoint` and `direction` change (the stair orbits the centre).
 *
 * ADR-397 §D3 — the swept angle + point rotation are the shared
 * `rotateAxisPointsAboutPivot` SSoT (same primitive as the wall/beam/column rotation
 * grips). No re-implemented cos/sin. Falls back to the absolute cursor bearing when
 * the anchor coincides with the pivot (degenerate; e.g. a unit-test input fed
 * relative to the pivot), so a direct drag still rotates.
 */
function rotateStair(input: Readonly<StairGripDragInput>): StairParams {
  const { originalParams, currentPos, delta, pivot } = input;
  const u = unitVectorFromDirection(originalParams.direction);
  const bx = originalParams.basePoint.x;
  const by = originalParams.basePoint.y;
  const centre: Point2D = pivot ?? { x: bx, y: by };
  const anchor: Point2D = { x: currentPos.x - delta.x, y: currentPos.y - delta.y };
  const start: Point2D = { x: bx, y: by };
  const end: Point2D = { x: bx + originalParams.totalRun * u.x, y: by + originalParams.totalRun * u.y };
  const rotated = rotateAxisPointsAboutPivot([start, end], { pivot: centre, anchor, currentPos });
  if (!rotated) {
    // Degenerate anchor (anchor === pivot): fall back to the absolute cursor bearing
    // about the centre (legacy `rotateDirection` behaviour) so a direct drag rotates.
    const curDx = currentPos.x - centre.x;
    const curDy = currentPos.y - centre.y;
    if (curDx === 0 && curDy === 0) return originalParams;
    return { ...originalParams, direction: Math.atan2(curDy, curDx) * RAD_TO_DEG };
  }
  const [ns, ne] = rotated;
  return {
    ...originalParams,
    basePoint: { x: ns.x, y: ns.y, z: originalParams.basePoint.z },
    direction: Math.atan2(ne.y - ns.y, ne.x - ns.x) * RAD_TO_DEG,
  };
}

function resizeWidth(input: Readonly<StairGripDragInput>): StairParams {
  const { originalParams, currentPos } = input;
  const u = unitVectorFromDirection(originalParams.direction);
  const p = perpUnit(u);
  const dx = currentPos.x - originalParams.basePoint.x;
  const dy = currentPos.y - originalParams.basePoint.y;
  const projOnPerp = Math.abs(dx * p.x + dy * p.y);
  const minWidth = minWidthFloorFor(originalParams.width);
  const newWidth = Math.max(minWidth, projOnPerp * 2);
  return { ...originalParams, width: newWidth };
}

function resizeLength(input: Readonly<StairGripDragInput>): StairParams {
  const { originalParams, currentPos } = input;
  const projOnDir = projectCursorAxial(originalParams, currentPos);

  // ADR-358 Phase 9B-2 — clamp + magnet snap when linked to a floor.
  const cfg = originalParams.multiStoryConfig;
  if (cfg && cfg.linkedToFloor === true) {
    const mmPerSceneUnit = mmFactorFromWidth(originalParams.width);
    const targetTotalMm = cfg.storyHeight * cfg.storyCount;
    const riseMm = originalParams.rise * mmPerSceneUnit;
    if (
      Number.isFinite(targetTotalMm) && targetTotalMm > 0
      && Number.isFinite(riseMm) && riseMm > 0
      && originalParams.tread > 0
    ) {
      const maxStepCount = Math.max(MIN_STEP_COUNT, Math.round(targetTotalMm / riseMm));
      const maxRunScene = originalParams.tread * Math.max(0, maxStepCount - 1);
      let clampedRun = Math.max(originalParams.tread, projOnDir);
      if (clampedRun > maxRunScene) clampedRun = maxRunScene;
      if (clampedRun > maxRunScene * LINKED_LENGTH_SNAP_RATIO && clampedRun < maxRunScene) {
        clampedRun = maxRunScene;
      }
      const rawStepCount = Math.floor(clampedRun / originalParams.tread) + 1;
      const linkedStepCount = Math.max(
        MIN_STEP_COUNT,
        Math.min(rawStepCount, maxStepCount),
      );
      const linkedTotalRun = originalParams.tread * (linkedStepCount - 1);
      const linkedTotalRise = targetTotalMm / mmPerSceneUnit;
      return {
        ...originalParams,
        stepCount: linkedStepCount,
        totalRun: linkedTotalRun,
        totalRise: linkedTotalRise,
      };
    }
  }

  const { stepCount, totalRun, totalRise } = recomputeRunSteps(originalParams, projOnDir);
  return { ...originalParams, stepCount, totalRun, totalRise };
}

// ─── ADR-393 v2 Phase 2 — multi-flight corner grips (L/U/Γ) ──────────────────

/**
 * Dispatch a corner drag. ADR-393 Phase C (2026-07-10): STRAIGHT corners are now
 * handled UPSTREAM by the shared axis-box engine (`applyRectStairGrip` in
 * `applyStairGripDrag`, opposite-element-fixed wall parity), so this dispatch is
 * only ever reached for the split variants (l-shape / u-shape / gamma) → their
 * flight-frame transform. The corner lives on flight-1's frame (start) or the last
 * flight's frame (end), read from the walkline (the stair bends at the landing(s)).
 */
function moveCornerDispatch(
  input: Readonly<StairGripDragInput>,
  side: 'start' | 'end',
  perpSign: 1 | -1,
): StairParams {
  return moveCornerMultiFlight(input, side, perpSign);
}

/**
 * Asymmetric corner drag for the split variants. The drag is decomposed in the
 * frame of the corner's OWN flight (start → flight-1 `u1`; end → last flight
 * `u'`, read from the walkline so the per-variant turn math is not duplicated):
 *
 *   - perpendicular → grows/shrinks the single scalar `width` (clamped). The
 *     start corner re-centers `basePoint` by half the change along `p1` so
 *     flight-1's opposite face stays anchored (mirror of the straight corner);
 *     the end corner leaves `basePoint` anchored to flight-1 (the last flight's
 *     opposite face moves instead).
 *   - axial start → adds/removes whole treads from `flightSplit[0]` and shifts
 *     `basePoint` forward by the removed run so the landing + rest of the stair
 *     stay put ("pull the entry toward the landing").
 *   - axial end → adds/removes whole treads from `flightSplit[last]`, basePoint
 *     fixed ("stretch the exit outward").
 *
 * `stepCount` tracks the flight delta so geometry (built from `flightSplit`) and
 * the label/validation count stay consistent.
 */
function moveCornerMultiFlight(
  input: Readonly<StairGripDragInput>,
  side: 'start' | 'end',
  perpSign: 1 | -1,
): StairParams {
  const { originalParams, delta, geometry } = input;
  const variant = originalParams.variant;
  if (!hasSplitGrip(variant)) return originalParams;
  const u1 = unitVectorFromDirection(originalParams.direction);
  const p1 = perpUnit(u1);
  const uLast = (geometry && lastSegmentDir(geometry.walkline)) || u1;
  const frameU = side === 'start' ? u1 : uLast;
  const frameP = perpUnit(frameU);
  const axialD = delta.x * frameU.x + delta.y * frameU.y;
  const perpD = delta.x * frameP.x + delta.y * frameP.y;
  // Width (single scalar) — clamped to the scene-unit floor.
  const minWidth = minWidthFloorFor(originalParams.width);
  const clampedWidth = Math.max(minWidth, originalParams.width + perpSign * perpD);
  const actualPerpD = perpSign * (clampedWidth - originalParams.width);
  // Axial → whole-tread change to the corner's flight.
  const which: 'first' | 'last' = side === 'start' ? 'first' : 'last';
  const oldCount = flightCount(variant, which);
  const deltaSteps = Math.round(axialD / originalParams.tread);
  const signedDelta = side === 'start' ? -deltaSteps : deltaSteps;
  const newCount = Math.max(1, oldCount + signedDelta);
  const appliedDelta = newCount - oldCount;
  const newStepCount = Math.max(MIN_STEP_COUNT, originalParams.stepCount + appliedDelta);
  const newVariant = setFlightSplitCount(variant, which, newCount);
  // Base shift — start corner only (end corner anchors flight-1).
  let baseX = originalParams.basePoint.x;
  let baseY = originalParams.basePoint.y;
  if (side === 'start') {
    const axialShift = -appliedDelta * originalParams.tread; // forward when treads removed
    const axisShiftPerp = actualPerpD / 2;
    baseX += axialShift * u1.x + axisShiftPerp * p1.x;
    baseY += axialShift * u1.y + axisShiftPerp * p1.y;
  }
  return {
    ...originalParams,
    basePoint: { x: baseX, y: baseY, z: originalParams.basePoint.z },
    width: clampedWidth,
    stepCount: newStepCount,
    totalRun: originalParams.tread * Math.max(0, newStepCount - 1),
    totalRise: originalParams.rise * newStepCount,
    variant: newVariant,
  };
}

// ─── ADR-393 Phase A2 — mid-front start grip (straight) ──────────────────────

/**
 * Move the basePoint along the run direction while keeping the back edge fixed
 * (run shrinks/grows + stepCount recomputed). Like the axial half of the start
 * corner, but with no width change. Distinct from `stair-base` which translates
 * the whole stair without changing the run.
 */
function moveStartSide(input: Readonly<StairGripDragInput>): StairParams {
  const { originalParams, delta } = input;
  const u = unitVectorFromDirection(originalParams.direction);
  const axialD = delta.x * u.x + delta.y * u.y;
  const rawRun = originalParams.totalRun - axialD;
  const { stepCount, totalRun, totalRise } = recomputeRunSteps(originalParams, rawRun);
  const axialShift = originalParams.totalRun - totalRun;
  const newBase: Point3D = {
    x: originalParams.basePoint.x + axialShift * u.x,
    y: originalParams.basePoint.y + axialShift * u.y,
    z: originalParams.basePoint.z,
  };
  return { ...originalParams, basePoint: newBase, stepCount, totalRun, totalRise };
}

// ─── ADR-393 Phase B1 — per-flight landing edges (L/U/Γ) ─────────────────────

/**
 * Both landing-edge grips (`stair-flight1-end` / `stair-flight2-start`)
 * reapportion `variant.flightSplit`. The landing is a rigid block; grabbing
 * either edge slides the split point, so both project the cursor onto the run
 * direction and map the ratio to integer step counts. Replaces the legacy
 * centroid `stair-split` grip (ADR-393 Q4).
 */
function adjustFlightSplit(input: Readonly<StairGripDragInput>): StairParams {
  const { originalParams, currentPos } = input;
  const variant = originalParams.variant;
  if (!hasSplitGrip(variant)) return originalParams;

  const projOnDir = projectCursorAxial(originalParams, currentPos);
  const denom = originalParams.totalRun || 1;
  const rawRatio = projOnDir / denom;
  const r = Math.min(MAX_FLIGHT_SPLIT_RATIO, Math.max(MIN_FLIGHT_SPLIT_RATIO, rawRatio));

  const newVariant = withFlightSplitStepCounts(variant, r, originalParams.stepCount);
  return { ...originalParams, variant: newVariant };
}

// ─── ADR-393 Phase B2 — landing depth + corner radius (L/U/Γ) ────────────────

const MIN_LANDING_CORNER_RADIUS = 0;

/**
 * Resize `landingDepth` (L-shape-landing / U-shape). Projects the cursor onto
 * the run direction and measures how far past flight-1 it sits; that distance
 * becomes the landing depth (floored at one tread). `'auto'` is replaced by the
 * concrete number on first drag.
 */
function resizeLandingDepth(input: Readonly<StairGripDragInput>): StairParams {
  const { originalParams, currentPos } = input;
  const variant = originalParams.variant;
  if (!variantHasLandingDepth(variant)) return originalParams;

  const projOnDir = projectCursorAxial(originalParams, currentPos);
  const flight1Run = variant.flightSplit[0] * originalParams.tread;
  const newDepth = Math.max(originalParams.tread, projOnDir - flight1Run);

  return { ...originalParams, variant: { ...variant, landingDepth: newDepth } };
}

/**
 * Resize `landingCornerRadius` (L-shape-landing / U-shape with chamfer/fillet
 * corner style). Dragging the corner handle toward the landing centre grows the
 * radius; away shrinks it. Clamped to `[0, min(width, depth)/2]`.
 */
function resizeLandingCornerRadius(input: Readonly<StairGripDragInput>): StairParams {
  const { originalParams, delta } = input;
  const variant = originalParams.variant;
  if (!variantHasLandingDepth(variant)) return originalParams;

  const u = unitVectorFromDirection(originalParams.direction);
  const p = perpUnit(u);
  // Outward diagonal at the far (+u,+p) landing corner.
  const diagX = u.x + p.x;
  const diagY = u.y + p.y;
  const diagLen = Math.hypot(diagX, diagY) || 1;
  const inward = -((delta.x * diagX + delta.y * diagY) / diagLen);

  const depth = typeof variant.landingDepth === 'number'
    ? variant.landingDepth
    : originalParams.width;
  const maxRadius = Math.min(originalParams.width, depth) / 2;
  const current = variant.landingCornerRadius ?? 0;
  const newRadius = Math.max(MIN_LANDING_CORNER_RADIUS, Math.min(maxRadius, current + inward));

  return { ...originalParams, variant: { ...variant, landingCornerRadius: newRadius } };
}

/** Narrow to the variants that own a scalar `landingDepth` + corner radius. */
function variantHasLandingDepth(
  variant: StairVariantParams,
): variant is Extract<StairVariantParams, { landingDepth: 'auto' | number }> {
  return (
    (variant.kind === 'l-shape' && variant.cornerStyle === 'landing') ||
    variant.kind === 'u-shape'
  );
}
