/**
 * Beam torsion store — transient DERIVED transport (ADR-499 §6.3-a, mirror ADR-486/498).
 *
 * Κρατά την τελευταία DERIVED στρεπτική ροπή σχεδιασμού ανά δοκό (`beamId → T_Ed (kNm)`),
 * που προέρχεται από μονόπλευρη πρόβολο-πλάκα (`computeBeamDesignTorsion`). Το **render/
 * reinforce/sizing path** (`active-reinforcement.ts`) — per-entity & pure — παίρνει το `T_Ed`
 * με ΕΝΑ synchronous read, χωρίς να ξαναϋπολογίζει τη spatial τοπολογία προβόλου σε κάθε
 * render ή auto-size γύρο.
 *
 * Κρατά μόνο τον αριθμό `T_Ed` (kNm) — όπως το `BeamSupportConditionStore` κρατά μόνο
 * `BeamSupportType` — αφού το `T_Rd,max` (αντοχή) είναι γεωμετρικό-υλικό (παράγεται from
 * scratch από τη διατομή, χωρίς store).
 *
 * Low-frequency: γράφεται ΜΟΝΟ στο organism recompute pass (ίδια structural events) →
 * ADR-040 safe. DERIVED, ΠΟΤΕ persisted — η αλήθεια ζει στην τοπολογία, εδώ είναι cache.
 *
 * @see ../loads/beam-torsion.ts — computeBeamDesignTorsion (ο builder)
 * @see ../../../hooks/useStructuralOrganism.ts — ο writer
 * @see ../active-reinforcement.ts — resolveActiveBeamTorsion (ο reader)
 */

import { createDerivedMapStore } from './derived-map-store';

/**
 * `beamId → DERIVED T_Ed (kNm)`, ή `undefined` αν δεν έχει υπολογιστεί (δοκός χωρίς
 * πρόβολο-πλάκα / πριν το πρώτο pass) → ο caller το αγνοεί (μηδέν στρέψη). ΕΝΑ SSoT
 * `createDerivedMapStore` (N.0.2 — κοινό boilerplate με Slab/Beam/ColumnBase stores).
 */
export const BeamTorsionStore = createDerivedMapStore<number>();
