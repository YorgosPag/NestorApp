/**
 * Slab support-condition store — transient DERIVED transport (ADR-498, mirror ADR-486).
 *
 * Κρατά την τελευταία DERIVED συνθήκη στήριξης ανά πλάκα (`slabId → SlabSupportCondition`)
 * ώστε το **render/reinforce path** (`active-reinforcement.ts`) — per-entity & pure — να
 * παίρνει τον topology-aware τύπο στήριξης + το μήκος προβόλου με ΕΝΑ synchronous read,
 * χωρίς να ξαναϋπολογίζει τη spatial τοπολογία σε κάθε render.
 *
 * Σε αντίθεση με το `BeamSupportConditionStore` (που κρατά μόνο `BeamSupportType`, αφού το
 * άνοιγμα δοκαριού = `geometry.length`), εδώ κρατάμε ΟΛΟΚΛΗΡΗ τη `SlabSupportCondition`
 * επειδή το **μήκος προβόλου** της πλάκας είναι DERIVED (κάθετη προβολή), όχι αποθηκευμένο.
 *
 * Low-frequency: γράφεται ΜΟΝΟ στο organism recompute pass (ίδια structural events) →
 * ADR-040 safe. DERIVED, ΠΟΤΕ persisted — η αλήθεια ζει στην τοπολογία, εδώ είναι cache.
 *
 * @see ../loads/slab-beam-support.ts — computeSlabSupportConditions (ο builder)
 * @see ../../../hooks/useStructuralOrganism.ts — ο writer
 * @see ../active-reinforcement.ts — ο reader (render/reinforce path)
 */

import type { SlabSupportCondition } from '../loads/slab-beam-support';
import { createDerivedMapStore } from './derived-map-store';

/**
 * `slabId → DERIVED SlabSupportCondition`, ή `undefined` αν δεν έχει υπολογιστεί (πλάκα
 * εκτός σκηνής/πριν το πρώτο pass) → ο caller fallback σε 'simple'. ΕΝΑ SSoT
 * `createDerivedMapStore` (N.0.2 — κοινό boilerplate με Beam/ColumnBase stores).
 */
export const SlabSupportConditionStore = createDerivedMapStore<SlabSupportCondition>();
