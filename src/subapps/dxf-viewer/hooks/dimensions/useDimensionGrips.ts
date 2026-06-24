/**
 * ADR-362 Phase I2 — Dimension grip computation + drag transforms.
 *
 * Pure functions — zero React / DOM / Firestore / canvas deps.
 * Mirrors `bim/stairs/stair-grips.ts` (ADR-358 Phase 5b) pattern.
 *
 * 5 grips per DimensionEntity (§D9):
 *   0 → defPoints[0]   ext line origin 1
 *   1 → defPoints[1]   ext line origin 2
 *   2 → defPoints[2]   dim line reference (only for 3+ defPoint types)
 *   3 → textMidpoint   text label (computed fallback when absent)
 *   4 → type-specific  rotation handle (linear) / arcPoint / jogPoint / datum / etc.
 *
 * `applyDimensionGripDrag` returns a new `DimensionEntity` with the
 * relevant field immutably updated. Measurement recompute is deferred
 * to the render pass (same lifecycle as the creation path).
 *
 * @see hooks/grip-computation.ts      — wires getDimensionGrips into computeDxfEntityGrips
 * @see hooks/grips/grip-commit-adapters.ts — commitDimensionGripDrag commit path
 * @see ADR-362 §D9/I
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DxfDimension } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { GripInfo, DimensionGripKind } from '../grip-types';
import type {
  DimensionEntity,
  LinearDimensionEntity,
  OrdinateDimensionEntity,
} from '../../types/dimension';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROTATION_HANDLE_OFFSET = 50;
const RAD_TO_DEG = 180 / Math.PI;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function translate(p: Point2D, delta: Point2D): Point2D {
  return { x: p.x + delta.x, y: p.y + delta.y };
}

function midpt(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function unitVec(from: Point2D, to: Point2D): Point2D {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-9) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

function patchDefPoint(
  dimEntity: DimensionEntity,
  index: number,
  delta: Point2D,
): DimensionEntity {
  const pts = dimEntity.defPoints;
  if (index >= pts.length) return dimEntity;
  const newPts = [...pts] as Point2D[];
  newPts[index] = translate(pts[index], delta);
  return { ...dimEntity, defPoints: newPts };
}

function resolveTextMidpoint(dim: DimensionEntity): Point2D {
  if (dim.textMidpoint) return dim.textMidpoint;
  const pts = dim.defPoints;
  if (pts.length >= 2) return midpt(pts[0], pts[1]);
  if (pts.length >= 1) return pts[0];
  return { x: 0, y: 0 };
}

function extraGripPos(dim: DimensionEntity): Point2D | null {
  const pts = dim.defPoints;
  switch (dim.dimensionType) {
    case 'linear':
    case 'aligned': {
      if (pts.length < 3) return null;
      const u = unitVec(pts[0], pts[1]);
      return { x: pts[2].x + u.x * ROTATION_HANDLE_OFFSET, y: pts[2].y + u.y * ROTATION_HANDLE_OFFSET };
    }
    case 'radius':
    case 'diameter':
      return pts.length >= 2 ? pts[1] : null;
    case 'angular2L':
      return pts.length >= 5 ? pts[4] : null;
    case 'angular3P':
      return pts.length >= 4 ? pts[3] : null;
    case 'ordinate':
      return dim.datum;
    case 'arcLength':
    case 'joggedRadius':
      return pts.length >= 3 ? pts[2] : null;
    case 'baseline':
    case 'continued':
      return pts.length >= 1 ? pts[0] : null;
    default:
      return null;
  }
}

// ─── Public: grip positions ───────────────────────────────────────────────────

/**
 * Compute up to 5 grips for a DxfDimension entity.
 * Consumed by `computeDxfEntityGrips` (hooks/grip-computation.ts).
 */
export function getDimensionGrips(entity: DxfDimension): GripInfo[] {
  const dim = entity.dimensionEntity;
  const pts = dim.defPoints;
  const id = entity.id;
  const grips: GripInfo[] = [];

  if (pts.length >= 1) {
    grips.push({ entityId: id, gripIndex: 0, type: 'vertex', position: pts[0], movesEntity: false, dimGripKind: 'dim-defpoint-0' });
  }

  if (pts.length >= 2) {
    grips.push({ entityId: id, gripIndex: 1, type: 'vertex', position: pts[1], movesEntity: false, dimGripKind: 'dim-defpoint-1' });
  }

  if (pts.length >= 3) {
    grips.push({ entityId: id, gripIndex: 2, type: 'edge', position: pts[2], movesEntity: false, dimGripKind: 'dim-line-ref' });
  }

  grips.push({ entityId: id, gripIndex: 3, type: 'center', position: resolveTextMidpoint(dim), movesEntity: false, dimGripKind: 'dim-text' });

  const extraPos = extraGripPos(dim);
  if (extraPos) {
    grips.push({ entityId: id, gripIndex: 4, type: 'vertex', position: extraPos, movesEntity: false, dimGripKind: 'dim-extra' });
  }

  return grips;
}

// ─── Public: drag transform ───────────────────────────────────────────────────

/**
 * Pure transform: dimension grip kind + drag delta → new `DimensionEntity`.
 * Caller (`commitDimensionGripDrag`) persists the result to the scene.
 *
 * @param gripPos World position captured at mouseDown; used only for `dim-extra`
 *                rotation handle (linear dim: new rotation = atan2(cursor − dimLineRef)).
 */
export function applyDimensionGripDrag(
  kind: DimensionGripKind,
  dimEntity: DimensionEntity,
  delta: Point2D,
  gripPos: Point2D,
): DimensionEntity {
  switch (kind) {
    case 'dim-defpoint-0': return patchDefPoint(dimEntity, 0, delta);
    case 'dim-defpoint-1': return patchDefPoint(dimEntity, 1, delta);
    case 'dim-line-ref':   return patchDefPoint(dimEntity, 2, delta);
    case 'dim-text': {
      const old = resolveTextMidpoint(dimEntity);
      return { ...dimEntity, textMidpoint: translate(old, delta) };
    }
    case 'dim-extra': return applyExtraGripDrag(dimEntity, delta, gripPos);
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return dimEntity;
    }
  }
}

// ─── Public: undoable patch diff (grip commit) ──────────────────────────────────

/**
 * Minimal field patch for a dimension grip edit — only the fields a grip drag can
 * touch. Consumed by `UpdateDimGripCommand` (undoable, drag-coalescing).
 */
export interface DimGripPatch {
  defPoints?: readonly Point2D[];
  textMidpoint?: Point2D;
  /** Linear dim rotation handle (degrees). */
  rotation?: number;
  /** Ordinate datum origin. */
  datum?: Point2D;
}

function pointEq(a: Point2D, b: Point2D): boolean {
  return a.x === b.x && a.y === b.y;
}

function pointOptEq(a: Point2D | undefined, b: Point2D | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return pointEq(a, b);
}

function defPointsEq(a: readonly Point2D[], b: readonly Point2D[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!pointEq(a[i], b[i])) return false;
  return true;
}

/**
 * Value-compare two dimension entities (pre/post grip drag) and return the minimal
 * symmetric `{ patch, previous }` — ONLY the fields that actually changed, by value
 * (not reference, since `applyDimensionGripDrag` always allocates fresh arrays).
 *
 * Empty `patch` ⇒ no-op (zero-delta click) — the caller must skip the command so it
 * never pollutes the undo stack.
 */
export function diffDimEntity(
  prev: DimensionEntity,
  next: DimensionEntity,
): { patch: DimGripPatch; previous: DimGripPatch } {
  const patch: DimGripPatch = {};
  const previous: DimGripPatch = {};

  if (!defPointsEq(prev.defPoints, next.defPoints)) {
    patch.defPoints = next.defPoints;
    previous.defPoints = prev.defPoints;
  }
  if (!pointOptEq(prev.textMidpoint, next.textMidpoint)) {
    patch.textMidpoint = next.textMidpoint;
    previous.textMidpoint = prev.textMidpoint;
  }
  const prevRot = (prev as { rotation?: number }).rotation;
  const nextRot = (next as { rotation?: number }).rotation;
  if (prevRot !== nextRot) {
    patch.rotation = nextRot;
    previous.rotation = prevRot;
  }
  const prevDatum = (prev as { datum?: Point2D }).datum;
  const nextDatum = (next as { datum?: Point2D }).datum;
  if (!pointOptEq(prevDatum, nextDatum)) {
    patch.datum = nextDatum;
    previous.datum = prevDatum;
  }
  return { patch, previous };
}

function applyExtraGripDrag(
  dimEntity: DimensionEntity,
  delta: Point2D,
  gripPos: Point2D,
): DimensionEntity {
  const pts = dimEntity.defPoints;
  switch (dimEntity.dimensionType) {
    case 'linear': {
      if (pts.length < 3) return dimEntity;
      const currentPos = translate(gripPos, delta);
      const newRotation = Math.atan2(currentPos.y - pts[2].y, currentPos.x - pts[2].x) * RAD_TO_DEG;
      return { ...(dimEntity as LinearDimensionEntity), rotation: newRotation };
    }
    case 'aligned':
      return patchDefPoint(dimEntity, 2, delta);
    case 'radius':
    case 'diameter':
      return patchDefPoint(dimEntity, 1, delta);
    case 'angular2L':
      return patchDefPoint(dimEntity, 4, delta);
    case 'angular3P':
      return patchDefPoint(dimEntity, 3, delta);
    case 'ordinate':
      return { ...dimEntity, datum: translate(dimEntity.datum, delta) };
    case 'arcLength':
    case 'joggedRadius':
      return patchDefPoint(dimEntity, 2, delta);
    case 'baseline':
    case 'continued':
      return patchDefPoint(dimEntity, 0, delta);
    default:
      return dimEntity;
  }
}
