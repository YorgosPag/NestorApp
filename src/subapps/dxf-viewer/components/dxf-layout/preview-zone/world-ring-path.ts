/**
 * world-ring-path — «δακτύλιος σε συντεταγμένες κόσμου → SVG path οθόνης» (ADR-911 Φ3β).
 *
 * Η ίδια μετατροπή ζούσε αυτούσια σε τρία overlays (`AutoAreaPreviewOverlay`,
 * `RegionPerimeterPreviewOverlay`, `TopoAutoBreaklinePreviewOverlay`) και θα γινόταν τέσσερα.
 * Η προβολή περνά ΠΑΝΤΑ από το `CoordinateTransforms.worldToScreen` — ο τύπος δεν ξαναγράφεται
 * εδώ (ADR-040: η χειρόγραφη εκδοχή έχει ήδη αντιστρέψει μία φορά τον Y).
 *
 * ΚΑΘΑΡΟ (pure) — zero React/DOM/store.
 */

import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import type { Point2D, ViewTransform, Viewport } from '../../../rendering/types/Types';

/** Οι κορυφές ενός δακτυλίου κόσμου, σε pixels οθόνης. */
export function worldRingToScreen(
  ring: readonly Point2D[],
  transform: ViewTransform,
  viewport: Viewport,
): Point2D[] {
  return ring.map((p) => CoordinateTransforms.worldToScreen({ x: p.x, y: p.y }, transform, viewport));
}

/** SVG path (`M…L…`) από σημεία ΟΘΟΝΗΣ, με ένα δεκαδικό. `closed` ⇒ κλείνει με `Z`. */
export function screenPointsToSvgPath(points: readonly Point2D[], closed: boolean): string {
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return closed ? `${d} Z` : d;
}

/** Δακτύλιος κόσμου → SVG path οθόνης. */
export function worldRingToSvgPath(
  ring: readonly Point2D[],
  transform: ViewTransform,
  viewport: Viewport,
  closed = true,
): string {
  return screenPointsToSvgPath(worldRingToScreen(ring, transform, viewport), closed);
}

/** Ο μέσος όρος των κορυφών (σημείο αγκύρωσης ετικέτας). Κενή είσοδος ⇒ αρχή των αξόνων. */
export function pointsCentroid(points: readonly Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };
  return points.reduce(
    (acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length }),
    { x: 0, y: 0 },
  );
}
