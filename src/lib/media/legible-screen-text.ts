/**
 * @fileoverview **Το ελάχιστο κείμενο που διαβάζεται ΜΕΣΑ σε σχέδιο** — ένα όριο σε css px στην οθόνη, για κάθε SVG που
 * κλιμακώνεται ολόκληρο (κάτοψη ορόφου, χάρτης εδάφους).
 * @related ADR-907 §11.14 (η μέτρηση) · components/listing-detail/media/FloorPlateUnitLayer · lib/terrain/publication/terrain-map-model
 * @module lib/media/legible-screen-text
 *
 * 🔴 **Μετρημένο στην παραγωγή** (ADR-907 §11.14): κείμενα σε κλάσματα του σχεδίου έδιναν 8,8 px στα 320 και 11,2 px στα 390.
 * Ένα σχέδιο που κλιμακώνεται με το πλάτος χρειάζεται **πάτωμα στην οθόνη**, όχι μόνο αναλογία στο χαρτί.
 */

/** Κάτω από αυτό ένα κείμενο του σχεδίου **δεν διαβάζεται** — css px στην οθόνη, με το σχέδιο σε ηρεμία. */
export const LEGIBLE_SCREEN_TEXT_MIN_PX = 12;

/**
 * **Μέγεθος κειμένου σε μονάδες σχεδίου**: το σχεδιασμένο, αλλά ποτέ μικρότερο στην οθόνη από το πάτωμα.
 * @param scale css px ανά μονάδα σχεδίου όπως αποδίδεται· `null` όσο δεν έχει μετρηθεί (SSR · jsdom · PDF) — τότε ισχύει το
 *   σχέδιο, χωρίς μαντεμένο πάτωμα.
 */
export function legibleDrawingTextSize(drawn: number, scale: number | null): number {
  return scale === null || !(scale > 0) ? drawn : Math.max(drawn, LEGIBLE_SCREEN_TEXT_MIN_PX / scale);
}
