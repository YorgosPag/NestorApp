/**
 * =============================================================================
 * «ΣΕ ΠΟΙΟ ΕΠΙΠΕΔΟ ΖΕΙ ΑΥΤΗ Η ΙΔΙΟΤΗΤΑ;» — μία απάντηση (ADR-923 §5.10 Δ1)
 * =============================================================================
 *
 * Το **βάθος** μετρά από τη ρίζα: 0 = κοινό (μοντέλο-ρίζα) · 1 = 1ο επίπεδο παραλλαγής ·
 * 2 = 2ο. Μια ιδιότητα ανήκει στο επίπεδο του σχήματος που τη δηλώνει (άξονας ή ιδιότητα του
 * επιπέδου)· ό,τι δεν δηλώνεται πουθενά είναι **κοινό** (βάθος 0). Ο φορέας τιμών σε βάθος `d`
 * κατέχει **ακριβώς** τις ιδιότητες βάθους `d` (Revit: Type **ή** Instance, ποτέ και τα δύο).
 *
 * Απλό προϊόν (χωρίς σχήμα): ένας φορέας, βάθος 0, κατέχει τα πάντα.
 *
 * Το ρωτούν η επικύρωση (λάθος επίπεδο), η συγχώνευση (ποιος είναι ο ιδιοκτήτης) και το
 * αποτύπωμα πληρότητας — **μία** συνάρτηση, ώστε να μη διαφωνήσουν ποτέ.
 *
 * @module subapps/catalog/values/attribute-levels
 */

import type { VariantScheme } from '../types/family';

/** Το βάθος-ιδιοκτήτης μιας ιδιότητας μέσα στο σχήμα (`null` σχήμα ⇒ 0). */
export function attributeOwnerDepth(scheme: VariantScheme | null, attributeId: string): number {
  if (!scheme) return 0;
  const index = scheme.levels.findIndex(
    (level) => level.axisAttributeIds.includes(attributeId) || level.attributeIds.includes(attributeId),
  );
  return index + 1;
}

/** Το βάθος του **τελικού** προϊόντος (SKU): όσα τα επίπεδα του σχήματος, 0 χωρίς σχήμα. */
export function leafDepth(scheme: VariantScheme | null): number {
  return scheme ? scheme.levels.length : 0;
}

/** Οι άξονες που **ορίζει** ο φορέας στο βάθος `depth` (κενό στη ρίζα). */
export function axesAtDepth(scheme: VariantScheme | null, depth: number): readonly string[] {
  if (!scheme || depth < 1) return [];
  return scheme.levels[depth - 1]?.axisAttributeIds ?? [];
}

export function isAxisOf(scheme: VariantScheme | null, attributeId: string): boolean {
  return !!scheme?.levels.some((level) => level.axisAttributeIds.includes(attributeId));
}

/** Το σχήμα παραλλαγών της οικογένειας με αυτόν τον κωδικό. */
export function findVariantScheme(
  schemes: readonly VariantScheme[],
  code: string,
): VariantScheme | undefined {
  return schemes.find((scheme) => scheme.code === code);
}
