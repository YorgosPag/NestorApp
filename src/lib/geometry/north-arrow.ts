/**
 * @fileoverview 🧭 **ΤΟ ΣΧΗΜΑ ΤΟΥ ΒΕΛΟΥΣ ΒΟΡΡΑ** — ένα περίγραμμα για κάθε βέλος βορρά της εφαρμογής.
 * @related ADR-656 M12 (DXF: HUD + ψημένη οντότητα) · ADR-897 Φ5.2 (κατόψεις αγγελίας: επεξεργαστής + δημόσιο)
 * @module lib/geometry/north-arrow
 *
 * 🔑 Εξήχθη από το `dxf-viewer/systems/topography/north-arrow-config.ts` τη μέρα που ήρθε ο καταναλωτής **έξω** από
 * το DXF (ADR-897): ένα βέλος βορρά δεν ανήκει στην τοπογραφία, ανήκει στη γεωμετρία — και ο άνθρωπος πρέπει να
 * βλέπει το **ίδιο** σύμβολο στο σχέδιο και στην αγγελία. Το DXF το επανεξάγει με το ιστορικό του όνομα.
 *
 * ⚠️ **Καθαρό module** — καμία εξάρτηση.
 */

/**
 * Το περίγραμμα σε **μοναδιαίο** πλαίσιο: μύτη πάνω (+Y = βορράς), κοίλη βάση — η κλασική αιχμή του τοπογράφου.
 * Ύψος στο `y ∈ [-0.5, 0.5]`· κλιμακώνεται από τον καταναλωτή.
 */
export const NORTH_ARROW_UNIT_OUTLINE: readonly { readonly x: number; readonly y: number }[] = [
  { x: 0, y: 0.5 }, // μύτη (βορράς)
  { x: 0.2, y: -0.5 }, // δεξιά βάση
  { x: 0, y: -0.28 }, // κοίλη εγκοπή
  { x: -0.2, y: -0.5 }, // αριστερή βάση
] as const;

/**
 * Η αιχμή ως διαδρομή **SVG** (άξονας Y προς τα κάτω), κεντραρισμένη στο `(cx, cy)`, ύψους `size`, με τη μύτη **πάνω**.
 * Ο καλών τη στρίβει με `transform="rotate(μοίρες cx cy)"` — δεξιόστροφα, όπως το SVG.
 */
export function northArrowSvgPath(cx: number, cy: number, size: number): string {
  const points = NORTH_ARROW_UNIT_OUTLINE.map(
    (unit, index) => `${index === 0 ? 'M' : 'L'} ${cx + unit.x * size} ${cy - unit.y * size}`,
  );
  return `${points.join(' ')} Z`;
}
