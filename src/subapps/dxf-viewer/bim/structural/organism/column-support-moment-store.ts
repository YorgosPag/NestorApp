/**
 * Column support-moment store — transient DERIVED transport (ADR-502 Slice 2, mirror
 * ADR-499 §6.3-a `BeamTorsionStore`).
 *
 * Κρατά την τελευταία DERIVED **στατική** ροπή σχεδιασμού ανά στηρίζουσα κολώνα
 * (`columnId → M (kNm)`), που προέρχεται από δοκάρι-πρόβολο (`buildColumnSupportMomentMap`).
 * Το **render/reinforce/sizing path** (`active-reinforcement.ts`) — per-entity & pure —
 * παίρνει το `M` με ΕΝΑ synchronous read, χωρίς να ξαναϋπολογίζει την τοπολογία προβόλου
 * σε κάθε render ή auto-size γύρο. Όταν ο φορέας είναι engaged, το FEM (ADR-491) υπερισχύει
 * (ιεραρχία στο `resolveActiveColumnDesignMoment`).
 *
 * Κρατά μόνο τον αριθμό `M` (kNm) — όπως το `BeamTorsionStore` κρατά μόνο `T_Ed` — αφού
 * η αντοχή (N-M) παράγεται from scratch από τη διατομή.
 *
 * Low-frequency: γράφεται ΜΟΝΟ στο organism recompute pass (ίδια structural events) →
 * ADR-040 safe. DERIVED, ΠΟΤΕ persisted — η αλήθεια ζει στην τοπολογία, εδώ είναι cache.
 *
 * @see ../loads/column-support-moment.ts — buildColumnSupportMomentMap (ο builder)
 * @see ../../../hooks/structural-organism-core.ts — ο writer
 * @see ../active-reinforcement.ts — resolveActiveColumnDesignMoment (ο reader, FEM ?? static)
 */

import { createDerivedMapStore } from './derived-map-store';

/**
 * `columnId → DERIVED στατική ροπή σχεδιασμού M (kNm)`, ή `undefined` αν δεν έχει
 * υπολογιστεί (κολώνα χωρίς δοκάρι-πρόβολο / πριν το πρώτο pass) → ο caller πέφτει στην
 * ονομαστική e₀. ΕΝΑ SSoT `createDerivedMapStore` (N.0.2 — κοινό boilerplate με τα άλλα stores).
 */
export const ColumnSupportMomentStore = createDerivedMapStore<number>();
