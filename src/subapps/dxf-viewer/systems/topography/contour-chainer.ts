/**
 * ADR-650 Milestone 1 — contour chainer.
 *
 * Marching-triangles emits loose segments (one per triangle×level). This stitches them,
 * per level, into continuous polylines: interior contours close into rings, contours that
 * reach the TIN hull stay open. Adjacent triangles share an edge, so the crossing point is
 * computed identically from both sides → endpoints match exactly; a micrometre-grid key
 * absorbs any residual float noise.
 *
 * Output is WORLD canonical mm (LOCAL segment coords + `origin`), plus the major/minor
 * classification the entity layer needs. Complexity is ~O(segments) per level.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ContourSegment, ContourLine, LocalOrigin } from './topo-types';
import type { ContourConfig } from './contour-config';
import { localToWorld } from './topo-local-origin';

/** Micrometre-grid node key so shared segment endpoints coincide. */
function nodeKey(p: Point2D): string {
  return `${Math.round(p.x * 1000)}:${Math.round(p.y * 1000)}`;
}

/** Undirected graph of a single level's segments. */
interface LevelGraph {
  readonly point: Map<string, Point2D>;
  readonly adj: Map<string, string[]>;
  readonly used: Set<string>;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function buildGraph(segments: readonly ContourSegment[]): LevelGraph {
  const point = new Map<string, Point2D>();
  const adj = new Map<string, string[]>();
  for (const s of segments) {
    const ka = nodeKey(s.a), kb = nodeKey(s.b);
    if (ka === kb) continue;
    point.set(ka, s.a); point.set(kb, s.b);
    (adj.get(ka) ?? adj.set(ka, []).get(ka)!).push(kb);
    (adj.get(kb) ?? adj.set(kb, []).get(kb)!).push(ka);
  }
  return { point, adj, used: new Set() };
}

/** Walk an unused-edge path from `start`, consuming edges as it goes. */
function walkPath(g: LevelGraph, start: string): string[] {
  const path = [start];
  let current = start;
  for (;;) {
    const neighbors = g.adj.get(current) ?? [];
    const next = neighbors.find((n) => !g.used.has(edgeKey(current, n)));
    if (next === undefined) break;
    g.used.add(edgeKey(current, next));
    path.push(next);
    current = next;
  }
  return path;
}

/** Turn a walked key-path into a WORLD-coordinate contour line. */
function pathToLine(
  g: LevelGraph, path: string[], level: number, isMajor: boolean, origin: LocalOrigin,
): ContourLine {
  const vertices = path.map((k) => localToWorld(g.point.get(k)!, origin));
  const closed = path.length > 2 && path[0] === path[path.length - 1];
  return { level, isMajor, closed, vertices };
}

/** Chain one level's segments: open chains (from degree-1 nodes) first, then cycles. */
function chainLevel(
  segments: readonly ContourSegment[], level: number, isMajor: boolean, origin: LocalOrigin,
): ContourLine[] {
  const g = buildGraph(segments);
  const lines: ContourLine[] = [];
  const starts = [...g.adj.keys()].sort(
    (a, b) => (g.adj.get(a)!.length) - (g.adj.get(b)!.length),
  );
  for (const start of starts) {
    let hasUnused = (g.adj.get(start) ?? []).some((n) => !g.used.has(edgeKey(start, n)));
    while (hasUnused) {
      const path = walkPath(g, start);
      if (path.length >= 2) lines.push(pathToLine(g, path, level, isMajor, origin));
      hasUnused = (g.adj.get(start) ?? []).some((n) => !g.used.has(edgeKey(start, n)));
    }
  }
  return lines;
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
