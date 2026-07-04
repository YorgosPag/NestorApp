/**
 * CHAMFER GEOMETRY — ADR-510 Φ4f.
 *
 * The straight-bevel connector for the AutoCAD CHAMFER command, plus its polyline
 * "bevel every corner" variant. Sits on the shared `corner-math` harness (vertex /
 * keep-endpoint / angle / prune) and adds only the chamfer-specific math:
 *
 *   Distance mode : P1 = V + dir1·d1 , P2 = V + dir2·d2
 *   Angle mode    : P1 = V + dir1·d1 , d2 = d1·sin(α)/sin(θ+α) , P2 = V + dir2·d2
 *                   (α = bevel angle from line 1, θ = interior corner angle; law of sines)
 *
 * The connector is a straight `LineEntity` P1→P2 (inherits line 1's style). The
 * polyline variant inserts P1/P2 with a straight segment between them (no bulge).
 * Reuses existing geometry SSoT — zero duplicated math.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ4f
 */

import type { Point2D } from '../../rendering/types/Types';
import type { LineEntity, PolylineEntity, LWPolylineEntity } from '../../types/entities';
import { offsetPoint, getUnitVector } from '../../rendering/entities/shared/geometry-vector-utils';
import {
  CORNER_EPSILON,
  resolveCornerAnchors,
  makeLineTrim,
  segBulge,
  cornerIndices,
  pruneCornerCandidates,
  type CornerAnchors,
  type CornerLineTrim,
} from './corner-math';
import type { ChamferMode } from './chamfer-types';

// ── Two-lines chamfer ────────────────────────────────────────────────────────

export interface ChamferTwoLinesResult {
  /** The bevel line to add. */
  readonly bevel: LineEntity;
  /** 0–2 line trims (empty in No-trim mode). */
  readonly trims: readonly CornerLineTrim[];
}

/** Resolve the two cut distances for a corner: as given (distance mode) or via the law of sines. */
export function resolveChamferDistances(
  anchors: CornerAnchors,
  d1: number,
  d2: number,
  angleDeg: number,
  mode: ChamferMode,
): { d1: number; d2: number } | null {
  if (mode === 'distance') return { d1, d2 };
  const alpha = (angleDeg * Math.PI) / 180;
  const denom = Math.sin(anchors.angle + alpha);
  if (Math.abs(denom) < CORNER_EPSILON) return null;
  const derivedD2 = (d1 * Math.sin(alpha)) / denom;
  if (!(derivedD2 > 0)) return null;
  return { d1, d2: derivedD2 };
}

/**
 * Chamfer between two lines. `pick1`/`pick2` select which side of each line is kept.
 * Returns null when the lines are parallel, the corner is degenerate, or a cut
 * distance does not fit the picked segment.
 */
export function computeChamferTwoLines(
  line1: LineEntity,
  pick1: Point2D,
  line2: LineEntity,
  pick2: Point2D,
  d1: number,
  d2: number,
  angleDeg: number,
  mode: ChamferMode,
  trim: boolean,
  newLineId: string,
): ChamferTwoLinesResult | null {
  const anchors = resolveCornerAnchors(line1, pick1, line2, pick2);
  if (!anchors) return null;

  const dist = resolveChamferDistances(anchors, d1, d2, angleDeg, mode);
  if (!dist) return null;
  if (dist.d1 <= CORNER_EPSILON || dist.d2 <= CORNER_EPSILON) return null;
  if (dist.d1 > anchors.len1 + CORNER_EPSILON) return null;
  if (dist.d2 > anchors.len2 + CORNER_EPSILON) return null;

  const p1 = offsetPoint(anchors.vertex, anchors.dir1, dist.d1);
  const p2 = offsetPoint(anchors.vertex, anchors.dir2, dist.d2);
  // Bevel inherits line 1's full style (source IS a LineEntity → spread, override geometry).
  const bevel: LineEntity = { ...line1, id: newLineId, start: p1, end: p2, selected: false };

  return {
    bevel,
    trims: trim
      ? [
          makeLineTrim(line1, anchors.keep1IsStart, p1),
          makeLineTrim(line2, anchors.keep2IsStart, p2),
        ]
      : [],
  };
}

// ── Polyline chamfer (bevel every corner) ────────────────────────────────────

type PolyEntity = PolylineEntity | LWPolylineEntity;

export interface ChamferPolylineResult {
  /** New polyline with the fitting corners beveled (width arrays dropped). */
  readonly entity: PolyEntity;
  /** Corners that were beveled. */
  readonly chamfered: number;
  /** Corners skipped (a cut did not fit, or a neighbouring segment is an arc). */
  readonly skipped: number;
}

/** Per-corner chamfer candidate: the two bevel endpoints + how much each side consumes. */
interface ChamferCandidate {
  readonly pIn: Point2D;
  readonly pOut: Point2D;
  readonly distPrev: number;
  readonly distNext: number;
}

/** Solve the chamfer candidate at vertex `j`; null when a neighbouring segment is an arc or degenerate. */
function chamferCandidate(
  vertices: readonly Point2D[],
  bulges: readonly number[] | undefined,
  j: number,
  n: number,
  d1: number,
  d2: number,
): ChamferCandidate | null {
  const prev = (j - 1 + n) % n;
  if (segBulge(bulges, prev) !== 0 || segBulge(bulges, j) !== 0) return null;

  const V = vertices[j];
  const dirToPrev = getUnitVector(V, vertices[prev]);
  const dirToNext = getUnitVector(V, vertices[(j + 1) % n]);
  if ((dirToPrev.x === 0 && dirToPrev.y === 0) || (dirToNext.x === 0 && dirToNext.y === 0)) return null;

  return {
    pIn: offsetPoint(V, dirToPrev, d1),
    pOut: offsetPoint(V, dirToNext, d2),
    distPrev: d1,
    distNext: d2,
  };
}

/** Rebuild a polyline inserting the straight bevel (pIn→pOut) for each candidate corner. */
function buildChameferedPolyline(
  entity: PolyEntity,
  candidates: Map<number, ChamferCandidate>,
  totalCorners: number,
): ChamferPolylineResult {
  const vertices = entity.vertices;
  const n = vertices.length;
  const outV: Point2D[] = [];
  const outB: number[] = [];
  for (let j = 0; j < n; j++) {
    const c = candidates.get(j);
    const outgoing = segBulge(entity.bulges, j);
    if (c) {
      outV.push(c.pIn);
      outB.push(0); // bevel segment pIn→pOut is straight
      outV.push(c.pOut);
      outB.push(outgoing);
    } else {
      outV.push(vertices[j]);
      outB.push(outgoing);
    }
  }

  // Vertex count changed → clear the now-invalid index-aligned width arrays
  // (explicit empty arrays: the command applies via updateEntity, a MERGE).
  const { startWidths, endWidths, ...rest } = entity;
  const clearedWidths = startWidths || endWidths ? { startWidths: [], endWidths: [] } : {};
  return {
    entity: { ...rest, ...clearedWidths, vertices: outV, bulges: outB },
    chamfered: candidates.size,
    skipped: totalCorners - candidates.size,
  };
}

/** Bevel every fitting corner of a polyline. Returns null if the shape is invalid or nothing fits. */
export function computeChamferPolyline(entity: PolyEntity, d1: number, d2: number): ChamferPolylineResult | null {
  if (d1 <= CORNER_EPSILON || d2 <= CORNER_EPSILON) return null;
  const vertices = entity.vertices;
  const n = vertices.length;
  const closed = entity.closed === true;
  if (n < 3) return null;

  const corners = cornerIndices(n, closed);
  const candidates = new Map<number, ChamferCandidate>();
  for (const j of corners) {
    const c = chamferCandidate(vertices, entity.bulges, j, n, d1, d2);
    if (c) candidates.set(j, c);
  }
  pruneCornerCandidates(candidates, n, closed, vertices);
  if (candidates.size === 0) return null;

  return buildChameferedPolyline(entity, candidates, corners.length);
}

/**
 * Bevel ONE specific corner (vertex index) of a polyline — the AutoCAD "pick two segments of the
 * same polyline" flow for CHAMFER (ADR-510 Φ4f.2). `cornerIndex` is the shared vertex between the
 * two picked segments (see `resolveSharedPolylineCorner`). Returns null if it cannot be beveled.
 */
export function computeChamferPolylineCorner(
  entity: PolyEntity,
  cornerIndex: number,
  d1: number,
  d2: number,
): ChamferPolylineResult | null {
  if (d1 <= CORNER_EPSILON || d2 <= CORNER_EPSILON) return null;
  const vertices = entity.vertices;
  const n = vertices.length;
  const closed = entity.closed === true;
  if (n < 3) return null;
  if (!cornerIndices(n, closed).includes(cornerIndex)) return null;

  const c = chamferCandidate(vertices, entity.bulges, cornerIndex, n, d1, d2);
  if (!c) return null;
  const candidates = new Map<number, ChamferCandidate>([[cornerIndex, c]]);
  pruneCornerCandidates(candidates, n, closed, vertices);
  if (candidates.size === 0) return null;

  return buildChameferedPolyline(entity, candidates, 1);
}
