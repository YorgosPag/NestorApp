/**
 * ADR-362 Phase D2 — Radial family + Ordinate creation builders.
 *
 * Split out of `dimension-create-entity-builder.ts` so the main dispatcher stays
 * under the 500-LOC Google SRP cap (CLAUDE.md N.7.1). Same public contract as
 * the linear/angular builders: pure `(state, opts) → DimensionEntity | null`.
 *
 * Flow semantics (AutoCAD-aligned, Q-A/B/C/D in ADR-362 §7 Phase D2):
 *   - Radius / JoggedRadius: click 1 picks arc/circle (→ center + radius);
 *     subsequent clicks (or cursor in preview) set text direction. `arcPoint`
 *     is snapped to the perimeter at that direction so the leader anchors on
 *     real geometry, not in empty space.
 *   - Diameter: click 1 picks circle + its world position picks the side1
 *     direction; side2 is the antipodal point (Q-B auto-derive). Click 2 is
 *     the text position only.
 *   - ArcLength: click 1 picks arc — center / arcStart / arcEnd are derived
 *     from the arc's own `startAngle` / `endAngle`. Click 2 = text position.
 *   - Ordinate: click 1 = measured feature, click 2 = leader endpoint. Axis
 *     auto-detected from leader direction. Datum hardcoded to `{x:0, y:0}`
 *     until Phase F (multi-viewport UCS) lands.
 */

import type { Point2D } from '../../rendering/types/Types';
import type {
  ArcLengthDimensionEntity,
  DiameterDimensionEntity,
  JoggedRadiusDimensionEntity,
  OrdinateDimensionEntity,
  RadiusDimensionEntity,
} from '../../types/dimension';
import type { ArcEntity, CircleEntity } from '../../types/entities';
import { pointOnCircle } from '../../rendering/entities/shared/geometry-vector-utils';
import type { DimensionCreateState } from './dimension-create-state';

export interface RadialBuildOpts {
  readonly id: string;
  readonly layerId: string;
  readonly includeCursor: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Builders
// ──────────────────────────────────────────────────────────────────────────────

export function buildRadius(
  state: DimensionCreateState,
  opts: RadialBuildOpts,
): RadiusDimensionEntity | null {
  const arcLike = firstArcLike(state);
  if (!arcLike) return null;
  const second = secondPoint(state, opts);
  if (!second) return null;
  const arcPoint = perimeterPointAtDirection(arcLike.center, arcLike.radius, second);
  return {
    id: opts.id,
    type: 'dimension',
    dimensionType: 'radius',
    layerId: opts.layerId,
    styleId: state.styleId as string,
    defPoints: [arcLike.center, arcPoint],
    textMidpoint: second,
  };
}

export function buildDiameter(
  state: DimensionCreateState,
  opts: RadialBuildOpts,
): DiameterDimensionEntity | null {
  const c = firstCircle(state);
  if (!c) return null;
  // Click 1's world position picks the side1 direction; side2 is antipodal (Q-B).
  const click1World = state.clicks[0]?.world ?? c.center;
  const side1 = perimeterPointAtDirection(c.center, c.radius, click1World);
  const side2: Point2D = { x: 2 * c.center.x - side1.x, y: 2 * c.center.y - side1.y };
  const textPos = secondPoint(state, opts);
  return {
    id: opts.id,
    type: 'dimension',
    dimensionType: 'diameter',
    layerId: opts.layerId,
    styleId: state.styleId as string,
    defPoints: [side1, side2],
    ...(textPos ? { textMidpoint: textPos } : {}),
  };
}

export function buildArcLength(
  state: DimensionCreateState,
  opts: RadialBuildOpts,
): ArcLengthDimensionEntity | null {
  const a = firstArc(state);
  if (!a) return null;
  const arcStart = pointOnCircle(a.center, a.radius, a.startAngle);
  const arcEnd = pointOnCircle(a.center, a.radius, a.endAngle);
  const textPos = secondPoint(state, opts);
  return {
    id: opts.id,
    type: 'dimension',
    dimensionType: 'arcLength',
    layerId: opts.layerId,
    styleId: state.styleId as string,
    defPoints: [a.center, arcStart, arcEnd],
    ...(textPos ? { textMidpoint: textPos } : {}),
  };
}

export function buildJoggedRadius(
  state: DimensionCreateState,
  opts: RadialBuildOpts,
): JoggedRadiusDimensionEntity | null {
  const a = firstArcLike(state);
  if (!a) return null;
  // Up to 3 remaining slots (arcPoint, jogPoint, jogVertex) sourced from clicks
  // 1..3, padded with the cursor in preview mode so the rubber-band stays alive.
  const rest = collectExtraPoints(state, opts, 3);
  if (rest.length === 0) return null;
  const arcPoint = perimeterPointAtDirection(a.center, a.radius, rest[0]);
  const jogPoint = rest[1] ?? arcPoint;
  const jogVertex = rest[2] ?? jogPoint;
  return {
    id: opts.id,
    type: 'dimension',
    dimensionType: 'joggedRadius',
    layerId: opts.layerId,
    styleId: state.styleId as string,
    defPoints: [a.center, arcPoint, jogPoint, jogVertex],
  };
}

export function buildOrdinate(
  state: DimensionCreateState,
  opts: RadialBuildOpts,
): OrdinateDimensionEntity | null {
  const feature = state.clicks[0]?.world;
  if (!feature) return null;
  const leaderEnd = secondPoint(state, opts);
  const datum: Point2D = { x: 0, y: 0 };
  const axis = leaderEnd ? deriveOrdinateAxis(feature, leaderEnd) : 'x';
  return {
    id: opts.id,
    type: 'dimension',
    dimensionType: 'ordinate',
    layerId: opts.layerId,
    styleId: state.styleId as string,
    defPoints: [feature],
    axis,
    datum,
    ...(leaderEnd ? { textMidpoint: leaderEnd } : {}),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

interface ArcLikePick {
  readonly center: Point2D;
  readonly radius: number;
}

function firstArcLike(state: DimensionCreateState): ArcLikePick | null {
  const e = state.clicks[0]?.pickedEntity;
  if (!e) return null;
  if (e.type === 'arc' || e.type === 'circle') {
    return { center: e.center, radius: e.radius };
  }
  return null;
}

function firstCircle(state: DimensionCreateState): CircleEntity | null {
  const e = state.clicks[0]?.pickedEntity;
  return e && e.type === 'circle' ? e : null;
}

function firstArc(state: DimensionCreateState): ArcEntity | null {
  const e = state.clicks[0]?.pickedEntity;
  return e && e.type === 'arc' ? e : null;
}

function secondPoint(state: DimensionCreateState, opts: RadialBuildOpts): Point2D | null {
  const explicit = state.clicks[1]?.world;
  if (explicit) return explicit;
  if (opts.includeCursor && state.cursorWorld) return state.cursorWorld;
  return null;
}

function collectExtraPoints(
  state: DimensionCreateState,
  opts: RadialBuildOpts,
  maxCount: number,
): readonly Point2D[] {
  const out: Point2D[] = [];
  for (let i = 1; i <= maxCount; i++) {
    const w = state.clicks[i]?.world;
    if (w) out.push(w);
    else break;
  }
  if (out.length < maxCount && opts.includeCursor && state.cursorWorld) {
    out.push(state.cursorWorld);
  }
  return out;
}

function perimeterPointAtDirection(center: Point2D, radius: number, target: Point2D): Point2D {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { x: center.x + radius, y: center.y };
  const inv = radius / len;
  return { x: center.x + dx * inv, y: center.y + dy * inv };
}

/**
 * Leader horizontal (|Δx|>|Δy|) reads the Y coordinate; vertical leader reads
 * the X coordinate. Matches AutoCAD DIMORDINATE / `ordinate-builder.ts` semantics.
 */
function deriveOrdinateAxis(feature: Point2D, leaderEnd: Point2D): 'x' | 'y' {
  const dx = Math.abs(leaderEnd.x - feature.x);
  const dy = Math.abs(leaderEnd.y - feature.y);
  return dx > dy ? 'y' : 'x';
}
