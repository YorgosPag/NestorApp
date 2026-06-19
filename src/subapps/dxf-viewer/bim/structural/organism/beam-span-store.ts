/**
 * Beam span store — transient DERIVED transport (ADR-504 Φ2, mirror ADR-486/499 stores).
 *
 * Κρατά το τελευταίο DERIVED **άνοιγμα διαστασιολόγησης** ανά δοκό (`beamId → sizingSpanMm`),
 * δηλαδή το μέγιστο καθαρό υπο-άνοιγμα ενός **συνεχούς** δοκού μεταξύ διαδοχικών στηρίξεων
 * (`deriveBeamSpanModel`). Το **render/reinforce/sizing path** (`active-reinforcement.ts`,
 * `AutoSizeMembersCommand`) — per-entity & pure — παίρνει το span με ΕΝΑ synchronous read,
 * χωρίς να ξαναϋπολογίζει την προβολή των στηρίξεων στον άξονα σε κάθε γύρο.
 *
 * Κρατά μόνο τον αριθμό `sizingSpanMm` — όπως το `BeamSupportConditionStore` κρατά μόνο
 * `BeamSupportType` & το `BeamTorsionStore` μόνο `T_Ed`. Ο τύπος `'continuous'` που ζευγαρώνει
 * ζει στο `BeamSupportConditionStore` (γράφονται ΜΑΖΙ από `buildBeamSpanModelMap`).
 *
 * Low-frequency: γράφεται ΜΟΝΟ στο organism recompute pass (ίδια structural events) →
 * ADR-040 safe. DERIVED, ΠΟΤΕ persisted — η αλήθεια ζει στην τοπολογία, εδώ είναι cache.
 *
 * @see ./derive-beam-span-model.ts — deriveBeamSpanModel / buildBeamSpanModelMap (ο builder)
 * @see ../../../hooks/structural-organism-core.ts — ο writer
 * @see ../active-reinforcement.ts — resolveActiveBeamSpanMm (ο reader)
 */

import { createDerivedMapStore } from './derived-map-store';

/**
 * `beamId → DERIVED sizingSpanMm`, ή `undefined` αν δεν είναι συνεχής / πριν το πρώτο pass
 * → ο caller πέφτει στο πλήρες `geometry.length` (μηδέν regression). ΕΝΑ SSoT
 * `createDerivedMapStore` (N.0.2 — κοινό boilerplate με Slab/Beam/ColumnBase stores).
 */
export const BeamSpanStore = createDerivedMapStore<number>();
