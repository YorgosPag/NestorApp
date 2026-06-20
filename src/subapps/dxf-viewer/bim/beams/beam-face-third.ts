/**
 * Beam ghost anchor-third — pure leaf SSoT (ADR-398 §Smart beam ghost / §3.6).
 *
 * «Σε ποιο τρίτο ενός εύρους πέφτει μια τιμή»: `lo` (αρχή) / `mid` (μέση) / `hi` (τέλος).
 * Κοινό και για το **column** face-snap (anchor third κατά μήκος της παρειάς) και για το
 * **beam-to-beam** face-snap (3-ζωνική δικαιολόγηση πλάτους του κάθετου ghost — Giorgio §3.6).
 *
 * Zero-import leaf (cycle-proof): το `beam-column-face-snap` εισάγει το `beam-beam-face-snap`,
 * οπότε ο κοινός helper ζει εδώ ώστε **και** τα δύο να τον κάνουν import χωρίς κύκλο/διπλότυπο.
 */

/** Αγκύρωση κατά μήκος ενός εύρους: αρχή / μέση / τέλος. */
export type BeamGhostThird = 'lo' | 'mid' | 'hi';

/** Σε ποιο τρίτο του `[lo, hi]` πέφτει το `value` (clamped). Εκφυλισμένο εύρος → `mid`. */
export function pickThird(value: number, lo: number, hi: number): BeamGhostThird {
  const span = hi - lo;
  if (span <= 0) return 'mid';
  const t = Math.min(1, Math.max(0, (value - lo) / span));
  return t < 1 / 3 ? 'lo' : t < 2 / 3 ? 'mid' : 'hi';
}
