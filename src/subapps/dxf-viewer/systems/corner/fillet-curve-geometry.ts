/**
 * FILLET CURVE GEOMETRY — ADR-510 Φ4e.2.
 *
 * The AutoCAD FILLET command also joins ARCS and CIRCLES, not just lines: a tangent arc of
 * radius R is fitted between any two of {line, arc, circle}. This module owns that solver,
 * built on the classic **offset-curve intersection** construction — zero duplicated math:
 *
 *   • each entity is offset to its CENTRE-LOCUS at distance R
 *       line  → two parallel infinite lines (±R along the normal)
 *       arc/circle (O,r) → concentric circles of radius r+R and |r−R|
 *   • a fillet centre C is any intersection of a locus of entity 1 with a locus of entity 2
 *       line∩line   → `infiniteLineIntersection`
 *       line∩circle → `infiniteLineCircleIntersections`
 *       circle∩circle → `GeometricCalculations.getCircleIntersections`
 *   • tangent point Tᵢ = C projected onto the ORIGINAL entity (foot-of-perp for a line,
 *     the O→C ray for a circle/arc)
 *   • AutoCAD disambiguation: pick the centre whose tangent points sit nearest the two clicks.
 *
 * Trim (big-player fidelity): a line resizes to its tangent point, an arc trims/extends its
 * near endpoint to the tangent point (circle stays intact — AutoCAD never trims a full circle).
 * The connector arc is built through the shared `solveTangentArc` SSoT (DEGREES + correct CCW).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ4e.2
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ArcEntity, BaseEntity, CircleEntity, Entity, LineEntity } from '../../types/entities';
import { isLineEntity, isArcEntity, isCircleEntity } from '../../types/entities';
import {
  getUnitVector,
  getPerpendicularUnitVector,
  offsetPoint,
  calculateDistance,
  calculateMidpoint,
  signedDistanceToLine,
  infiniteLineIntersection,
  infiniteLineCircleIntersections,
} from '../../rendering/entities/shared/geometry-vector-utils';
import { arcFrom3Points, arcVisibleCcwRange } from '../../rendering/entities/shared/geometry-arc-utils';
import { degToRad } from '../../rendering/entities/shared/geometry-angle-utils';
import { GeometricCalculations } from '../../snapping/shared/GeometricCalculations';
import { CORNER_EPSILON, trimLineAtPoint } from './corner-math';
import { solveTangentArc } from './fillet-geometry';
import type { CornerTrimOp } from '../../core/commands/entity-commands/CornerEntityCommand';

const TWO_PI = Math.PI * 2;

/** A fillet-able entity: a LINE, an ARC, or a full CIRCLE. */
export type FilletCurveEntity = LineEntity | ArcEntity | CircleEntity;

export interface FilletCurveResult {
  /** The tangent arc to add. */
  readonly arc: ArcEntity;
  /** 0–2 geometry trims (line resize / arc reshape; a circle is never trimmed). */
  readonly trims: readonly CornerTrimOp[];
}

/** True when the entity is one this solver handles as a CURVE-capable fillet target. */
export function isFilletCurveEntity(e: Entity): e is FilletCurveEntity {
  return isLineEntity(e) || isArcEntity(e) || isCircleEntity(e);
}

// ── Offset centre-loci ─────────────────────────────────────────────────────────

type Locus =
  | { readonly kind: 'line'; readonly a: Point2D; readonly b: Point2D }
  | { readonly kind: 'circle'; readonly c: Point2D; readonly r: number };

/** The underlying full circle of an arc/circle entity. */
function underlyingCircle(e: ArcEntity | CircleEntity): { c: Point2D; r: number } {
  return { c: e.center, r: e.radius };
}

/** Centre-loci of `e` at distance `radius`: 2 parallel lines, or 1–2 concentric circles. */
function entityLoci(e: FilletCurveEntity, radius: number): Locus[] {
  if (isLineEntity(e)) {
    const n = getPerpendicularUnitVector(e.start, e.end);
    return [
      { kind: 'line', a: offsetPoint(e.start, n, radius), b: offsetPoint(e.end, n, radius) },
      { kind: 'line', a: offsetPoint(e.start, n, -radius), b: offsetPoint(e.end, n, -radius) },
    ];
  }
  const { c, r } = underlyingCircle(e);
  const loci: Locus[] = [{ kind: 'circle', c, r: r + radius }];
  const inner = Math.abs(r - radius);
  if (inner > CORNER_EPSILON) loci.push({ kind: 'circle', c, r: inner });
  return loci;
}

/** All intersection points of two centre-loci. */
function intersectLoci(l1: Locus, l2: Locus): Point2D[] {
  if (l1.kind === 'line' && l2.kind === 'line') {
    const p = infiniteLineIntersection(l1.a, l1.b, l2.a, l2.b);
    return p ? [p] : [];
  }
  if (l1.kind === 'line' && l2.kind === 'circle') return infiniteLineCircleIntersections(l1.a, l1.b, l2.c, l2.r);
  if (l1.kind === 'circle' && l2.kind === 'line') return infiniteLineCircleIntersections(l2.a, l2.b, l1.c, l1.r);
  if (l1.kind === 'circle' && l2.kind === 'circle') return GeometricCalculations.getCircleIntersections(l1.c, l1.r, l2.c, l2.r);
  return [];
}

/** Tangent point on the ORIGINAL entity for a fillet centre `c`. */
function tangentPointOn(e: FilletCurveEntity, c: Point2D): Point2D | null {
  if (isLineEntity(e)) {
    const perp = getPerpendicularUnitVector(e.start, e.end);
    return offsetPoint(c, perp, -signedDistanceToLine(c, e.start, e.end));
  }
  const { c: o, r } = underlyingCircle(e);
  const dir = getUnitVector(o, c);
  if (dir.x === 0 && dir.y === 0) return null;
  return offsetPoint(o, dir, r);
}

// ── Solver ──────────────────────────────────────────────────────────────────────

interface CentreSolution {
  readonly centre: Point2D;
  readonly t1: Point2D;
  readonly t2: Point2D;
  readonly score: number;
}

/** Enumerate every centre candidate, keep the one whose tangent points sit nearest the picks. */
function bestCentre(
  e1: FilletCurveEntity,
  pick1: Point2D,
  e2: FilletCurveEntity,
  pick2: Point2D,
  radius: number,
): CentreSolution | null {
  let best: CentreSolution | null = null;
  for (const l1 of entityLoci(e1, radius)) {
    for (const l2 of entityLoci(e2, radius)) {
      for (const centre of intersectLoci(l1, l2)) {
        const t1 = tangentPointOn(e1, centre);
        const t2 = tangentPointOn(e2, centre);
        if (!t1 || !t2) continue;
        const score = calculateDistance(t1, pick1) + calculateDistance(t2, pick2);
        if (!best || score < best.score) best = { centre, t1, t2, score };
      }
    }
  }
  return best;
}

/**
 * Fillet two CURVE-capable entities. `pick1`/`pick2` disambiguate which corner/side the user
 * clicked (AutoCAD chooses the fillet nearest the picks). Returns null when no tangent circle
 * of `radius` exists (loci do not intersect) or the corner is degenerate.
 */
export function computeFilletCurve(
  e1: FilletCurveEntity,
  pick1: Point2D,
  e2: FilletCurveEntity,
  pick2: Point2D,
  radius: number,
  trim: boolean,
  newArcId: string,
): FilletCurveResult | null {
  if (radius <= CORNER_EPSILON) return null;
  const sol = bestCentre(e1, pick1, e2, pick2, radius);
  if (!sol) return null;

  const toward = calculateMidpoint(pick1, pick2);
  const angles = solveTangentArc(sol.centre, radius, sol.t1, sol.t2, toward);
  if (!angles) return null;

  const arc = buildArc(e1, sol.centre, radius, angles, newArcId);
  const trims = trim
    ? [...trimFor(e1, sol.t1, pick1), ...trimFor(e2, sol.t2, pick2)]
    : [];
  return { arc, trims };
}

// ── Trims ─────────────────────────────────────────────────────────────────────

/** Trim ops for one entity at its tangent point (line resize / arc reshape; circle → none). */
function trimFor(e: FilletCurveEntity, tangent: Point2D, pick: Point2D): CornerTrimOp[] {
  if (isLineEntity(e)) return [trimLineAtPoint(e, tangent, pick)];
  if (isArcEntity(e)) return [trimArcAtPoint(e, tangent, pick)];
  return []; // full circle is never trimmed (AutoCAD)
}

/** CCW angular distance (radians) from `from` to `to` in [0, 2π). */
function ccwDist(from: number, to: number): number {
  let d = to - from;
  while (d < 0) d += TWO_PI;
  while (d >= TWO_PI) d -= TWO_PI;
  return d;
}

/**
 * Reshape `arc` so its near endpoint moves to the tangent point `tangent`, keeping the portion
 * that contains the user's `pick` (trims OR extends — AutoCAD does both). The arc's circle is
 * unchanged; the retained arc is rebuilt through the tested `arcFrom3Points` SSoT.
 */
function trimArcAtPoint(arc: ArcEntity, tangent: Point2D, pick: Point2D): CornerTrimOp {
  const o = arc.center;
  const pickOnCircle = offsetPoint(o, getUnitVector(o, pick), arc.radius);
  const { start, end } = arcVisibleCcwRange(arc.startAngle, arc.endAngle, arc.counterclockwise);
  const vs = degToRad(start);
  const angT = Math.atan2(tangent.y - o.y, tangent.x - o.x);
  const angPick = Math.atan2(pickOnCircle.y - o.y, pickOnCircle.x - o.x);
  const keptRad = ccwDist(vs, angPick) < ccwDist(vs, angT) ? vs : degToRad(end);
  const keptPt = offsetPoint(o, { x: Math.cos(keptRad), y: Math.sin(keptRad) }, arc.radius);

  const na = arcFrom3Points(keptPt, pickOnCircle, tangent);
  const newGeom: ArcEntity = na
    ? { ...arc, center: na.center, radius: na.radius, startAngle: na.startAngle, endAngle: na.endAngle, counterclockwise: na.counterclockwise }
    : arc;
  return { entityId: arc.id, originalGeom: arc, newGeom };
}

// ── Arc entity build ────────────────────────────────────────────────────────────

const ARC_STYLE_SKIP = new Set([
  'id', 'type', 'start', 'end', 'center', 'radius', 'startAngle', 'endAngle', 'counterclockwise',
  'vertices', 'bulges', 'selected', 'preview', 'previewGripPoints', 'showPreviewGrips', 'startWidths', 'endWidths',
]);

/** Inherit layer/colour/lineweight style from the source entity (AutoCAD inheritance). */
function inheritEntityStyle(source: Entity): Partial<BaseEntity> {
  const src = source as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(src)) {
    if (!ARC_STYLE_SKIP.has(key)) out[key] = src[key];
  }
  return out as Partial<BaseEntity>;
}

function buildArc(
  source: FilletCurveEntity,
  center: Point2D,
  radius: number,
  angles: { startAngle: number; endAngle: number; counterclockwise: boolean },
  id: string,
): ArcEntity {
  return {
    ...inheritEntityStyle(source),
    id,
    type: 'arc',
    layerId: source.layerId,
    center,
    radius,
    startAngle: angles.startAngle,
    endAngle: angles.endAngle,
    counterclockwise: angles.counterclockwise,
    selected: false,
  };
}
