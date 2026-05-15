/**
 * ADR-353 C1 — Arc-length sampler dispatcher SSoT.
 *
 * Analytical strategies for Phase C1: LINE, POLYLINE, LWPOLYLINE, ARC, CIRCLE.
 * Numerical strategies (ELLIPSE, SPLINE) added in Phase C2.
 *
 * Strategy pattern: each entity type lives in its own file under
 * path-sampler-strategies/. Add new strategies without touching this file.
 */

import type { Entity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { LineStrategy } from './path-sampler-strategies/line-strategy';
import { PolylineStrategy } from './path-sampler-strategies/polyline-strategy';
import { ArcStrategy } from './path-sampler-strategies/arc-strategy';
import { CircleStrategy } from './path-sampler-strategies/circle-strategy';
import { EllipseStrategy } from './path-sampler-strategies/ellipse-strategy';
import { SplineStrategy } from './path-sampler-strategies/spline-strategy';

/** Position + tangent direction at a sampled arc-length parameter u ∈ [0,1]. */
export interface PathSample {
  readonly position: Point2D;
  /** Tangent direction in degrees (CCW from +X). Used by alignItems rotation. */
  readonly tangentDeg: number;
}

/**
 * Strategy interface for sampling a specific entity type along its arc length.
 * T is bivariant (method shorthand) — safe to store in PathSamplerStrategy<Entity>[].
 */
export interface PathSamplerStrategy<T extends Entity = Entity> {
  /** True if this strategy handles the given entity. */
  matches(entity: Entity): entity is T;
  /** Total arc length of the entity (independent of traversal direction). */
  totalLength(entity: T): number;
  /**
   * Sample at normalized arc-length u ∈ [0,1].
   * u=0 → start, u=1 → end. Values outside [0,1] are clamped.
   * reversed=true traverses the path from end → start.
   */
  sample(entity: T, u: number, reversed: boolean): PathSample;
}

const STRATEGIES: ReadonlyArray<PathSamplerStrategy> = [
  new LineStrategy(),
  new PolylineStrategy(),
  new ArcStrategy(),
  new CircleStrategy(),
  new EllipseStrategy(),
  new SplineStrategy(),
];

/** Return the strategy for the entity, or null if unsupported. */
export function getPathSamplerStrategy(entity: Entity): PathSamplerStrategy | null {
  for (const s of STRATEGIES) {
    if (s.matches(entity)) return s;
  }
  return null;
}

/** True if the entity is a supported path type (C1+C2: LINE/POLYLINE/LWPOLYLINE/ARC/CIRCLE/ELLIPSE/SPLINE). */
export function isPathEntity(entity: Entity): boolean {
  return getPathSamplerStrategy(entity) !== null;
}

/** Total arc length of the entity via the matching strategy. Returns 0 if unsupported. */
export function pathTotalLength(entity: Entity): number {
  const s = getPathSamplerStrategy(entity);
  if (!s) return 0;
  return s.totalLength(entity as never);
}

/**
 * Sample the entity at normalized arc-length u via the matching strategy.
 * Returns null if the entity type is unsupported.
 */
export function samplePath(entity: Entity, u: number, reversed = false): PathSample | null {
  const s = getPathSamplerStrategy(entity);
  if (!s) return null;
  return s.sample(entity as never, u, reversed);
}
