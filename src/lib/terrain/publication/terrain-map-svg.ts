/**
 * ADR-920 Β4.8 — the ONE place the snapshot frame becomes SVG user space for the 2D terrain map.
 *
 * The snapshot is north-up with y NORTH (metres from the surface centre); SVG has y DOWN. So `svgY = −y`, and nothing
 * else in the map flips an axis. One SVG unit = one metre: lengths on the map (scale bar, label sizes) are metres too.
 * Every number written into a path is rounded to the published precision (centimetres) — the map never shows a
 * precision the snapshot does not carry, and the same snapshot always gives the same bytes.
 *
 * @module lib/terrain/publication/terrain-map-svg
 */

import { roundPublished } from './listing-terrain-frame';

/** A point in SVG user space (metres, y down). */
export interface SvgPoint {
  readonly x: number;
  readonly y: number;
}

/** Snapshot frame (y north) → SVG user space (y down), rounded. */
export function svgPointOf(x: number, yNorth: number): SvgPoint {
  return { x: roundPublished(x), y: roundPublished(-yNorth) };
}

/** Vertex `index` of the flat mesh positions `[x, y, z, …]`, in SVG user space. */
export function meshSvgPoint(positions: readonly number[], index: number): SvgPoint {
  return svgPointOf(positions[3 * index], positions[3 * index + 1]);
}

/** Flat `[x, y, x, y, …]` in the snapshot frame → SVG points. */
export function flatSvgPoints(flat: readonly number[]): SvgPoint[] {
  const out: SvgPoint[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push(svgPointOf(flat[i], flat[i + 1]));
  return out;
}

/** One polyline as path data; `closed` adds `Z`. Fewer than two points draws nothing. */
export function polylinePathData(points: readonly SvgPoint[], closed: boolean): string {
  if (points.length < 2) return '';
  const body = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  return closed ? `${body} Z` : body;
}

/** Several polylines as ONE path data string — one SVG element instead of one per line. */
export function joinPathData(parts: readonly string[]): string {
  return parts.filter((part) => part.length > 0).join(' ');
}
