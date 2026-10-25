/**
 * ADR-920 Β4.8 Τ — geometry checks shared by the TIN builder suites (characterization + breakline resolution).
 * Test-only; plain arithmetic on LOCAL positions, independent of the triangulator under test.
 */

import type { TinSurface, TopoPoint } from '../terrain-types';

export type Pt = readonly [number, number];

export function cross(a: Pt, b: Pt, c: Pt): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

export function triangleArea(tin: TinSurface): number {
  let sum = 0;
  for (const [i, j, k] of tin.triangles) sum += cross(tin.positions[i], tin.positions[j], tin.positions[k]) / 2;
  return sum;
}

/** Shoelace area of a CCW polygon given in LOCAL coordinates. */
export function polygonArea(ring: readonly Pt[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export function edgeKeys(tin: TinSurface): Set<string> {
  const keys = new Set<string>();
  for (const [a, b, c] of tin.triangles) {
    for (const [u, v] of [[a, b], [b, c], [c, a]] as const) keys.add(u < v ? `${u}-${v}` : `${v}-${u}`);
  }
  return keys;
}

export function indexOf(tin: TinSurface, x: number, y: number): number {
  const index = tin.positions.findIndex(([px, py]) => px === x && py === y);
  if (index < 0) throw new Error(`no vertex at ${x},${y}`);
  return index;
}

export function hasEdge(tin: TinSurface, from: Pt, to: Pt): boolean {
  const a = indexOf(tin, from[0], from[1]);
  const b = indexOf(tin, to[0], to[1]);
  return edgeKeys(tin).has(a < b ? `${a}-${b}` : `${b}-${a}`);
}

/** No vertex strictly inside any triangle's circumcircle (cocircular = allowed). */
export function isDelaunay(tin: TinSurface): boolean {
  return tin.triangles.every(([i, j, k]) => {
    const [a, b, c] = [tin.positions[i], tin.positions[j], tin.positions[k]];
    return tin.positions.every((d, n) => {
      if (n === i || n === j || n === k) return true;
      const [adx, ady] = [a[0] - d[0], a[1] - d[1]];
      const [bdx, bdy] = [b[0] - d[0], b[1] - d[1]];
      const [cdx, cdy] = [c[0] - d[0], c[1] - d[1]];
      const det =
        (adx * adx + ady * ady) * (bdx * cdy - cdx * bdy) -
        (bdx * bdx + bdy * bdy) * (adx * cdy - cdx * ady) +
        (cdx * cdx + cdy * cdy) * (adx * bdy - bdx * ady);
      return det <= 0;
    });
  });
}

/** Deterministic jitter (no Math.random): a regular grid nudged so no four points are cocircular. */
export function jitteredGrid(cols: number, rows: number, step: number): TopoPoint[] {
  const points: TopoPoint[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const jx = ((c * 7919 + r * 104729) % 97) - 48;
      const jy = ((c * 15485863 + r * 32452843) % 89) - 44;
      points.push({ x: c * step + jx, y: r * step + jy, z: 100 + c + r * 2 });
    }
  }
  return points;
}
