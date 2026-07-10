/**
 * ADR-632 — Καθαρός υπολογισμός headroom ανά σκαλοπάτι + εύρεση της παραβατικής
 * ζώνης (σκαλοπάτια που «καπακώνονται» από την υπερκείμενη πλάκα κάτω από το
 * ελάχιστο ελεύθερο ύψος → χρειάζονται τρύπα).
 *
 * Pure + unit-agnostic: ΟΛΑ τα z σε mm — ο engine (Phase 2/3) κάνει τη
 * μετατροπή scene-units → mm ΜΙΑ φορά (ADR-358 §9.2 Q22) και τροφοδοτεί τα
 * resolved z. Καμία εξάρτηση από scene / entities.
 */

export interface TreadNosingZ {
  readonly treadIndex: number;
  /** Ύψος μύτης σκαλοπατιού σε mm (absolute). */
  readonly zMm: number;
}

export interface HeadroomEvaluation {
  /** Tread indices όπου `clearance < minHeadroomMm` (ανάγκη τρύπας). */
  readonly violatingTreadIndices: readonly number[];
  /** Πιο κρίσιμο (μικρότερο) clearance σε mm· `+Infinity` αν καμία μύτη. */
  readonly minClearanceMm: number;
  readonly anyViolation: boolean;
}

/**
 * Για κάθε μύτη: `clearance = slabUndersideZmm − nosingZmm`. Παραβατικό όταν
 * `clearance < minHeadroomMm` (αυστηρή ανισότητα — clearance ακριβώς ίσο με το
 * ελάχιστο επιτρέπεται).
 *
 * @param nosings          per-tread nosing z (mm).
 * @param slabUndersideZmm κάτω παρειά υπερκείμενης πλάκας (mm) = top-face −
 *                         thickness.
 * @param minHeadroomMm    κατώφλι (mm), βλ. `resolveMinHeadroomMm`.
 */
export function evaluateStairHeadroom(
  nosings: readonly TreadNosingZ[],
  slabUndersideZmm: number,
  minHeadroomMm: number,
): HeadroomEvaluation {
  const violating: number[] = [];
  let minClearance = Infinity;
  for (const n of nosings) {
    const clearance = slabUndersideZmm - n.zMm;
    if (clearance < minClearance) minClearance = clearance;
    if (clearance < minHeadroomMm) violating.push(n.treadIndex);
  }
  return {
    violatingTreadIndices: violating,
    minClearanceMm: minClearance,
    anyViolation: violating.length > 0,
  };
}

/**
 * Επεκτείνει τη λίστα παραβατικών σκαλοπατιών κατά `marginTreads` προς τα κάτω
 * (χαμηλότερα indices) ως περιθώριο ασφαλείας (IBC one-tread-depth beyond). Η
 * παραβατική ζώνη είναι πάντα το πάνω τμήμα της σκάλας (μονότονο z), άρα το
 * περιθώριο προστίθεται κάτω από το boundary. Επιστρέφει ταξινομημένο, χωρίς
 * διπλότυπα, clamped στο `[0, totalTreads)`.
 */
export function expandViolatingRange(
  violatingTreadIndices: readonly number[],
  marginTreads: number,
  totalTreads: number,
): number[] {
  if (violatingTreadIndices.length === 0) return [];
  const set = new Set<number>(violatingTreadIndices);
  const minIdx = Math.min(...violatingTreadIndices);
  for (let k = 1; k <= marginTreads; k++) {
    set.add(minIdx - k);
  }
  return [...set].filter((i) => i >= 0 && i < totalTreads).sort((a, b) => a - b);
}
