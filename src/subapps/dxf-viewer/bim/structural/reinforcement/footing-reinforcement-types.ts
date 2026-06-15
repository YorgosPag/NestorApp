/**
 * Footing reinforcement data model (ADR-459 Phase 4b — auto-reinforcement οργανισμού).
 *
 * Mirror των `column-reinforcement-types.ts` / `beam-reinforcement-types.ts` για
 * **θεμελίωση**. Discriminated union ανά foundation `kind` (όπως το `FoundationParams`),
 * αφού οι 3 βάσεις οπλίζονται θεμελιωδώς διαφορετικά:
 *   - `pad`      → δι-διευθυντική κάτω σχάρα (mat) + προαιρετική άνω σχάρα (EC2 §9.8.2).
 *   - `strip`    → ανεστραμμένη δοκός: εγκάρσιες (mesh) + διαμήκεις διανομής + συνδετήρες.
 *   - `tie-beam` → **ΕΙΝΑΙ δοκός** → REUSE `BeamReinforcement` (μηδέν duplicate, N.0.2).
 *
 * Η οπλισμός = user-editable / code-suggested INTENT (persisted, optional). Οι
 * derived ποσότητες (μήκη/βάρος/ρ) υπολογίζονται on-demand από
 * `footing-reinforcement-compute.ts` — ΠΟΤΕ αποθηκεύονται (geometry-is-SSoT).
 *
 * Units: όλα τα μήκη/διάμετροι σε mm (Nestor convention).
 *
 * @see ./column-reinforcement-types.ts — ο δίδυμος της κολόνας
 * @see ./beam-reinforcement-types.ts — ο δίδυμος της δοκού (reuse για tie-beam)
 * @see ./footing-reinforcement-compute.ts — οι derived ποσότητες
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 4
 */

import type { BeamRebarLayer, BeamReinforcement, BeamStirrups } from './beam-reinforcement-types';

export type { BeamRebarLayer, BeamStirrups };

/**
 * Σχάρα/πλέγμα ράβδων με σταθερό βήμα — π.χ. Ø12/200. Το «mesh» εδώ σημαίνει
 * παράλληλες ράβδοι μίας διεύθυνσης (όχι συγκολλητό δομικό πλέγμα).
 */
export interface RebarMesh {
  /** Διάμετρος ράβδου (mm), π.χ. 12. */
  readonly diameterMm: number;
  /** Βήμα μεταξύ διαδοχικών ράβδων (mm), π.χ. 200. */
  readonly spacingMm: number;
}

/**
 * Οπλισμός μεμονωμένου πεδίλου (pad). Δι-διευθυντική κάτω σχάρα (κύριος καμπτικός
 * οπλισμός) + προαιρετική άνω σχάρα (μεγάλα/ανεστραμμένα πέδιλα). `bottomMeshX` =
 * ράβδοι που τρέχουν κατά τον άξονα X (βήμα μετρημένο κατά Y)· `bottomMeshY` =
 * ράβδοι κατά Y.
 */
export interface PadReinforcement {
  readonly kind: 'pad';
  /** Κάτω σχάρα, ράβδοι // X. */
  readonly bottomMeshX: RebarMesh;
  /** Κάτω σχάρα, ράβδοι // Y. */
  readonly bottomMeshY: RebarMesh;
  /** Προαιρετική άνω σχάρα (δι-διευθυντική, ίδια διάταξη). */
  readonly topMesh?: RebarMesh;
  /** Επικάλυψη οπλισμού cnom (mm) — θεμελίωση: μεγαλύτερη (έδραση σε έδαφος). */
  readonly coverMm: number;
}

/**
 * Οπλισμός πεδιλοδοκού/συνεχούς πεδίλου (strip) — αντιμετωπίζεται ως ανεστραμμένη
 * δοκός: εγκάρσιες κάτω ράβδοι (κύριος καμπτικός, βήμα κατά μήκος του άξονα) +
 * διαμήκεις ράβδοι διανομής + προαιρετικοί συνδετήρες.
 */
export interface StripReinforcement {
  readonly kind: 'strip';
  /** Εγκάρσιες κάτω ράβδοι (κατά πλάτος), βήμα κατά μήκος του άξονα. */
  readonly transverse: RebarMesh;
  /** Διαμήκεις ράβδοι διανομής/ανάρτησης (κατά μήκος του άξονα). REUSE BeamRebarLayer. */
  readonly longitudinal: BeamRebarLayer;
  /** Προαιρετικοί συνδετήρες (ανεστραμμένη δοκός). REUSE BeamStirrups. */
  readonly stirrups?: BeamStirrups;
  /** Επικάλυψη οπλισμού cnom (mm). */
  readonly coverMm: number;
}

/**
 * Οπλισμός συνδετήριας δοκού (tie-beam) — **είναι δοκός** → REUSE `BeamReinforcement`
 * (κάτω/άνω διαμήκης + συνδετήρες + cover) + discriminator `kind`. Μηδέν duplicate
 * (N.0.2): ίδιο data model, ίδιος compute (delegate), ίδιος suggester (delegate).
 */
export interface TieBeamReinforcement extends BeamReinforcement {
  readonly kind: 'tie-beam';
}

/** Discriminated union ανά foundation kind (mirror `FoundationParams`). */
export type FootingReinforcement =
  | PadReinforcement
  | StripReinforcement
  | TieBeamReinforcement;

/** Σύντομη ετικέτα σχάρας — π.χ. «Ø12/200». */
export function formatMeshLabel(mesh: RebarMesh): string {
  return `Ø${mesh.diameterMm}/${mesh.spacingMm}`;
}
