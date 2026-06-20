/**
 * Entity footprint-overlap hit-test — pure SSoT (ADR-398 §ghost coloring).
 *
 * Γενίκευση του `findColumnOverlap` (`column-placement-snap-context`): «ποιο entity
 * (αυτού του τύπου) έχει polygon που περιέχει το σημείο». Ο caller δίνει έναν
 * `getPolygon` extractor — έτσι κολόνες (footprint) ΚΑΙ δοκάρια (outline) ΚΑΙ κάθε
 * άλλη οντότητα μοιράζονται τον ίδιο point-in-polygon έλεγχο, μηδέν διπλότυπο.
 *
 * Reuse `isPointInPolygon` (hit-test SSoT). Μονάδες: scene units (worldPos + polygons
 * ομοιόμορφα).
 *
 * @see ../columns/column-placement-snap-context.ts — findColumnOverlap (delegate)
 * @see ../beams/beam-beam-face-snap.ts — beam body-overlap (delegate)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';

/**
 * Το `id` της πρώτης οντότητας της οποίας το polygon (από τον `getPolygon`) περιέχει
 * τον `worldPos`· `null` αν καμία. Ο `getPolygon` επιστρέφει `null`/`undefined` για
 * οντότητες που δεν είναι του ζητούμενου τύπου (ταυτόχρονο φιλτράρισμα + extraction).
 */
export function findEntityOverlap(
  worldPos: Readonly<Point2D>,
  entities: readonly Entity[],
  getPolygon: (e: Entity) => readonly Point2D[] | null | undefined,
): string | null {
  for (const e of entities) {
    const verts = getPolygon(e);
    if (verts && verts.length >= 3 && isPointInPolygon(worldPos, verts as Point2D[])) {
      return e.id;
    }
  }
  return null;
}
