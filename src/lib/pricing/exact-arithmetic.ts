/**
 * Ακριβής ακέραια αριθμητική της μηχανής τιμών (ADR-923 §5.11): **μία** στρογγύλευση,
 * μισό-προς-τα-πάνω, και μετατροπή δεκαδικού σε ακέραιο που **αρνείται** αντί να στρογγυλέψει.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 * @module lib/pricing/exact-arithmetic
 */

/** Ανοχή αναπαράστασης double (`0.29 * 100 = 28.999…`). */
const REPRESENTATION_TOLERANCE = 1e-6;

/** `n / d` στρογγυλεμένο μισό-προς-τα-πάνω, για μη αρνητικά `n` και θετικό `d`: floor((2n + d) / 2d). */
export function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (2n * numerator + denominator) / (2n * denominator);
}

/**
 * Δεκαδικός → ακέραιος σε κλίμακα `scale` (`12.5`, 1000 ⇒ 12500). `null` αν η τιμή δεν είναι
 * πεπερασμένη ή έχει **περισσότερα** δεκαδικά από όσα χωρά η κλίμακα — η μηχανή δεν στρογγυλεύει
 * σιωπηλά ό,τι έγραψε ο άνθρωπος.
 */
export function scaledInteger(value: number, scale: number): number | null {
  if (!Number.isFinite(value)) return null;
  const scaled = value * scale;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) >= REPRESENTATION_TOLERANCE) return null;
  return Number.isSafeInteger(rounded) ? rounded : null;
}
