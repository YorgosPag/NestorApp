/**
 * ADR-911 · ADR-929 Δ21 (δ) βήμα 2 — πόσο κοντά φέρνει την όψη ο βοηθός «Μοντέλο από το σχέδιο» όταν ο άνθρωπος ζητά
 * «δείξε μου αυτό»: ένα στοιχείο της πρότασης, ή το κείμενο μιας γραμμής της λίστας «Τι διάβασα».
 *
 * 🔑 ADR-929 Δ21 (δ) Δ2 — το περιθώριο γύρω από **κείμενο** είναι **σχετικό** με το ύψος του, όχι σταθερά σε mm κτιρίου.
 *   Μετρημένο live (DOC014, αβαθμονόμητο σκίτσο σε μέγεθος χαρτιού): με 1500 mm το πρώτο άλμα **απομάκρυνε** την όψη
 *   (1:3.6 → 1:15) — το περιθώριο ήταν ~3 m γύρω από κείμενο λίγων εκατοστών. Το «zoom to selection» του Figma και το
 *   `ShowElements` του Revit πλαισιώνουν κατά το **μέγεθος του στόχου**· έτσι κι εδώ: ίδια εικόνα στην οθόνη είτε η σκηνή
 *   είναι σε mm κτιρίου (βαθμονομημένη: ~1,2 m σε κάτοψη 1:50, όσο περίπου πριν) είτε σε mm χαρτιού (σκίτσο).
 *
 * @see ../coordination/review-focus.ts (`reviewFocusExtent` — το ΕΝΑ SSoT εστίασης· εδώ ζει μόνο το «πόσο κοντά»)
 */

import type { Point2D } from '../../rendering/types/Types';
import { reviewFocusExtent, type ReviewFocusExtent } from '../coordination/review-focus';

/** Περιθώριο (mm) γύρω από στοιχείο της πρότασης: αρκεί για να φαίνονται οι γειτονικές γραμμές. */
export const ASSISTANT_FOCUS_PAD_MM = 1500;

/**
 * Περιθώριο γύρω από κείμενο, σε **ύψη του κειμένου**: το κείμενο πιάνει ~1/21 του ύψους της όψης — ευανάγνωστο, με τη
 * γραμμή διάστασης και τις γειτονικές παρειές του γύρω του.
 */
export const READ_VALUE_FOCUS_PAD_TEXT_HEIGHTS = 10;

/** Η μικρότερη πλευρά του δακτυλίου του κειμένου στη σκηνή = το ύψος του (ανεξάρτητα από στροφή της τοποθέτησης). */
function textHeightOf(ring: readonly Point2D[]): number {
  let shortest = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const side = Math.hypot(b.x - a.x, b.y - a.y);
    if (side > 0 && side < shortest) shortest = side;
  }
  return shortest;
}

/**
 * Το πλαίσιο εστίασης για το κείμενο μιας γραμμής «Τι διάβασα» (`sceneTextRing`). `null` = δακτύλιος χωρίς μετρήσιμο ύψος
 * (κενός, εκφυλισμένος ή μη πεπερασμένος): ο καλών **δεν** κινεί την όψη — κανένα σιωπηλό άλμα σε αυθαίρετο σημείο.
 */
export function readValueFocusExtent(ring: readonly Point2D[]): ReviewFocusExtent | null {
  const height = textHeightOf(ring);
  if (!Number.isFinite(height)) return null;
  return reviewFocusExtent(ring, height * READ_VALUE_FOCUS_PAD_TEXT_HEIGHTS);
}
