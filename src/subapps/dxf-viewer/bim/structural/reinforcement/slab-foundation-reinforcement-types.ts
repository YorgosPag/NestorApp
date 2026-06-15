/**
 * Foundation-slab (raft / εδαφόπλακα) reinforcement data model (ADR-459 Φ4e/E3).
 *
 * Η εδαφόπλακα/κοιτόστρωση (`SlabEntity` kind `foundation`/`ground`) οπλίζεται ως
 * **δι-διευθυντική πλάκα με ΔΥΟ σχάρες** — κάτω (sagging, στο φάτνωμα) ΚΑΙ άνω
 * (hogging, πάνω από στηρίξεις) — σε αντίθεση με το μεμονωμένο πέδιλο όπου η άνω
 * σχάρα είναι προαιρετική (EC2 §9.3.1 / §9.8.2). Reuse του `RebarMesh` (ΕΝΑ SSoT
 * πλέγματος, μηδέν duplicate — N.0.2).
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
}

/** Σύντομη ετικέτα κύριου (κάτω) οπλισμού raft — π.χ. «Ø14/200». */
export function formatSlabFoundationMainLabel(r: SlabFoundationReinforcement): string {
  return `Ø${r.bottomMeshX.diameterMm}/${r.bottomMeshX.spacingMm}`;
}
