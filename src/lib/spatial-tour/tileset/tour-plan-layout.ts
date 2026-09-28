/**
 * @fileoverview **ΠΟΥ ΖΟΥΝ ΤΑ ΠΑΡΑΓΩΓΑ ΜΙΑΣ ΚΑΤΟΨΗΣ** — ονόματα και πλάτη, από το αποτύπωμα των bytes (ADR-884 Φ2στ-β · §4.13).
 * Καθαρό.
 * @related `server/spatial-tour/tour-plan-prepare.ts` (ο γραφέας) · `tour-view-session.ts` (το μανιφέστο) ·
 *   `tour-media-path.ts` (η λίστα επιτρεπτών) · `tour-tileset-layout.ts` (ο αδελφός των πανοραμάτων)
 * @module lib/spatial-tour/tileset/tour-plan-layout
 *
 * 🔑 **Διεύθυνση από το περιεχόμενο**: ίδια bytes ⇒ ίδιο όνομα ⇒ δεύτερη ετοιμασία = καμία εγγραφή, και η κρυφή μνήμη
 *   (`immutable`) δεν σερβίρει ποτέ παλιά κάτοψη με νέο όνομα. Η διεύθυνση **παράγεται** — το έγγραφο κρατά μόνο το hash.
 * 🔑 **WebP, όχι JPEG**: μια κάτοψη είναι γραμμές σε λευκό — το JPEG «λερώνει» τις ακμές με θόρυβο, το WebP τις κρατά
 *   καθαρές στο μισό μέγεθος.
 */

/** Η έκδοση της διάταξης — μέρος κάθε διαδρομής (αλλαγή ⇒ νέα ονόματα, ποτέ επανεγγραφή). */
const TOUR_PLAN_LAYOUT_VERSION = 'p1';
/** Τα πλάτη που σερβίρονται: στήλη (≈ 400 css px × 2 DPR) και μεγέθυνση/επεξεργαστής. */
export const TOUR_PLAN_WIDTHS = [1024, 2048] as const;
export const TOUR_PLAN_CONTENT_TYPE = 'image/webp';
export const TOUR_PLAN_WEBP_QUALITY = 88;

/**
 * Τα πλάτη που **αξίζει** να παραχθούν από πρωτότυπο πλάτους `width`: ποτέ μεγέθυνση — μικρό πρωτότυπο δίνει ένα
 * παράγωγο στο δικό του πλάτος.
 */
export function planDerivativeWidths(width: number): readonly number[] {
  const widths = TOUR_PLAN_WIDTHS.filter((w) => w <= width);
  return widths.length > 0 ? widths : [Math.round(width)];
}

/** Το τμήμα διαδρομής ενός παραγώγου (κάτω από το `tour-tiles/{tourId}/`). */
export function planImageSegments(contentHash: string, width: number): readonly string[] {
  return ['plans', contentHash, TOUR_PLAN_LAYOUT_VERSION, `w${width}.webp`];
}

/** Το πλάτος που ζητά η στήλη: το μικρότερο διαθέσιμο που φτάνει, αλλιώς το μεγαλύτερο. */
export function planWidthFor(originalWidth: number, wantedCssWidth: number): number {
  const widths = planDerivativeWidths(originalWidth);
  return widths.find((w) => w >= wantedCssWidth) ?? widths[widths.length - 1];
}
