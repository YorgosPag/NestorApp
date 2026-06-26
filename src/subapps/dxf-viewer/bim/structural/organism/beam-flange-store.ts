/**
 * Beam effective-flange store — transient DERIVED transport (ADR-534 Φ3c-B1, mirror ADR-499 §6.3-a).
 *
 * Κρατά το τελευταίο DERIVED **`b_eff`** (mm, EC2 §5.3.2.1) ανά δοκό (`beamId → b_eff`), όταν
 * μονολιθική πλάκα οροφής/δαπέδου την κάνει **πλακοδοκό (T-beam)**. Το **render/reinforce/sizing path**
 * (`active-reinforcement.ts`) — per-entity & pure — παίρνει το `b_eff` με ΕΝΑ synchronous read, χωρίς να
 * ξαναϋπολογίζει σε κάθε render/auto-size γύρο τη spatial τοπολογία «ποια πλάκα καλύπτει τη δοκό».
 *
 * Κρατά μόνο τον αριθμό `b_eff` (mm) — όπως το `BeamTorsionStore` κρατά μόνο `T_Ed` — αφού η ίδια η
 * γεωμετρία (διατομή/άνοιγμα) ζει στη δοκό· εδώ είναι DERIVED cache του «καλύπτεται από πλάκα;».
 *
 * Low-frequency: γράφεται ΜΟΝΟ στο organism recompute pass (ίδια structural events) → ADR-040 safe.
 * DERIVED, ΠΟΤΕ persisted — η αλήθεια ζει στην τοπολογία πλάκας↔δοκού, εδώ είναι cache.
 *
 * @see ./derive-beam-flange-width.ts — buildBeamFlangeWidthMap (ο builder)
 * @see ../../../../hooks/structural-organism-core.ts — ο writer
 * @see ../active-reinforcement.ts — resolveActiveBeamFlangeWidthMm (ο reader)
 */

import { createDerivedMapStore } from './derived-map-store';

/**
 * `beamId → DERIVED b_eff (mm)`, ή `undefined` αν δεν την καλύπτει πλάκα (γυμνή ορθογώνια δοκός /
 * πριν το πρώτο pass) → ο caller το αγνοεί (πέφτει στο `b_w`, μηδέν regression). ΕΝΑ SSoT
 * `createDerivedMapStore` (N.0.2 — κοινό boilerplate με Torsion/Span/Support stores).
 */
export const BeamFlangeStore = createDerivedMapStore<number>();
