/**
 * Το ΕΝΑ SSoT predicate για την ορατότητα των length/angle HUD ενδείξεων.
 *
 * ΟΛΑ τα preview/HUD call sites μήκους & γωνίας — DXF + BIM, κατά τη ΣΧΕΔΙΑΣΗ
 * και κατά το GRIP-DRAG/επεξεργασία, 2D + 3D — ρωτούν ΑΥΤΟ το predicate πριν
 * ζωγραφίσουν ένδειξη ΜΗΚΟΥΣ (aligned dims, distance labels, edge lengths,
 * Ø διάμετρος, πλάτος/βάθος) ή ΓΩΝΙΑΣ (∠θ / angle labels).
 *
 * Καθρεφτίζει το status-bar toggle «ΜΗΚΟΣ/ΓΩΝΙΑ» (cadToggleState.isDimHudOn()):
 * OFF ⇒ οι ενδείξεις μήκους/γωνίας κρύβονται καθολικά.
 *
 * ΑΡΧΙΤΕΚΤΟΝΙΚΟΣ ΚΑΝΟΝΑΣ: το gate μπαίνει ΣΤΑ CALL SITES των preview/HUD paint
 * functions — ΠΟΤΕ μέσα στους low-level shared painters (renderDistanceLabel,
 * paintAlignedOverlayDimension, drawOverlayLabel, renderInfoLabel), γιατί αυτοί
 * μοιράζονται με committed entities και gate εκεί θα έκρυβε committed dimensions.
 * Ένα SSoT predicate, πολλοί gated call sites.
 *
 * ΔΕΝ αφορά ΠΟΤΕ: εμβαδόν/περίμετρο, πάχος·ύψος specLabel (BIM ταυτότητα),
 * αριθμό πλευρών πολυγώνου — αυτά παραμένουν πάντα ορατά.
 *
 * @see cad-toggle-state.ts — SSoT του toggle (dimHudOn) + status-bar writer
 */

import { cadToggleState } from './cad-toggle-state';

/**
 * true ⇒ ζωγράφισε τις length/angle HUD ενδείξεις· false ⇒ κρύψ' τες καθολικά.
 * Το ΕΝΑ σημείο που όλα τα length/angle preview/HUD call sites ρωτούν.
 */
export function isLengthAngleHudVisible(): boolean {
  return cadToggleState.isDimHudOn();
}
