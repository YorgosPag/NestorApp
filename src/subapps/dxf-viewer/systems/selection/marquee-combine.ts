/**
 * marquee-combine.ts — SSoT για το ΠΩΣ ένα αποτέλεσμα marquee ενώνεται με την τρέχουσα επιλογή.
 *
 * Ο κανόνας είναι modifier-driven και ΚΟΙΝΟΣ σε κάθε επιφάνεια που τραβάει ορθογώνιο:
 *   • plain drag        → `replace`  — η επιλογή γίνεται ΑΚΡΙΒΩΣ τα hits
 *   • Shift + drag      → `add`      — ένωση με την τρέχουσα επιλογή
 *   • Ctrl/Cmd + drag   → `subtract` — αφαίρεση των hits από την τρέχουσα επιλογή
 *
 * Η μαθηματική πράξη ζούσε αρχικά inline μέσα στο `applyBimMarqueeSelection`
 * (scene-manager-actions). Η ADR-692 Φ2 πρόσθεσε ΔΕΥΤΕΡΟ καταναλωτή (raw DXF wireframe
 * marquee) που χρειάζεται ΤΗΝ ΙΔΙΑ πράξη πάνω σε άλλο store — δηλαδή ακριβώς το σχήμα
 * που γεννάει sibling clone (N.18). Εδώ ζει μία φορά, pure + Jest-friendly.
 *
 * Σκόπιμα ΔΕΝ ξέρει τίποτα για stores/τύπους οντοτήτων: παίρνει ids, γυρνάει ids.
 */

/** Πώς το αποτέλεσμα του marquee συνδυάζεται με την υπάρχουσα επιλογή. */
export type MarqueeCombineMode = 'replace' | 'add' | 'subtract';

/**
 * Η τελική λίστα ids μετά τον συνδυασμό. Πάντα de-duplicated· η σειρά διατηρεί πρώτα τα
 * υπάρχοντα (add) ή τη σειρά των hits (replace), ώστε το «τελευταίο» id — αυτό που τα
 * stores κάνουν primary — να είναι προβλέψιμο.
 */
export function combineMarqueeSelection(
  current: readonly string[],
  hitIds: readonly string[],
  mode: MarqueeCombineMode,
): string[] {
  if (mode === 'add') {
    const set = new Set(current);
    for (const id of hitIds) set.add(id);
    return [...set];
  }
  if (mode === 'subtract') {
    const remove = new Set(hitIds);
    return current.filter((id) => !remove.has(id));
  }
  return [...new Set(hitIds)];
}
