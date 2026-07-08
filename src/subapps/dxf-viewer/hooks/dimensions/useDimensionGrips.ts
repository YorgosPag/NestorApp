/**
 * ADR-362 Phase I2 — Dimension grip computation + drag transforms.
 *
 * Pure functions — zero React / DOM / Firestore / canvas deps.
 * Mirrors `bim/stairs/stair-grips.ts` (ADR-358 Phase 5b) pattern.
 *
 * 5 grips per DimensionEntity (§D9):
 *   0 → defPoints[0]   ext line origin 1
 *   1 → defPoints[1]   ext line origin 2
 *   2 → dim-line end 1 (linear/aligned: footStart from hit-geometry; else defPoints[2])
 *   3 → text label     (linear/aligned: real textAnchor; else textMidpoint fallback)
 *   4 → dim-line end 2 (linear/aligned: footEnd — 2nd OFFSET grip, NO rotation;
 *                       else type-specific arcPoint / jogPoint / datum / etc.)
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
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import type { DxfDimension } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { GripInfo, DimensionGripKind } from '../grip-types';
import { computeDimHitGeometry } from '../../systems/dimensions/dim-hit-geometry';
import type {
  DimensionEntity,
  OrdinateDimensionEntity,
} from '../../types/dimension';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function midpt(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function patchDefPoint(
  dimEntity: DimensionEntity,
  index: number,
  delta: Point2D,
): DimensionEntity {
  const pts = dimEntity.defPoints;
  if (index >= pts.length) return dimEntity;
  const newPts = [...pts] as Point2D[];
  newPts[index] = translatePoint(pts[index], delta);
  return { ...dimEntity, defPoints: newPts };
}

function resolveTextMidpoint(dim: DimensionEntity): Point2D {
  if (dim.textMidpoint) return dim.textMidpoint;
  const pts = dim.defPoints;
  if (pts.length >= 2) return midpt(pts[0], pts[1]);
  if (pts.length >= 1) return pts[0];
  return { x: 0, y: 0 };
}

/**
 * 5th ("extra") grip position for the NON-linear variants only. Linear & aligned
 * dims resolve their dim-line + text grips from `computeDimHitGeometry` (see
 * `getDimensionGrips`) and never reach here.
 */
function extraGripPos(dim: DimensionEntity): Point2D | null {
  const pts = dim.defPoints;
  switch (dim.dimensionType) {
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
    grips.push({ entityId: id, gripIndex: 0, type: 'vertex', position: pts[0], movesEntity: false, gripKind: { on: 'dimension', kind: 'dim-defpoint-0' } });
  }

  if (pts.length >= 2) {
    grips.push({ entityId: id, gripIndex: 1, type: 'vertex', position: pts[1], movesEntity: false, gripKind: { on: 'dimension', kind: 'dim-defpoint-1' } });
  }

  // ADR-362 §D9 — linear/aligned dims read their dim-line + text grip positions
  // from the RENDERED geometry (dim-hit SSoT), not raw params. Grips 2 & 4 sit on
  // the TWO real dim-line endpoints (footStart/footEnd) — both STRETCH the offset
  // (AutoCAD parity, NO rotation handle); grip 3 sits on the actual text anchor.
  // Interaction ≡ render ≡ hit-test, all consuming computeDimHitGeometry.
  const hit = computeDimHitGeometry(dim);
  if (hit) {
    grips.push({ entityId: id, gripIndex: 2, type: 'edge', position: hit.footStart, movesEntity: false, gripKind: { on: 'dimension', kind: 'dim-line-ref' } });
    grips.push({ entityId: id, gripIndex: 3, type: 'center', position: hit.textAnchor, movesEntity: false, gripKind: { on: 'dimension', kind: 'dim-text' } });
    grips.push({ entityId: id, gripIndex: 4, type: 'edge', position: hit.footEnd, movesEntity: false, gripKind: { on: 'dimension', kind: 'dim-extra' } });
    return grips;
  }

  // Non-linear variants (radial / angular / ordinate / baseline / continued) keep
  // the raw-param positions — their dim-line ref + 5th grip stay type-specific.
  if (pts.length >= 3) {
    grips.push({ entityId: id, gripIndex: 2, type: 'edge', position: pts[2], movesEntity: false, gripKind: { on: 'dimension', kind: 'dim-line-ref' } });
  }

  grips.push({ entityId: id, gripIndex: 3, type: 'center', position: resolveTextMidpoint(dim), movesEntity: false, gripKind: { on: 'dimension', kind: 'dim-text' } });

  const extraPos = extraGripPos(dim);
  if (extraPos) {
    grips.push({ entityId: id, gripIndex: 4, type: 'vertex', position: extraPos, movesEntity: false, gripKind: { on: 'dimension', kind: 'dim-extra' } });
  }

  return grips;
}

// ─── Public: drag transform ───────────────────────────────────────────────────

/**
 * Pure transform: dimension grip kind + drag delta → new `DimensionEntity`.
 * Caller (`commitDimensionGripDrag`) persists the result to the scene.
 *
 * @param gripPos World position captured at mouseDown. Retained for signature
 *                stability across grip kinds; no longer read (the linear `dim-extra`
 *                rotation handle was removed 2026-07-06 — dims must not free-rotate).
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
      return { ...dimEntity, textMidpoint: translatePoint(old, delta) };
    }
    case 'dim-extra': return applyExtraGripDrag(dimEntity, delta, gripPos);
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return dimEntity;
    }
  }
}

// ─── Public: alignment-tracking anchors (ADR-562 Φ9.2) ──────────────────────────

/**
 * Resolve a raw scene entity to its `DimensionEntity`. The SceneModel stores the
 * `DimensionEntity` directly, while the `DxfDimension` wrapper (with `.dimensionEntity`)
 * exists only for the render pipeline — this normalises both. Returns `null` for a
 * missing / non-dimension entity. Shared SSoT so every dim consumer (grip ghost,
 * mouse handlers) resolves the entity identically.
 */
export function toDimensionEntity(raw: unknown): DimensionEntity | null {
  if (!raw || (raw as { type?: string }).type !== 'dimension') return null;
  const wrapper = raw as { dimensionEntity?: DimensionEntity };
  return wrapper.dimensionEntity ?? (raw as DimensionEntity);
}

/**
 * ADR-562 Φ9.2 / ADR-357 — the explicit alignment anchors for a dimension grip drag.
 *
 * When a dimension grip is dragged, the AutoAlign traces should emanate from the
 * dimension's OTHER real-world points (the anchors we align the moving point to),
 * exactly as the creation flow uses the already-picked clicks. This returns those
 * anchors per grip kind; ambient + acquired anchors are merged by
 * `resolveDimAlignmentTracking` on top.
 *
 * Returns `null` when the grip does NOT translate a point (linear rotation handle,
 * angular vertices) — alignment tracking is meaningless there and the caller skips it.
 * An empty array means "no explicit anchor, but still run ambient/acquired tracking".
 */
export function getDimGripAlignmentAnchors(
  kind: DimensionGripKind,
  dim: DimensionEntity,
): Point2D[] | null {
  const pts = dim.defPoints;
  switch (kind) {
    // Extension-line origins align to their partner origin (H/V/polar from the pair).
    case 'dim-defpoint-0': return pts.length >= 2 ? [pts[1]] : [];
    case 'dim-defpoint-1': return pts.length >= 1 ? [pts[0]] : [];
    // Dim-line offset + text align to both measured origins (keep the run parallel).
    case 'dim-line-ref':   return pts.slice(0, 2);
    case 'dim-text':       return pts.slice(0, Math.min(2, pts.length));
    case 'dim-extra':
      switch (dim.dimensionType) {
        // linear & aligned 5th grip = 2nd dim-line OFFSET endpoint (patches
        // defPoints[2]) → align to both measured origins, like dim-line-ref.
        case 'linear':
        case 'aligned':  return pts.slice(0, 2);
        case 'radius':
        case 'diameter': return pts.length >= 1 ? [pts[0]] : []; // measure point → centre
        case 'ordinate': return pts.length >= 1 ? [pts[0]] : []; // datum → leader origin
        // Angular vertices = arc geometry: no point translation to align → skip.
        case 'angular2L':
        case 'angular3P':
        default:         return null;
      }
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return null;
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
    // ADR-362 §D9 — linear & aligned: the 5th grip is the 2nd dim-line endpoint
    // (footEnd). Both dim-line grips STRETCH the offset via defPoints[2] (AutoCAD
    // parity). NO rotation — dimensions must not free-rotate (rotation handle
    // removed 2026-07-06; see ADR-362 changelog).
    case 'linear':
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
      return { ...dimEntity, datum: translatePoint(dimEntity.datum, delta) };
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
