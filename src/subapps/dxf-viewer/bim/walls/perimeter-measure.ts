/**
 * ADR-419 — Pure perimeter measurement helpers (N.7.1 file-size split).
 *
 * Εξήχθησαν από `./perimeter-from-faces.ts` (αυτοτελής ομάδα: bbox / χαρακτηριστικό
 * πάχος μέλους / extent σε mm / size-sanity guard). Καθαρή γεωμετρία — μηδέν scene
 * extraction, μηδέν cache. Ο τύπος `ClosedPerimeter` εισάγεται type-only ώστε να
 * ΜΗΝ υπάρχει runtime circular dependency με το `perimeter-from-faces`.
 *
 * Re-export-άρονται από το `./perimeter-from-faces` για backward-compat του public API.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6
 * @see ./perimeter-from-faces.ts (scene extraction + region-pick SSoT)
 */

import type { Point2D } from '../../rendering/types/Types';
import { REGION_PERIMETER_LIMITS } from '../../config/tolerance-config';
import type { ClosedPerimeter } from './perimeter-from-faces';

/** Axis-aligned bbox min/max ενός πολυγώνου (world/scene units). */
function bboxExtent(poly: readonly Point2D[]): { width: number; height: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { width: maxX - minX, height: maxY - minY };
}

/**
 * Χαρακτηριστικό «πάχος» (μικρή πλευρά) ενός περιγράμματος σε mm (Layer 4). Για
 * ορθογώνια/αποσυντιθέμενα σχήματα = το **παχύτερο σκέλος** (max `shortSide`):
 * ένα πραγματικό Γ/Τ/Π τοιχίο έχει λεπτά σκέλη, ενώ το εξωτερικό περίγραμμα του
 * σχεδίου αποσυντίθεται σε «σκέλη» τεράστιου πάχους. Για καθαρά composite (γωνίες
 * ≠ 90°, χωρίς rects) fallback στη μικρή διάσταση του bbox.
 *
 * @param scale mmToSceneUnits(sceneUnits) — world units ανά mm.
 */
export function perimeterMemberThicknessMm(perimeter: ClosedPerimeter, scale: number): number {
  const s = scale > 0 ? scale : 1;
  if (perimeter.rects.length > 0) {
    const maxShort = Math.max(...perimeter.rects.map((r) => r.shortSide));
    return maxShort / s;
  }
  const { width, height } = bboxExtent(perimeter.polygon);
  return Math.min(width, height) / s;
}

/**
 * Διαστάσεις bbox ενός περιγράμματος σε mm (για toast/preview labels). `scale` =
 * mmToSceneUnits(sceneUnits) — world units ανά mm.
 */
export function perimeterExtentMm(
  perimeter: ClosedPerimeter,
  scale: number,
): { width: number; height: number } {
  const s = scale > 0 ? scale : 1;
  const { width, height } = bboxExtent(perimeter.polygon);
  return { width: width / s, height: height / s };
}

/**
 * Layer 4 — size sanity guard: `true` αν το περίγραμμα ξεπερνά το λογικό «πάχος»
 * δομικού μέλους (`MAX_MEMBER_THICKNESS_MM`). Πιάνει το εξωτερικό περίγραμμα του
 * σχεδίου που περνούσε για κολώνα (το bug). Ελέγχει ΜΟΝΟ τη μικρή πλευρά.
 */
export function isPerimeterOversized(
  perimeter: ClosedPerimeter,
  scale: number,
  maxMm: number = REGION_PERIMETER_LIMITS.MAX_MEMBER_THICKNESS_MM,
): boolean {
  return perimeterMemberThicknessMm(perimeter, scale) > maxMm;
}
