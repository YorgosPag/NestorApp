/**
 * Shared round (circular) cross-section profile — SSoT (ADR-408 Φ8).
 *
 * Sibling of `i-shape-profile.ts`. Builds the N-gon approximation of a circular
 * section so BOTH the 2D plan glyph AND the 3D swept solid (round duct / pipe)
 * use ONE profile source — mirroring how the I-shape profile feeds both the
 * column footprint and the beam sweep.
 *
 * Dimensions in mm; `scale` (canvas-units-per-mm OR `MM_TO_M`) maps to the output
 * space, exactly like {@link buildIShapeProfile}.
 *
 * @see ./i-shape-profile.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 */

import type { Point3D } from '../../types/bim-base';

/** Polygon segment count for a circular section (smooth at typical zoom). */
export const ROUND_PROFILE_SEGMENTS = 32;

/**
 * Circular section as a closed CCW N-gon, centred on the origin (math Y-up).
 * `diameter` in mm; `s` scales to the output space (canvas units or metres).
 */
export function buildRoundProfile(
  diameter: number,
  s: number,
  segments: number = ROUND_PROFILE_SEGMENTS,
): Point3D[] {
  const r = (Math.max(0, diameter) * s) / 2;
  const n = Math.max(3, segments);
  const verts: Point3D[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    verts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z: 0 });
  }
  return verts;
}

/**
 * Outer cross-section area of a round section (mm²) = π·r². Degenerate → 0.
 */
export function roundCrossSectionAreaMm2(diameter: number): number {
  const r = Math.max(0, diameter) / 2;
  return Math.PI * r * r;
}

/**
 * Annular (material) cross-section area of a hollow round section (mm²) =
 * π·(r² − ri²). Used for pipe material BOQ when `wallThickness` is known.
 * Falls back to the solid area when the wall is absent/degenerate.
 */
export function annulusCrossSectionAreaMm2(diameter: number, wallThickness?: number): number {
  const r = Math.max(0, diameter) / 2;
  if (wallThickness && wallThickness > 0 && wallThickness < r) {
    const ri = r - wallThickness;
    return Math.PI * (r * r - ri * ri);
  }
  return Math.PI * r * r;
}

/** Outer perimeter of a round section (mm) = π·d. */
export function roundPerimeterMm(diameter: number): number {
  return Math.PI * Math.max(0, diameter);
}

/** Perimeter of a rectangular section (mm) = 2·(w + h). */
export function rectPerimeterMm(widthMm: number, heightMm: number): number {
  return 2 * (Math.max(0, widthMm) + Math.max(0, heightMm));
}
