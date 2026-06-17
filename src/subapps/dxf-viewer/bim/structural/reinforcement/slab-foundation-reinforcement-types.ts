/**
 * Slab structural reinforcement data model — **universal** (ADR-459 Φ4e/E3 + ADR-476).
 *
 * ΕΝΑ μοντέλο σχάρας για ΟΛΑ τα είδη πλάκας (ADR-476 — full SSoT, μηδέν duplicate):
 *   - **εδαφόπλακα/raft** (`kind` foundation/ground): δι-διευθυντική κάτω (sagging,
 *     φάτνωμα) + άνω (hogging, πάνω από στηρίξεις) — EC2 §9.8.2.
 *   - **αναρτημένη** (`kind` floor/ceiling/roof): κάτω σχάρα ανοίγματος (κύρια) + άνω
 *     σχάρα στηρίξεων (detailing/hogging) — EC2 §9.3.1.
 * Το σχήμα (4 σχάρες + cover) είναι κοινό· διαφέρει ΜΟΝΟ ο kind-aware suggester
 * (όρια/As ανά είδος). Το όνομα `SlabFoundationReinforcement` διατηρείται ιστορικά
 * (22 callers, μηδέν disruptive rename) — βλ. ADR-476 §Naming. Reuse του `RebarMesh`
 * (ΕΝΑ SSoT πλέγματος, μηδέν duplicate — N.0.2).
 *
 * Διακριτό από το `SlabParams.reinforcement` (hint enum one-way/two-way/…) που
 * τροφοδοτεί BOQ/hatch — αυτό είναι το ΠΡΑΓΜΑΤΙΚΟ μοντέλο ποσοτήτων, persisted στο
 * ξεχωριστό πεδίο `SlabParams.structuralReinforcement` (μηδέν regression στο hint).
 *
 * Η οπλισμός = user-editable / code-suggested INTENT (persisted, optional). Οι
 * derived ποσότητες (μήκη/βάρος/ρ) υπολογίζονται on-demand από
 * `slab-foundation-reinforcement-compute.ts` — ΠΟΤΕ αποθηκεύονται (geometry-is-SSoT).
 *
 * Units: όλα τα μήκη/διάμετροι σε mm (Nestor convention).
 *
 * @see ./footing-reinforcement-types.ts — ο δίδυμος του πεδίλου (RebarMesh SSoT)
 * @see ./slab-foundation-reinforcement-compute.ts — οι derived ποσότητες
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §6g
 */

import type { RebarMesh } from './footing-reinforcement-types';

export type { RebarMesh };

/**
 * Οπλισμός εδαφόπλακας/raft. Δι-διευθυντική **κάτω** σχάρα (κύριος καμπτικός,
 * φάτνωμα) + δι-διευθυντική **άνω** σχάρα (πάνω από στηρίξεις). `*MeshX` = ράβδοι
 * που τρέχουν κατά τον άξονα X (βήμα μετρημένο κατά Y)· `*MeshY` = ράβδοι κατά Y.
 */
export interface SlabFoundationReinforcement {
  /** Κάτω σχάρα, ράβδοι // X. */
  readonly bottomMeshX: RebarMesh;
  /** Κάτω σχάρα, ράβδοι // Y. */
  readonly bottomMeshY: RebarMesh;
  /** Άνω σχάρα, ράβδοι // X. */
  readonly topMeshX: RebarMesh;
  /** Άνω σχάρα, ράβδοι // Y. */
  readonly topMeshY: RebarMesh;
  /** Επικάλυψη οπλισμού cnom (mm) — θεμελίωση: μεγαλύτερη (έδραση σε έδαφος). */
  readonly coverMm: number;
  /**
   * ADR-476 — `true` ⇒ code-suggested design που **ξαναϋπολογίζεται** σε κάθε αλλαγή
   * γεωμετρίας/φορτίου (Revit «by code», parity με κολόνα/δοκάρι). `false`/absent ⇒
   * χειροκίνητη υπέρβαση (κλειδωμένη, ο χρήστης το όρισε — ο οργανισμός δεν το αγγίζει).
   * Παλιό stored foundation reinforcement (χωρίς flag) ⇒ manual (μηδέν regression).
   */
  readonly auto?: boolean;
}

/** Σύντομη ετικέτα κύριου (κάτω) οπλισμού raft — π.χ. «Ø14/200». */
export function formatSlabFoundationMainLabel(r: SlabFoundationReinforcement): string {
  return `Ø${r.bottomMeshX.diameterMm}/${r.bottomMeshX.spacingMm}`;
}
