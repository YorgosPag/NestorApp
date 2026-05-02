/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Pure 2D polygon geometry helpers for ΝΟΚ engines.
 * Stateless, no React, no DOM. Coordinates are local XZ in metres.
 */

/** Greek corner letters used to label polygon edges (Α→Β, Β→Γ, ...). */
export const POLY_CORNER_LETTERS = [
  'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ',
] as const;

/** Returns an edge label like "Α→Β" for a polygon edge between vertices i and i+1. */
export function polyEdgeLabel(i: number, n: number): string {
  const a = POLY_CORNER_LETTERS[i % POLY_CORNER_LETTERS.length] ?? String(i);
  const b =
    POLY_CORNER_LETTERS[((i + 1) % Math.max(n, 1)) % POLY_CORNER_LETTERS.length] ??
    String(i + 1);
  return `${a}→${b}`;
}

/** Computes the area of a polygon using the shoelace formula (m²). */
export function shoelaceArea(
  verts: ReadonlyArray<readonly [number, number]>,
): number {
  let sum = 0;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = verts[i]!;
    const [x1, y1] = verts[(i + 1) % n]!;
    sum += x0 * y1 - x1 * y0;
  }
  return Math.abs(sum / 2);
}

/**
 * Inward-pointing unit normal for the edge AB given a polygon centroid C.
 * Picks whichever of the two perpendicular candidates lies closer to C.
 */
export function inwardNormal(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
): [number, number] {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  const n1: [number, number] = [-dz / len, dx / len];
  const n2: [number, number] = [dz / len, -dx / len];
  const mx = (ax + bx) / 2;
  const mz = (az + bz) / 2;
  const d1Sq = (mx + n1[0] - cx) ** 2 + (mz + n1[1] - cz) ** 2;
  const d2Sq = (mx + n2[0] - cx) ** 2 + (mz + n2[1] - cz) ** 2;
  return d1Sq < d2Sq ? n1 : n2;
}
