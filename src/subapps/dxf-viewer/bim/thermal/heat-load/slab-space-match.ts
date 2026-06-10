/**
 * ADR-422 L7.9-C — Αντιστοίχιση θερμικού χώρου → πλάκα (PURE geometry).
 *
 * Ο `space-boundary-resolver` χτίζει τα όρια **δαπέδου/οροφής** ενός χώρου από το
 * `geometry.area` του footprint του — **χωρίς** slab entity. Για να γίνει το `κ_m`
 * geometry-derived (L7.9-C) χρειάζεται να βρεθεί ποια **πλάκα** οριοθετεί τον χώρο
 * (από κάτω = δάπεδο, από πάνω = οροφή/στέγη) ώστε να διαβαστεί το `SlabDna` της.
 *
 * Mirror του `wall-footprint-match.ts` (footprint→τοίχοι) στον κατακόρυφο άξονα:
 * best-match με **footprint containment** — το ποσοστό των κορυφών του χώρου που
 * περικλείονται από το outline κάθε υποψήφιας πλάκας (`pointInPolygon`). Νικά το
 * μεγαλύτερο ποσοστό (≥ `MIN_CONTAINMENT_FRACTION`)· tie-break η **μικρότερη**
 * πλάκα (πιο ειδική — π.χ. μπαλκόνι πάνω από μεγάλη γενική πλάκα). Καμία πλάκα
 * εντός ορίου ⇒ `null` ⇒ ο caller δεν κάνει stamp ⇒ fallback κατηγορίας
 * (zero-regression).
 *
 * Μηδέν entity knowledge / store / persistence: ο caller (`useHeatLoadInputs`)
 * δίνει τις υποψήφιες ως `SlabMatchCandidate` (id + outline + dna + kind),
 * χωρισμένες ανά ρόλο (δάπεδο active ορόφου / οροφή-στέγη άνω ορόφου).
 *
 * @see ./wall-footprint-match — το οριζόντιο αδελφό pattern (footprint→τοίχοι)
 * @see ./space-boundary-resolver — consumer (stamp κ_m στα floor/roof boundaries)
 * @see ../../geometry/shared/polygon-utils — pointInPolygon / polygonArea (SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L7.9-C)
 */

import type { Point3D } from '../../types/bim-base';
import type { SlabDna } from '../../types/slab-dna-types';
import type { SlabKind } from '../../types/slab-types';
import { pointInPolygon, polygonArea } from '../../geometry/shared/polygon-utils';

/**
 * Ελάχιστο ποσοστό κορυφών του χώρου που πρέπει να περικλείονται από το outline
 * μιας πλάκας για να θεωρηθεί ότι την οριοθετεί. `0.5` = η πλειοψηφία (ανεκτικό σε
 * ελαφρές αποκλίσεις footprint/πλάκας). Documented, editable.
 */
export const MIN_CONTAINMENT_FRACTION = 0.5;

/** Υποψήφια πλάκα για αντιστοίχιση: outline (XY) + DNA + kind (από τον caller). */
export interface SlabMatchCandidate {
  readonly id: string;
  /** Outline της πλάκας (κλειστό πολύγωνο, world coords μονάδα σκηνής). */
  readonly outline: readonly Point3D[];
  /** Composite build-up — πηγή του `κ_m`. Absent ⇒ δεν θα δώσει stamp. */
  readonly dna?: SlabDna;
  /** Slab kind — καθορίζει interior-first ordering στο `computeSlabArealHeatCapacity`. */
  readonly kind: SlabKind;
}

/** Ποσοστό κορυφών του footprint που περικλείονται από το outline μιας πλάκας. */
function containmentFraction(
  footprint: readonly Point3D[],
  outline: readonly Point3D[],
): number {
  if (footprint.length === 0 || outline.length < 3) return 0;
  let inside = 0;
  for (const v of footprint) if (pointInPolygon(v, outline)) inside++;
  return inside / footprint.length;
}

/**
 * Η πλάκα που οριοθετεί τον χώρο (best containment) ή `null`. Νικά το μεγαλύτερο
 * ποσοστό περίκλεισης ≥ `MIN_CONTAINMENT_FRACTION`· tie-break (διαφορά < 1e-6) η
 * μικρότερη πλάκα (πιο ειδική). Pure, idempotent.
 */
export function findBestSlabMatch(
  footprint: readonly Point3D[],
  candidates: readonly SlabMatchCandidate[],
): SlabMatchCandidate | null {
  let best: SlabMatchCandidate | null = null;
  let bestFraction = MIN_CONTAINMENT_FRACTION;
  let bestArea = Infinity;
  for (const candidate of candidates) {
    const fraction = containmentFraction(footprint, candidate.outline);
    if (fraction < bestFraction) continue;
    const area = polygonArea(candidate.outline);
    const better = fraction > bestFraction + 1e-6 || (Math.abs(fraction - bestFraction) <= 1e-6 && area < bestArea);
    if (best === null || better) {
      best = candidate;
      bestFraction = fraction;
      bestArea = area;
    }
  }
  return best;
}
