/**
 * ADR-632 — Υπολογισμός περιγράμματος τρύπας κλιμακοστασίου.
 *
 * Ένωση (`safeUnion`) των οριζόντιων προβολών των παραβατικών σκαλοπατιών,
 * κομμένη (`safeIntersection`) στο περίγραμμα της υπερκείμενης πλάκας → το
 * outline του auto slab-opening (kind `'well'`). Ακολουθεί ΑΚΡΙΒΩΣ το σχήμα της
 * σκάλας (απόφαση Giorgio: exact projection, όχι bbox).
 *
 * Pure. x/y στις μονάδες των inputs — σκάλα & πλάκα μοιράζονται τη σκηνή, άρα
 * ίδιες μονάδες· ο engine εγγυάται τη συνέπεια. `safeUnion`/`safeIntersection`
 * είναι precision-robust σε m/cm/mm scenes (ADR-396).
 */

import type { MultiPolygon, Pair, Polygon } from 'polygon-clipping';
import type { Point3D, Polygon3D } from '../../types/bim-base';
import { safeIntersection, safeUnion } from '../shared/safe-polygon-boolean';
import { polygon3dToClipPolygon, polygonArea } from '../shared/polygon-utils';

export interface StairwellOutlineResult {
  readonly outline: Polygon3D;
  /** Εμβαδόν τρύπας στις μονάδες² των inputs (unsigned). */
  readonly area: number;
}

/**
 * @param treads      παραβατικά (+margin) tread polygons — προβάλλονται στο xy.
 * @param slabOutline περίγραμμα υπερκείμενης πλάκας (ίδιες μονάδες).
 * @param outlineZ    z που παίρνουν οι κορυφές του outline (π.χ. slab top-face).
 * @returns `null` όταν η τομή είναι κενή (η προβολή δεν πέφτει πάνω στην πλάκα)
 *          ή δεν υπάρχουν έγκυρα σκαλοπάτια.
 */
export function computeStairwellOpeningOutline(
  treads: readonly Polygon3D[],
  slabOutline: Polygon3D,
  outlineZ: number,
): StairwellOutlineResult | null {
  const treadGeoms = treads
    .map(polygon3dToClipPolygon)
    .filter((g): g is Polygon => g !== null);
  if (treadGeoms.length === 0) return null;

  const slabGeom = polygon3dToClipPolygon(slabOutline);
  if (!slabGeom) return null;

  const union = safeUnion(treadGeoms[0], ...treadGeoms.slice(1));
  if (union.length === 0) return null;

  const clipped = safeIntersection(union, slabGeom);
  if (clipped.length === 0) return null;

  const outline = largestOuterRing(clipped, outlineZ);
  if (!outline) return null;

  return { outline, area: polygonArea(outline.vertices) };
}

/** Μεγαλύτερο (κατά εμβαδόν) outer ring μιας MultiPolygon → `Polygon3D` στο z. */
function largestOuterRing(mp: MultiPolygon, z: number): Polygon3D | null {
  let best: readonly Pair[] | null = null;
  let bestArea = 0;
  for (const polygon of mp) {
    const outer = polygon[0];
    if (!outer || outer.length < 3) continue;
    const area = polygonArea(outer.map((pr) => ({ x: pr[0], y: pr[1], z: 0 })));
    if (area > bestArea) {
      bestArea = area;
      best = outer;
    }
  }
  if (!best) return null;
  return { vertices: best.map((pr): Point3D => ({ x: pr[0], y: pr[1], z })) };
}
