/**
 * ADR-358 Phase 5b — Stair parametric grip handlers (G15).
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Mirrors the
 * pattern of `systems/array/array-grip-handlers.ts` (ADR-353) and exposes the
 * 5 parametric grips described in ADR-358 §5.12:
 *
 *   - `stair-base`      → translate basePoint (no geometry recompute beyond shift)
 *   - `stair-direction` → rotate `direction` (atan2 from basePoint)
 *   - `stair-width`     → resize `width` (perpendicular to direction)
 *   - `stair-length`    → resize `stepCount` (derived from new length / tread)
 *   - `stair-split`     → adjust `variant.flightSplit` ratio (L/U/Γ only)
 *
 * SSoT:
 *   - Geometry math via `computeStairGeometry` (called by `UpdateStairParamsCommand`
 *     at commit time — this module returns ONLY new `StairParams`).
 *   - Grip wire-up via the unified grip system (`useUnifiedGripInteraction`):
 *     `getStairGrips()` produces `GripInfo[]` consumed by `computeDxfEntityGrips`
 *     (`hooks/grip-computation.ts`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.12 §9.2 Q22
 */

import type { Point2D, Point3D } from '../../rendering/types/Types';
import type { GripInfo, StairGripKind } from '../../hooks/useGripMovement';
import type {
  StairEntity,
  StairParams,
  StairVariantParams,
} from '../../bim/types/stair-types';
import { mmFactorFromWidth } from './stair-floor-link';

// ADR-358 Phase 9B-2 — magnet snap zone for length grip when linked to a
// floor: once the cursor enters the last 10% of the max run, the grip jumps
// to maxRun exactly (Revit / ArchiCAD "magnet to top level" behaviour).
const LINKED_LENGTH_SNAP_RATIO = 0.9;

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;
const DIRECTION_GRIP_OFFSET_MM = 100; // §5.12 — direction handle at basePoint + 100mm·u
const MIN_WIDTH_MM = 50;
const MIN_STEP_COUNT = 2;
const MIN_FLIGHT_SPLIT_RATIO = 0.1;
const MAX_FLIGHT_SPLIT_RATIO = 0.9;

// ─── Variants that expose a split grip (have a landing midpoint) ─────────────

const SPLIT_GRIP_KINDS = new Set(['l-shape', 'u-shape', 'gamma']);

function hasSplitGrip(variant: StairVariantParams): boolean {
  return SPLIT_GRIP_KINDS.has(variant.kind);
}

// ─── Direction helpers ───────────────────────────────────────────────────────

function unitVectorFromDirection(directionDeg: number): { x: number; y: number } {
  const rad = directionDeg * DEG_TO_RAD;
  return { x: Math.cos(rad), y: Math.sin(rad) };
}

function perpUnit(u: { x: number; y: number }): { x: number; y: number } {
  // ccw 90° rotation: (x,y) → (-y,x)
  return { x: -u.y, y: u.x };
}

function project2D(p3: Point3D): Point2D {
  return { x: p3.x, y: p3.y };
}

// ─── Grip position computation (§5.12) ───────────────────────────────────────

/**
 * Compute the 4-or-5 parametric grip positions for a `StairEntity`. Order is
 * stable so `gripIndex` is a deterministic identifier across drags.
 *
 * Layout (deterministic, ADR-358 §5.12):
 *   0 → basePoint
 *   1 → direction (basePoint + 100mm · u)
 *   2 → width (midpoint of outer stringer end-segment)
 *   3 → length (end of last tread along walkline)
 *   4 → split  (midpoint of landing) — emitted only for l-shape / u-shape / gamma
 */
export function getStairGrips(entity: Readonly<StairEntity>): GripInfo[] {
  const { params, geometry } = entity;
  const u = unitVectorFromDirection(params.direction);
  const p = perpUnit(u);
  const base = project2D(params.basePoint);

  const grips: GripInfo[] = [];

  // 0 — basePoint
  grips.push({
    entityId: entity.id,
    gripIndex: 0,
    type: 'center',
    position: base,
    movesEntity: true,
    stairGripKind: 'stair-base',
  });

  // 1 — direction handle
  grips.push({
    entityId: entity.id,
    gripIndex: 1,
    type: 'vertex',
    position: {
      x: base.x + DIRECTION_GRIP_OFFSET_MM * u.x,
      y: base.y + DIRECTION_GRIP_OFFSET_MM * u.y,
    },
    movesEntity: false,
    stairGripKind: 'stair-direction',
  });

  // 2 — width handle (outer stringer midpoint; fallback to params.width/2 if outer empty)
  const outer = geometry.stringers.outer;
  const widthPos: Point2D = outer.length >= 2
    ? project2D(outer[Math.floor(outer.length / 2)])
    : { x: base.x + (params.width / 2) * p.x, y: base.y + (params.width / 2) * p.y };
  grips.push({
    entityId: entity.id,
    gripIndex: 2,
    type: 'vertex',
    position: widthPos,
    movesEntity: false,
    stairGripKind: 'stair-width',
  });

  // 3 — length handle (end of walkline; fallback to base + totalRun·u)
  const walk = geometry.walkline;
  const lengthPos: Point2D = walk.length >= 1
    ? project2D(walk[walk.length - 1])
    : { x: base.x + params.totalRun * u.x, y: base.y + params.totalRun * u.y };
  grips.push({
    entityId: entity.id,
    gripIndex: 3,
    type: 'vertex',
    position: lengthPos,
    movesEntity: false,
    stairGripKind: 'stair-length',
  });

  // 4 — split handle (only for l-shape / u-shape / gamma)
  if (hasSplitGrip(params.variant)) {
    const landings = geometry.landings;
    const splitPos: Point2D = landings.length > 0 && landings[0].length > 0
      ? polygonCentroid2D(landings[0])
      : { x: base.x + (params.totalRun / 2) * u.x, y: base.y + (params.totalRun / 2) * u.y };
    grips.push({
      entityId: entity.id,
      gripIndex: 4,
      type: 'vertex',
      position: splitPos,
      movesEntity: false,
      stairGripKind: 'stair-split',
    });
  }

  return grips;
}

function polygonCentroid2D(polygon: ReadonlyArray<Point3D>): Point2D {
  let sx = 0;
  let sy = 0;
  for (const v of polygon) { sx += v.x; sy += v.y; }
  const n = polygon.length;
  return { x: sx / n, y: sy / n };
}

// ─── Drag transforms (§5.12 + §9.2 Q22) ──────────────────────────────────────

export interface StairGripDragInput {
  /** Original params at drag start (preserves invariants when needed). */
  readonly originalParams: StairParams;
  /** World-space delta from drag anchor to current cursor position. */
  readonly delta: Point2D;
  /** Current world cursor position (used for direction/width/length resolves). */
  readonly currentPos: Point2D;
}

/**
 * Pure transform: stair grip kind + drag input → new `StairParams`. Geometry
 * is NOT recomputed here — the caller (`UpdateStairParamsCommand.execute`) is
 * responsible for the `computeStairGeometry()` call so we keep the math SSoT
 * in one place and command merging preserves the original delta semantics.
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
    case 'stair-split':
      return adjustFlightSplit(input);
    default: {
      const _exhaustive: never = gripKind;
      return input.originalParams;
    }
  }
}

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
  // Project (cursor − base) onto perpendicular of direction; new width = 2·|proj|.
  const u = unitVectorFromDirection(originalParams.direction);
  const p = perpUnit(u);
  const dx = currentPos.x - originalParams.basePoint.x;
  const dy = currentPos.y - originalParams.basePoint.y;
  const projOnPerp = Math.abs(dx * p.x + dy * p.y);
  // Min-width floor must be expressed in the same units as `originalParams.width`
  // (which mirror the scene units after ADR-358 Phase 8 unit-aware builder).
  // Without scaling, `MIN_WIDTH_MM = 50` clamped a metre-scale stair to 50 m
  // because `Math.max(50, 1.2) = 50`. Use the scale of the original width to
  // pick the right floor (50 mm in mm-scenes, 0.05 m in metre-scenes, 5 cm in
  // cm-scenes — same physical 50 mm everywhere).
  const minWidth = minWidthFloorFor(originalParams.width);
  const newWidth = Math.max(minWidth, projOnPerp * 2);
  return { ...originalParams, width: newWidth };
}

/**
 * Pick a 50 mm min-width floor in whatever scene units the current `width`
 * is expressed in. Heuristic mirror of `detectSceneUnits(bounds)` but per
 * single value: a width default of 1.2 (m), 120 (cm), 1200 (mm) → respective
 * floors 0.05, 5, 50 — same physical 50 mm in every case.
 */
function minWidthFloorFor(currentWidth: number): number {
  if (!Number.isFinite(currentWidth) || currentWidth <= 0) return MIN_WIDTH_MM;
  if (currentWidth < 10) return 0.05;   // metres
  if (currentWidth < 100) return 5;     // centimetres
  return MIN_WIDTH_MM;                  // millimetres (or larger units → safe)
}

function resizeLength(input: Readonly<StairGripDragInput>): StairParams {
  const { originalParams, currentPos } = input;
  // Project (cursor − base) onto direction; derive stepCount from new run / tread.
  const u = unitVectorFromDirection(originalParams.direction);
  const dx = currentPos.x - originalParams.basePoint.x;
  const dy = currentPos.y - originalParams.basePoint.y;
  const projOnDir = dx * u.x + dy * u.y;

  // ADR-358 Phase 9B-2 — when linked to a floor, the grip is bound by the
  // physical max run that fits inside `storyHeight × storyCount / rise`
  // treads. Clamp + magnet snap (industry: Revit / ArchiCAD / AutoCAD Arch).
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
      // Magnet snap to maxRun when within the last 10% of the envelope.
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
  // stepCount = floor(newRun / tread) + 1 ; floor on run, +1 for the final tread.
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

function adjustFlightSplit(input: Readonly<StairGripDragInput>): StairParams {
  const { originalParams, currentPos } = input;
  const variant = originalParams.variant;
  if (!hasSplitGrip(variant)) return originalParams;

  // New ratio = (projection of cursor on direction) / totalRun, clamped.
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
 *
 * Geometry builders (`buildLShapeFlight1` et al.) interpret `flightSplit` as
 * `[stepCount1, stepCount2(, stepCount3)]` and call `new Array(n_i)`. Writing
 * a float ratio here therefore threw `RangeError: invalid array length` as
 * soon as the user reached the split grip on a freshly-created L-shape (UI
 * path opened by Phase 3d Kind Selector). Round-trip through the ratio
 * stays for clamping continuity; only the persisted shape switches to
 * integers summing to `stepCount`.
 */
function withFlightSplitStepCounts(
  variant: StairVariantParams,
  r: number,
  stepCount: number,
): StairVariantParams {
  // ADR-358 Phase 3f — convention γ count conservation: landings/winders
  // consume slots from `stepCount`. The split grip ratio applies to the
  // REMAINING straight-tread budget after subtracting the corner consumption.
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
