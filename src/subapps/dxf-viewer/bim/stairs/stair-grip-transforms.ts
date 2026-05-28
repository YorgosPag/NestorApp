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
import type { StairParams, StairVariantParams } from '../../bim/types/stair-types';
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
} from './stair-grip-math';

export interface StairGripDragInput {
  /** Original params at drag start (preserves invariants when needed). */
  readonly originalParams: StairParams;
  /** World-space delta from drag anchor to current cursor position. */
  readonly delta: Point2D;
  /** Current world cursor position (used for direction/width/length resolves). */
  readonly currentPos: Point2D;
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
      return moveCorner(input, 'start', +1);
    case 'stair-corner-start-right':
      return moveCorner(input, 'start', -1);
    case 'stair-corner-end-left':
      return moveCorner(input, 'end', +1);
    case 'stair-corner-end-right':
      return moveCorner(input, 'end', -1);
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
  const { originalParams, currentPos } = input;
  const dx = currentPos.x - originalParams.basePoint.x;
  const dy = currentPos.y - originalParams.basePoint.y;
  if (dx === 0 && dy === 0) return originalParams;
  const newDirection = Math.atan2(dy, dx) * RAD_TO_DEG;
  return { ...originalParams, direction: newDirection };
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

/**
 * ADR-358 Phase 3d hotfix — convert split-grip ratio into integer step counts.
 * Geometry builders interpret `flightSplit` as `[stepCount1, stepCount2(, 3)]`
 * and call `new Array(n_i)`; a float ratio threw `RangeError: invalid array
 * length`. Round-trip stays for clamping continuity; the persisted shape uses
 * integers summing to the corner-conserving budget.
 */
function withFlightSplitStepCounts(
  variant: StairVariantParams,
  r: number,
  stepCount: number,
): StairVariantParams {
  if (variant.kind === 'l-shape') {
    const consumed =
      variant.cornerStyle === 'winders' ? Math.max(1, variant.winderCount) : 1;
    const total = Math.max(2, stepCount - consumed);
    const n1 = Math.max(1, Math.min(total - 1, Math.round(r * total)));
    const n2 = total - n1;
    return { ...variant, flightSplit: [n1, n2] as const };
  }
  if (variant.kind === 'u-shape') {
    const total = Math.max(2, stepCount - 1); // 1 landing
    const n1 = Math.max(1, Math.min(total - 1, Math.round(r * total)));
    const n2 = total - n1;
    return { ...variant, flightSplit: [n1, n2] as const };
  }
  if (variant.kind === 'gamma') {
    const total = Math.max(3, stepCount - 2); // 2 landings
    const n1 = Math.max(1, Math.min(total - 2, Math.round(r * total)));
    const remaining = total - n1;
    const n2 = Math.max(1, Math.floor(remaining / 2));
    const n3 = Math.max(1, remaining - n2);
    return { ...variant, flightSplit: [n1, n2, n3] as const };
  }
  return variant;
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
