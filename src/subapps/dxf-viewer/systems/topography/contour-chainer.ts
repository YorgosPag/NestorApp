/**
 * ADR-650 Milestone 1 — contour chainer.
 *
 * Marching-triangles emits loose segments (one per triangle×level). This stitches them,
 * per level, into continuous polylines: interior contours close into rings, contours that
 * reach the TIN hull stay open. Adjacent triangles share an edge, so the crossing point is
 * computed identically from both sides → endpoints match exactly; a micrometre-grid key
 * absorbs any residual float noise.
 *
 * The WALK itself is not ours: it is the shared `chainUndirectedEdges` SSoT (M8β/Γ chains the
 * steep TIN folds with the very same code). This module owns only what is contour-specific —
 * the coordinate cell key, the per-level grouping and the major/minor classification.
 * Contours keep walking THROUGH a junction (the historical M1 behaviour: a saddle level that
 * touches itself is one contour, not a fork), so no `stopAtJunction` here.
 *
 * Output is WORLD canonical mm (LOCAL segment coords + `origin`), plus the major/minor
 * classification the entity layer needs. Complexity is ~O(segments) per level.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ContourSegment, ContourLine, LocalOrigin } from './topo-types';
import type { ContourConfig } from './contour-config';
import { localToWorld } from './topo-local-origin';
import { chainUndirectedEdges } from './graph-chain';

/** Micrometre-grid node key so shared segment endpoints coincide. */
function nodeKey(p: Point2D): string {
  return `${Math.round(p.x * 1000)}:${Math.round(p.y * 1000)}`;
}

/** Chain one level's segments: open chains (from degree-1 nodes) first, then cycles. */
function chainLevel(
  segments: readonly ContourSegment[], level: number, isMajor: boolean, origin: LocalOrigin,
): ContourLine[] {
  const point = new Map<string, Point2D>();
  const edges: [string, string][] = [];
  for (const s of segments) {
    const ka = nodeKey(s.a); const kb = nodeKey(s.b);
    if (ka === kb) continue;
    point.set(ka, s.a); point.set(kb, s.b);
    edges.push([ka, kb]);
  }

  return chainUndirectedEdges(edges).map(({ nodes, closed }) => ({
    level,
    isMajor,
    closed,
    vertices: nodes.map((k) => localToWorld(point.get(k)!, origin)),
  }));
}

/** True when `level` is an index (major) contour. */
function isMajorLevel(level: number, config: ContourConfig): boolean {
  if (config.majorEvery <= 1) return true;
  const k = Math.round((level - config.baseElevationMm) / config.intervalMm);
  return ((k % config.majorEvery) + config.majorEvery) % config.majorEvery === 0;
}

/**
 * Chain ALL segments into WORLD-coordinate contour lines, grouped + classified by level.
 */
export function chainContours(
  segments: readonly ContourSegment[], config: ContourConfig, origin: LocalOrigin,
): ContourLine[] {
  const byLevel = new Map<number, ContourSegment[]>();
  for (const s of segments) (byLevel.get(s.level) ?? byLevel.set(s.level, []).get(s.level)!).push(s);

  const lines: ContourLine[] = [];
  for (const [level, segs] of byLevel) {
    lines.push(...chainLevel(segs, level, isMajorLevel(level, config), origin));
  }
  return lines;
}
