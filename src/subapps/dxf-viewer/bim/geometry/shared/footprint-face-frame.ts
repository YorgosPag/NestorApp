/**
 * Footprint face-frame — pure geometry SSoT (N.0.2) για face-snap πάνω σε **world-aligned
 * ορθογώνιο footprint** (κολόνα-στόχος ή bbox μέλους).
 *
 * ΕΝΑ σημείο αλήθειας για τα 3 primitives που χρειάζονται ΚΑΙ το «δοκάρι/τοίχος → κολόνα»
 * face-snap (`bim/framing/member-column-face-snap`) ΚΑΙ το «κολόνα → παρειά» face-snap
 * (`bim/columns/column-face-snap`):
 *   1. `footprintBounds`            — world-aligned extents πολυγώνου (X+Y) μέσω `projectPolygonOnAxis`.
 *   2. `distanceToFootprintBounds`  — απόσταση σημείου από (clamped) bbox (0 όταν εντός).
 *   3. `pickDominantFace`           — κανονικοποιημένη θέση cursor → κυρίαρχη παρειά (E/W/N/S).
 *
 * Πριν την εξαγωγή η ίδια λογική ήταν **διπλή** (private `columnBounds`/`distanceToBounds` +
 * inline ex/ey στο `member-column-face-snap` ΚΑΙ ξανά στο `column-face-snap`). Εδώ ζει ΜΙΑ φορά.
 *
 * Pure — zero React/DOM/store. Reuse `projectPolygonOnAxis` (polygon-vs-axis SSoT). Μονάδες:
 * scene units (vertices world-baked).
 *
 * @see ./polygon-axis-projection.ts — projectPolygonOnAxis (SSoT)
 * @see ../../framing/member-column-face-snap.ts — consumer (δοκάρι/τοίχος → κολόνα)
 * @see ../../columns/column-face-snap.ts — consumer (κολόνα → παρειά)
 */

import type { Point2D } from '../../../rendering/types/Types';
import { projectPolygonOnAxis } from './polygon-axis-projection';

/** World-aligned extents ενός ορθογωνίου footprint. */
export interface FootprintBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** Κυρίαρχη παρειά footprint (world-aligned). */
export type FootprintFace = 'E' | 'W' | 'N' | 'S';

/** World-aligned extents πολυγώνου μέσω του `projectPolygonOnAxis` SSoT (X + Y άξονες). */
export function footprintBounds(
  verts: readonly { readonly x: number; readonly y: number }[],
): FootprintBounds | null {
  if (verts.length < 3) return null;
  const xp = projectPolygonOnAxis(verts, 0, 0, 1, 0); // along = v.x
  const yp = projectPolygonOnAxis(verts, 0, 0, 0, 1); // along = v.y
  return { minX: xp.alongMin, maxX: xp.alongMax, minY: yp.alongMin, maxY: yp.alongMax };
}

/** Απόσταση σημείου από (clamped) bbox — 0 όταν εντός. */
export function distanceToFootprintBounds(c: Readonly<Point2D>, b: FootprintBounds): number {
  const dx = Math.max(b.minX - c.x, 0, c.x - b.maxX);
  const dy = Math.max(b.minY - c.y, 0, c.y - b.maxY);
  return Math.hypot(dx, dy);
}

/** Κανονικοποιημένη θέση cursor → κυρίαρχος άξονας → πλευρά (E/W αν |ex|≥|ey|, αλλιώς N/S). */
export function pickDominantFace(c: Readonly<Point2D>, b: FootprintBounds): FootprintFace {
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const halfX = (b.maxX - b.minX) / 2;
  const halfY = (b.maxY - b.minY) / 2;
  const ex = halfX > 0 ? (c.x - cx) / halfX : 0;
  const ey = halfY > 0 ? (c.y - cy) / halfY : 0;
  return Math.abs(ex) >= Math.abs(ey) ? (ex >= 0 ? 'E' : 'W') : ey >= 0 ? 'N' : 'S';
}
