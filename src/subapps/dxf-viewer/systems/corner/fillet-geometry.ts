/**
 * FILLET GEOMETRY — ADR-510 Φ4e.
 *
 * The tangent-arc connector for the AutoCAD FILLET command, plus its polyline
 * "round every corner" variant. Sits on top of the shared `corner-math` harness
 * (vertex / keep-endpoint / angle) and adds only the fillet-specific math:
 *
 *   tangent distance  t = R / tan(θ/2)      (θ = interior angle of the corner)
 *   arc centre        C = V + bisector·(R / sin(θ/2))
 *   R = 0             → pure extend-to-corner (both lines meet at V, no arc)
 *
 * Reuses existing geometry SSoT (offsetPoint / normalizeVector / addPoints /
 * getUnitVector / calculateDistance / angleBetweenVectors) — zero duplicated math.
 * The COMMITTED arc is a real `ArcEntity`; the polyline variant encodes each arc as
 * a DXF `bulge` on the additive bulge model (ADR-510 Φ3).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ4e
 */

import type { Point2D } from '../../rendering/types/Types';
import type {
  ArcEntity,
  LineEntity,
  PolylineEntity,
  LWPolylineEntity,
  BaseEntity,
} from '../../types/entities';
import {
  offsetPoint,
  normalizeVector,
  addPoints,
  getUnitVector,
  angleBetweenVectors,
  pointOnCircle,
  calculateDistance,
} from '../../rendering/entities/shared/geometry-vector-utils';
import { arcFrom3Points } from '../../rendering/entities/shared/geometry-arc-utils';
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

// ── Shared tangent-arc builder (SSoT for line–line AND curve fillets) ──────────

/**
 * Build the DEGREES start/end angles + `counterclockwise` flag of the tangent arc that
 * connects `t1`→`t2` on the circle (`center`, `radius`), choosing the half whose midpoint
 * lies nearest `toward` (the concave/corner side the user filleted). Delegates the CCW/Y-flip
 * convention to the tested `arcFrom3Points` SSoT — so the committed `ArcEntity` renders
 * correctly (the previous inline `atan2` build emitted RADIANS → invisible sliver on commit).
 */
export function solveTangentArc(
  center: Point2D,
  radius: number,
  t1: Point2D,
  t2: Point2D,
  toward: Point2D,
): { startAngle: number; endAngle: number; counterclockwise: boolean } | null {
  const a1 = Math.atan2(t1.y - center.y, t1.x - center.x);
  const a2 = Math.atan2(t2.y - center.y, t2.x - center.x);
  const mAngle = (a1 + a2) / 2;
  const candA = pointOnCircle(center, radius, mAngle);
  const candB = pointOnCircle(center, radius, mAngle + Math.PI);
  const mid = calculateDistance(candA, toward) <= calculateDistance(candB, toward) ? candA : candB;
  const arc = arcFrom3Points(t1, mid, t2);
  if (!arc) return null;
  return { startAngle: arc.startAngle, endAngle: arc.endAngle, counterclockwise: arc.counterclockwise };
}

// ── Two-lines fillet ─────────────────────────────────────────────────────────

/** Solved tangent arc for one corner (angles in DEGREES — DXF scene convention). */
export interface FilletArc {
  readonly center: Point2D;
  readonly radius: number;
  /** DEGREES (matches `ArcEntity` / `ArcRenderer`). */
  readonly startAngle: number;
  readonly endAngle: number;
  readonly counterclockwise: boolean;
  readonly tangent1: Point2D;
  readonly tangent2: Point2D;
  /** Tangent distance from the vertex to each tangent point (`R/tan(θ/2)`). */
  readonly tangentDist: number;
}

export interface FilletTwoLinesResult {
  /** The tangent arc to add (null for R=0 extend-to-corner). */
  readonly arc: ArcEntity | null;
  /** 0–2 line trims (empty in No-trim mode). */
  readonly trims: readonly CornerLineTrim[];
}

/**
 * Solve the tangent arc for a corner. Returns null for R≤0 (caller handles extend)
 * or a degenerate corner (near-collinear → tan/sin ≈ 0).
 */
export function computeFilletArc(anchors: CornerAnchors, radius: number): FilletArc | null {
  if (radius <= CORNER_EPSILON) return null;
  const half = anchors.angle / 2;
  const tan = Math.tan(half);
  const sin = Math.sin(half);
  if (Math.abs(tan) < CORNER_EPSILON || Math.abs(sin) < CORNER_EPSILON) return null;

  const t = radius / tan;
  const tangent1 = offsetPoint(anchors.vertex, anchors.dir1, t);
  const tangent2 = offsetPoint(anchors.vertex, anchors.dir2, t);

  const bisector = normalizeVector(addPoints(anchors.dir1, anchors.dir2));
  if (bisector.x === 0 && bisector.y === 0) return null;
  const center = offsetPoint(anchors.vertex, bisector, radius / sin);

  // Angles in DEGREES via the shared SSoT (fillet bulges toward the corner vertex).
  const arc = solveTangentArc(center, radius, tangent1, tangent2, anchors.vertex);
  if (!arc) return null;

  return {
    center,
    radius,
    startAngle: arc.startAngle,
    endAngle: arc.endAngle,
    counterclockwise: arc.counterclockwise,
    tangent1,
    tangent2,
    tangentDist: t,
  };
}

/** Copy every style/layer field of a source line onto a fresh entity (AutoCAD inheritance). */
function inheritLineStyle(source: LineEntity): Partial<BaseEntity> {
  const {
    id: _id, type: _type, start: _start, end: _end,
    lineWidth: _lw, lineStyle: _ls,
    selected: _sel, preview: _prev, previewGripPoints: _grips, showPreviewGrips: _sg,
    ...style
  } = source;
  return style;
}

function buildFilletArc(source: LineEntity, fa: FilletArc, id: string): ArcEntity {
  return {
    ...inheritLineStyle(source),
    id,
    type: 'arc',
    layerId: source.layerId,
    center: fa.center,
    radius: fa.radius,
    startAngle: fa.startAngle,
    endAngle: fa.endAngle,
    counterclockwise: fa.counterclockwise,
    selected: false,
  };
}

/**
 * Fillet between two lines. `pick1`/`pick2` select which side of each line is kept.
 * Returns null when the lines are parallel, the corner is degenerate, or the radius
 * does not fit within the picked segments.
 */
export function computeFilletTwoLines(
  line1: LineEntity,
  pick1: Point2D,
  line2: LineEntity,
  pick2: Point2D,
  radius: number,
  trim: boolean,
  newArcId: string,
): FilletTwoLinesResult | null {
  const anchors = resolveCornerAnchors(line1, pick1, line2, pick2);
  if (!anchors) return null;

  // R=0 → extend-to-corner (both lines meet at the vertex). No arc.
  if (radius <= CORNER_EPSILON) {
    if (!trim) return null; // nothing to draw
    return {
      arc: null,
      trims: [
        makeLineTrim(line1, anchors.keep1IsStart, anchors.vertex),
        makeLineTrim(line2, anchors.keep2IsStart, anchors.vertex),
      ],
    };
  }

  const fa = computeFilletArc(anchors, radius);
  if (!fa) return null;
  // Radius must fit within each picked segment (tangent point on the kept side).
  if (fa.tangentDist > anchors.len1 + CORNER_EPSILON) return null;
  if (fa.tangentDist > anchors.len2 + CORNER_EPSILON) return null;

  return {
    arc: buildFilletArc(line1, fa, newArcId),
    trims: trim
      ? [
          makeLineTrim(line1, anchors.keep1IsStart, fa.tangent1),
          makeLineTrim(line2, anchors.keep2IsStart, fa.tangent2),
        ]
      : [],
  };
}

// ── Polyline fillet (round every corner) ─────────────────────────────────────

type PolyEntity = PolylineEntity | LWPolylineEntity;

export interface FilletPolylineResult {
  /** New polyline with the fitting corners rounded (width arrays dropped). */
  readonly entity: PolyEntity;
  /** Corners that were rounded. */
  readonly filleted: number;
  /** Corners skipped (radius did not fit, or a neighbouring segment is an arc). */
  readonly skipped: number;
}

/** Per-corner fillet candidate for a polyline vertex (`distPrev`=`distNext`=`t`). */
interface CornerCandidate {
  readonly tangentIn: Point2D;
  readonly tangentOut: Point2D;
  readonly bulge: number;
  readonly distPrev: number;
  readonly distNext: number;
}

/** Solve the fillet candidate at vertex `j`; null when a neighbouring segment is an arc or degenerate. */
function cornerCandidate(
  vertices: readonly Point2D[],
  bulges: readonly number[] | undefined,
  j: number,
  n: number,
  radius: number,
): CornerCandidate | null {
  const prev = (j - 1 + n) % n;
  const next = (j + 1) % n;
  // Only straight-straight corners (skip anything touching an arc segment).
  if (segBulge(bulges, prev) !== 0 || segBulge(bulges, j) !== 0) return null;

  const P = vertices[prev];
  const V = vertices[j];
  const N = vertices[next];
  const dirToPrev = getUnitVector(V, P);
  const dirToNext = getUnitVector(V, N);
  if ((dirToPrev.x === 0 && dirToPrev.y === 0) || (dirToNext.x === 0 && dirToNext.y === 0)) return null;

  const angle = Math.abs(angleBetweenVectors(dirToPrev, dirToNext));
  if (angle < CORNER_EPSILON || Math.PI - angle < CORNER_EPSILON) return null;

  const tan = Math.tan(angle / 2);
  if (Math.abs(tan) < CORNER_EPSILON) return null;
  const t = radius / tan;

  const inDir = getUnitVector(P, V);
  const outDir = getUnitVector(V, N);
  const cross = inDir.x * outDir.y - inDir.y * outDir.x;
  const bulge = Math.sign(cross) * Math.tan((Math.PI - angle) / 4);

  return {
    tangentIn: offsetPoint(V, dirToPrev, t),
    tangentOut: offsetPoint(V, dirToNext, t),
    bulge,
    distPrev: t,
    distNext: t,
  };
}

/** Rebuild a polyline inserting the tangentIn/arc/tangentOut for each candidate corner. */
function buildFilletedPolyline(
  entity: PolyEntity,
  candidates: Map<number, CornerCandidate>,
  totalCorners: number,
): FilletPolylineResult {
  const vertices = entity.vertices;
  const n = vertices.length;
  const outV: Point2D[] = [];
  const outB: number[] = [];
  for (let j = 0; j < n; j++) {
    const c = candidates.get(j);
    const outgoing = segBulge(entity.bulges, j);
    if (c) {
      outV.push(c.tangentIn);
      outB.push(c.bulge);
      outV.push(c.tangentOut);
      outB.push(outgoing);
    } else {
      outV.push(vertices[j]);
      outB.push(outgoing);
    }
  }

  // Vertex count changed → the index-aligned width arrays no longer apply. Drop
  // them, but when the source HAD them we must emit empty arrays explicitly: the
  // command applies this via `updateEntity` (a MERGE), so an omitted key would
  // leave the stale wrong-length arrays on the entity.
  const { startWidths, endWidths, ...rest } = entity;
  const clearedWidths = startWidths || endWidths ? { startWidths: [], endWidths: [] } : {};
  return {
    entity: { ...rest, ...clearedWidths, vertices: outV, bulges: outB },
    filleted: candidates.size,
    skipped: totalCorners - candidates.size,
  };
}

/** Round every fitting corner of a polyline. Returns null if the shape is invalid or nothing fits. */
export function computeFilletPolyline(entity: PolyEntity, radius: number): FilletPolylineResult | null {
  if (radius <= CORNER_EPSILON) return null;
  const vertices = entity.vertices;
  const n = vertices.length;
  const closed = entity.closed === true;
  if (n < 3) return null;

  const corners = cornerIndices(n, closed);
  const candidates = new Map<number, CornerCandidate>();
  for (const j of corners) {
    const c = cornerCandidate(vertices, entity.bulges, j, n, radius);
    if (c) candidates.set(j, c);
  }
  pruneCornerCandidates(candidates, n, closed, vertices);
  if (candidates.size === 0) return null;

  return buildFilletedPolyline(entity, candidates, corners.length);
}

/**
 * Round ONE specific corner (vertex index) of a polyline — the AutoCAD "pick two segments of the
 * same polyline" flow (ADR-510 Φ4e.2). `cornerIndex` is the shared vertex between the two picked
 * segments (see {@link resolveSharedPolylineCorner}). Returns null if that corner cannot be rounded.
 */
export function computeFilletPolylineCorner(
  entity: PolyEntity,
  cornerIndex: number,
  radius: number,
): FilletPolylineResult | null {
  if (radius <= CORNER_EPSILON) return null;
  const vertices = entity.vertices;
  const n = vertices.length;
  const closed = entity.closed === true;
  if (n < 3) return null;
  if (!cornerIndices(n, closed).includes(cornerIndex)) return null;

  const c = cornerCandidate(vertices, entity.bulges, cornerIndex, n, radius);
  if (!c) return null;
  const candidates = new Map<number, CornerCandidate>([[cornerIndex, c]]);
  pruneCornerCandidates(candidates, n, closed, vertices);
  if (candidates.size === 0) return null;

  return buildFilletedPolyline(entity, candidates, 1);
}

// `resolveSharedPolylineCorner` (shared by fillet & chamfer) now lives in `corner-math` (SSoT).
