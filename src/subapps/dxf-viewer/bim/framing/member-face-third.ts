/**
 * Linear-member ghost anchor-third — pure leaf SSoT (ADR-508 unified linear-member framing).
 *
 * «Σε ποιο τρίτο ενός εύρους πέφτει μια τιμή»: `lo` (αρχή) / `mid` (μέση) / `hi` (τέλος).
 * Κοινό για **column** face-snap (anchor third κατά μήκος της παρειάς), **member-to-member**
 * face-snap (3-ζωνική δικαιολόγηση πλάτους του κάθετου ghost) και για **δοκάρι ΚΑΙ τοίχο**
 * (ίδιο smart-ghost framing, ADR-398 §3.6 → γενικευμένο εδώ).
 *
 * Zero-import leaf (cycle-proof): το `member-column-face-snap` εισάγει το `linear-member-face-snap`,
 * οπότε ο κοινός helper ζει εδώ ώστε **και** τα δύο να τον κάνουν import χωρίς κύκλο/διπλότυπο.
 *
 * @see ../beams/beam-face-third.ts — thin re-export alias (πίσω συμβατότητα δοκαριού)
 */

/** Αγκύρωση κατά μήκος ενός εύρους: αρχή / μέση / τέλος. */
export type MemberGhostThird = 'lo' | 'mid' | 'hi';

/** Σε ποιο τρίτο του `[lo, hi]` πέφτει το `value` (clamped). Εκφυλισμένο εύρος → `mid`. */
export function pickThird(value: number, lo: number, hi: number): MemberGhostThird {
  const span = hi - lo;
  if (span <= 0) return 'mid';
  const t = Math.min(1, Math.max(0, (value - lo) / span));
  return t < 1 / 3 ? 'lo' : t < 2 / 3 ? 'mid' : 'hi';
}
