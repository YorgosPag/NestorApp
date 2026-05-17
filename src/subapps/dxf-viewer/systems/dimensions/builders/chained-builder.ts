/**
 * ADR-362 Phase B3 — Baseline + Continued (chained) geometry builders.
 *
 * Both variants chain off a parent dim and produce a `LinearDimGeometry`
 * (reusing the linear/aligned builder via a synthetic `LinearDimensionEntity`).
 *
 *   - Baseline: shares parent's ext origin 1 as the common baseline; each
 *     baseline dim line is offset by DIMDLI from the previous one along the
 *     perpendicular-outward direction (away from the ext origins).
 *   - Continued: chains end-to-end on the SAME dim line as the parent; new
 *     ext origin 1 = parent's ext origin 2.
 *
 * Parent resolution = lazy callback (Option A — coherent signature across all
 * builders, no schema pollution, mockable in tests). Recursion walks back
 * through nested baseline/continued ancestors to the root linear/aligned dim;
 * each baseline ancestor contributes one DIMDLI of perpendicular offset.
 *
 * The current entity's style supplies DIMDLI (current-DIMSTYLE wins over
 * ancestor styles — keeps chain spacing predictable when the user re-styles
 * a baseline).
 */

import type { Point2D } from '../../../rendering/types/Types';
import type {
  AlignedDimensionEntity,
  BaselineDimensionEntity,
  ContinuedDimensionEntity,
  DimensionEntity,
  DimStyle,
  LinearDimensionEntity,
} from '../../../types/dimension';
import {
  calculateDistance,
  dotProduct,
  getUnitVector,
  subtractPoints,
  vectorAngle,
} from '../../../rendering/entities/shared/geometry-vector-utils';
import type {
  DimensionLookup,
  LinearDimGeometry,
} from '../dim-geometry-builder';
import { buildLinearGeometry } from './linear-aligned-builder';
import { perpendicularOf } from './shared-geometry-helpers';

const DEG_TO_RAD = Math.PI / 180;

/**
 * Result of walking the chain back to the root. `parentDimLineOffset` is the
 * unsigned distance from `baselineOrigin` to the IMMEDIATE parent's dim line,
 * measured along `perpOutward` (so >0 always).
 */
interface ResolvedChain {
  axis: Point2D;
  perpOutward: Point2D;
  baselineOrigin: Point2D;
  continueOrigin: Point2D;
  parentDimLineOffset: number;
}

/** Common back-half used by both linear and aligned roots. */
function assembleChainFromAxis(
  extOrigin1: Point2D,
  extOrigin2: Point2D,
  dimLineRef: Point2D,
  axis: Point2D,
): ResolvedChain {
  const perpRaw = perpendicularOf(axis);
  const signedOffset = dotProduct(
    subtractPoints(dimLineRef, extOrigin1),
    perpRaw,
  );
  if (signedOffset === 0) {
    throw new Error(
      '[chained-builder] Root dim line passes through baseline origin — cannot derive chain offset direction.',
    );
  }
  const perpOutward: Point2D =
    signedOffset > 0 ? perpRaw : { x: -perpRaw.x, y: -perpRaw.y };
  return {
    axis,
    perpOutward,
    baselineOrigin: extOrigin1,
    continueOrigin: extOrigin2,
    parentDimLineOffset: Math.abs(signedOffset),
  };
}

function resolveRootLinear(p: LinearDimensionEntity): ResolvedChain {
  const [extOrigin1, extOrigin2, dimLineRef] = p.defPoints;
  const rotRad = p.rotation * DEG_TO_RAD;
  const axis: Point2D = { x: Math.cos(rotRad), y: Math.sin(rotRad) };
  return assembleChainFromAxis(extOrigin1, extOrigin2, dimLineRef, axis);
}

function resolveRootAligned(p: AlignedDimensionEntity): ResolvedChain {
  const [extOrigin1, extOrigin2, dimLineRef] = p.defPoints;
  if (calculateDistance(extOrigin1, extOrigin2) === 0) {
    throw new Error(
      '[chained-builder] Root aligned dim has coincident ext origins.',
    );
  }
  const axis = getUnitVector(extOrigin1, extOrigin2);
  return assembleChainFromAxis(extOrigin1, extOrigin2, dimLineRef, axis);
}

/**
 * Walk back through the chain to the root linear/aligned dim. Each baseline
 * ancestor adds one DIMDLI step to `parentDimLineOffset`. Continued ancestors
 * keep the offset but advance `continueOrigin` to their own end point.
 */
function resolveChain(
  parentId: string,
  style: DimStyle,
  lookup: DimensionLookup,
): ResolvedChain {
  const parent: DimensionEntity | undefined = lookup(parentId);
  if (!parent) {
    throw new Error(`[chained-builder] Parent dim '${parentId}' not found.`);
  }
  switch (parent.dimensionType) {
    case 'linear':
      return resolveRootLinear(parent);
    case 'aligned':
      return resolveRootAligned(parent);
    case 'baseline': {
      const gp = resolveChain(parent.parentDimensionId, style, lookup);
      return {
        ...gp,
        continueOrigin: parent.defPoints[0],
        parentDimLineOffset: gp.parentDimLineOffset + style.dimdli,
      };
    }
    case 'continued': {
      const gp = resolveChain(parent.parentDimensionId, style, lookup);
      return { ...gp, continueOrigin: parent.defPoints[0] };
    }
    default:
      throw new Error(
        `[chained-builder] Parent dim type '${parent.dimensionType}' cannot anchor a baseline/continued chain.`,
      );
  }
}

/**
 * Construct a synthetic `LinearDimensionEntity` whose `defPoints` describe the
 * effective straight dim to render, then delegate to `buildLinearGeometry`.
 * Carries `textMidpoint` / `userText` overrides from the chained entity.
 */
function buildViaSyntheticLinear(
  entity: BaselineDimensionEntity | ContinuedDimensionEntity,
  style: DimStyle,
  axis: Point2D,
  defPoints: readonly [Point2D, Point2D, Point2D],
): LinearDimGeometry {
  const synthetic: LinearDimensionEntity = {
    id: entity.id,
    type: 'dimension',
    dimensionType: 'linear',
    styleId: entity.styleId,
    layerId: entity.layerId,
    rotation: vectorAngle(axis) / DEG_TO_RAD,
    defPoints,
    textMidpoint: entity.textMidpoint,
    textRotation: entity.textRotation,
    userText: entity.userText,
    overrides: entity.overrides,
  };
  return buildLinearGeometry(synthetic, style);
}

function scaledAlong(base: Point2D, dir: Point2D, magnitude: number): Point2D {
  return { x: base.x + dir.x * magnitude, y: base.y + dir.y * magnitude };
}

/**
 * Baseline dim — shares `baselineOrigin` with the chain root; dim line offset
 * = `parentDimLineOffset + DIMDLI` along `perpOutward`. Throws when `lookup`
 * is missing or the parent cannot be resolved.
 */
export function buildBaselineGeometry(
  entity: BaselineDimensionEntity,
  style: DimStyle,
  lookup: DimensionLookup | undefined,
): LinearDimGeometry {
  if (!lookup) {
    throw new Error(
      '[chained-builder] Baseline dim requires a DimensionLookup to resolve parent.',
    );
  }
  const resolved = resolveChain(entity.parentDimensionId, style, lookup);
  const newExtOrigin = entity.defPoints[0];
  const newOffset = resolved.parentDimLineOffset + style.dimdli;
  const dimLineRef = scaledAlong(
    resolved.baselineOrigin,
    resolved.perpOutward,
    newOffset,
  );
  return buildViaSyntheticLinear(entity, style, resolved.axis, [
    resolved.baselineOrigin,
    newExtOrigin,
    dimLineRef,
  ]);
}

/**
 * Continued dim — chains end-to-end on the parent's dim line; new ext origin 1
 * = parent's `continueOrigin` (its own ext origin 2, after walking through any
 * continued ancestors). Same dim line offset as the parent (no DIMDLI step).
 */
export function buildContinuedGeometry(
  entity: ContinuedDimensionEntity,
  style: DimStyle,
  lookup: DimensionLookup | undefined,
): LinearDimGeometry {
  if (!lookup) {
    throw new Error(
      '[chained-builder] Continued dim requires a DimensionLookup to resolve parent.',
    );
  }
  const resolved = resolveChain(entity.parentDimensionId, style, lookup);
  const newExtOrigin = entity.defPoints[0];
  const dimLineRef = scaledAlong(
    resolved.baselineOrigin,
    resolved.perpOutward,
    resolved.parentDimLineOffset,
  );
  return buildViaSyntheticLinear(entity, style, resolved.axis, [
    resolved.continueOrigin,
    newExtOrigin,
    dimLineRef,
  ]);
}
