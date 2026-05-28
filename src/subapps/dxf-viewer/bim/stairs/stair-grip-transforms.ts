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
import type { StairGeometry, StairParams, StairVariantParams } from '../../bim/types/stair-types';
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
  flightCount,
  setFlightSplitCount,
  lastSegmentDir,
  withFlightSplitStepCounts,
} from './stair-grip-math';

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
}

/**
 * Pure transform: stair grip kind + drag input → new `StairParams`.
 */
export function applyStairGripDrag(
  gripKind: StairGripKind,
  input: Readonly<StairGripDragInput>,
): StairParams {
  switch (gripKind) {
    case 'stair-base':
      return moveBasePoint(input);
    case 'stair-direction':
      return rotateDirection(input);
    case 'stair-width':
      return resizeWidth(input);
    case 'stair-length':
      return resizeLength(input);
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

function rotateDirection(input: Readonly<StairGripDragInput>): StairParams {
  const { originalParams, currentPos, delta } = input;
  const pivotX = originalParams.basePoint.x;
  const pivotY = originalParams.basePoint.y;
  const curDx = currentPos.x - pivotX;
  const curDy = currentPos.y - pivotY;
  if (curDx === 0 && curDy === 0) return originalParams;

  // ADR-393 v2 — anchor-relative rotation. The rotation handle is now drawn at
  // the front-centre (base − offset·u), OFF the pivot→direction axis. Using the
  // absolute atan2 of the cursor would snap `direction` to the cursor bearing
  // and flip the stair the instant the handle is grabbed (anchor at angle 180°).
  // Instead rotate by the angle SWEPT from the anchor (the grip world position
  // at mousedown = currentPos − delta), pivoting around `basePoint`.
  const anchorX = currentPos.x - delta.x - pivotX;
  const anchorY = currentPos.y - delta.y - pivotY;
  if (Math.hypot(anchorX, anchorY) < 1e-9) {
    // Degenerate anchor (e.g. direct unit-test input fed relative to pivot):
    // fall back to absolute bearing.
    return { ...originalParams, direction: Math.atan2(curDy, curDx) * RAD_TO_DEG };
  }
  const sweptDeg =
    (Math.atan2(curDy, curDx) - Math.atan2(anchorY, anchorX)) * RAD_TO_DEG;
  return { ...originalParams, direction: originalParams.direction + sweptDeg };
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
  const u = unitVectorFromDirection(originalParams.direction);
  const dx = currentPos.x - originalParams.basePoint.x;
  const dy = currentPos.y - originalParams.basePoint.y;
  const projOnDir = dx * u.x + dy * u.y;

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

  const newRunMm = Math.max(originalParams.tread, projOnDir);
  const newStepCount = Math.max(MIN_STEP_COUNT, Math.floor(newRunMm / originalParams.tread) + 1);
  const newTotalRun = originalParams.tread * (newStepCount - 1);
  const newTotalRise = originalParams.rise * newStepCount;
  return {
    ...originalParams,
    stepCount: newStepCount,
    totalRun: newTotalRun,
    totalRise: newTotalRise,
  };
}

// ─── ADR-393 Phase A1 — asymmetric corner grips (straight) ───────────────────

/**
 * Decompose the cursor delta into axial (along direction) + perpendicular
 * components. Mirror of `wall-grips.ts:moveCorner`:
 *   - axial → `start` corner moves basePoint while keeping the back edge fixed
 *     (run shrinks/grows + stepCount recomputed); `end` corner grows/shrinks the
 *     run only (basePoint fixed).
 *   - perpendicular → grows/shrinks `width` symmetrically (Q2 decision: stairs
 *     keep a single scalar width) while the axis re-centers by half the
 *     displacement so the rectangular footprint is preserved.
 */
function moveCorner(
  input: Readonly<StairGripDragInput>,
  side: 'start' | 'end',
  perpSign: 1 | -1,
): StairParams {
  const { originalParams, delta } = input;
  const u = unitVectorFromDirection(originalParams.direction);
  const p = perpUnit(u);
  const axialD = delta.x * u.x + delta.y * u.y;
  const perpD = delta.x * p.x + delta.y * p.y;

  // Width change (mirror wall thickness). No upper ceiling for stair width.
  const rawWidth = originalParams.width + perpSign * perpD;
  const minWidth = minWidthFloorFor(originalParams.width);
  const clampedWidth = Math.max(minWidth, rawWidth);
  const actualPerpD = perpSign * (clampedWidth - originalParams.width);
  const axisShiftPerp = actualPerpD / 2;
  const axisShiftX = axisShiftPerp * p.x;
  const axisShiftY = axisShiftPerp * p.y;

  // Axial → run change + stepCount snapping.
  const rawRun = side === 'start'
    ? originalParams.totalRun - axialD
    : originalParams.totalRun + axialD;
  const clampedRun = Math.max(originalParams.tread, rawRun);
  const newStepCount = Math.max(MIN_STEP_COUNT, Math.floor(clampedRun / originalParams.tread) + 1);
  const snappedRun = originalParams.tread * (newStepCount - 1);
  const newTotalRise = originalParams.rise * newStepCount;

  // For the start corner, derive the basePoint axial shift from the snapped run
  // so the back edge (base + run·u) stays exactly fixed. The end corner leaves
  // basePoint at its axial position.
  const axialShift = side === 'start' ? originalParams.totalRun - snappedRun : 0;
  const newBase: Point3D = {
    x: originalParams.basePoint.x + axialShift * u.x + axisShiftX,
    y: originalParams.basePoint.y + axialShift * u.y + axisShiftY,
    z: originalParams.basePoint.z,
  };

  return {
    ...originalParams,
    basePoint: newBase,
    width: clampedWidth,
    stepCount: newStepCount,
    totalRun: snappedRun,
    totalRise: newTotalRise,
  };
}

// ─── ADR-393 v2 Phase 2 — multi-flight corner grips (L/U/Γ) ──────────────────

/**
 * Dispatch a corner drag to the right transform. `straight` keeps the original
 * single-axis `moveCorner` (footprint = `base + totalRun·u`); the split
 * variants (l-shape / u-shape / gamma) route to `moveCornerMultiFlight`, where
 * the start corner lives on flight-1's frame and the end corner on the last
 * flight's frame (directions differ — the stair bends at the landing(s)).
 */
function moveCornerDispatch(
  input: Readonly<StairGripDragInput>,
  side: 'start' | 'end',
  perpSign: 1 | -1,
): StairParams {
  return input.originalParams.variant.kind === 'straight'
    ? moveCorner(input, side, perpSign)
    : moveCornerMultiFlight(input, side, perpSign);
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
  const clampedRun = Math.max(originalParams.tread, rawRun);
  const newStepCount = Math.max(MIN_STEP_COUNT, Math.floor(clampedRun / originalParams.tread) + 1);
  const snappedRun = originalParams.tread * (newStepCount - 1);
  const axialShift = originalParams.totalRun - snappedRun;
  const newBase: Point3D = {
    x: originalParams.basePoint.x + axialShift * u.x,
    y: originalParams.basePoint.y + axialShift * u.y,
    z: originalParams.basePoint.z,
  };
  return {
    ...originalParams,
    basePoint: newBase,
    stepCount: newStepCount,
    totalRun: snappedRun,
    totalRise: originalParams.rise * newStepCount,
  };
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

  const u = unitVectorFromDirection(originalParams.direction);
  const dx = currentPos.x - originalParams.basePoint.x;
  const dy = currentPos.y - originalParams.basePoint.y;
  const projOnDir = dx * u.x + dy * u.y;
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

  const u = unitVectorFromDirection(originalParams.direction);
  const dx = currentPos.x - originalParams.basePoint.x;
  const dy = currentPos.y - originalParams.basePoint.y;
  const projOnDir = dx * u.x + dy * u.y;
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
