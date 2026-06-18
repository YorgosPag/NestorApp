/**
 * Beam support-condition store — transient DERIVED transport (ADR-486).
 *
 * Μικρό external store που κρατά τον τελευταίο DERIVED τύπο στήριξης ανά δοκάρι
 * (`beamId → BeamSupportType`), ώστε το **render path** (`active-reinforcement.ts`)
 * — που είναι per-entity & pure, χωρίς πρόσβαση στον graph — να παίρνει τον topology-
 * aware τύπο με ΕΝΑ synchronous read, αντί να ξαναχτίζει τον graph σε κάθε render.
 *
 * Low-frequency: γράφεται ΜΟΝΟ στο organism recompute pass (ίδια structural events με
 * το `StructuralDiagnosticsStore`), όχι σε pan/zoom/hover → ADR-040 safe. `getState`-style
 * synchronous read (ΟΧΙ subscription στο render path). Zero React.
 *
 * SSoT writer = `useStructuralOrganism` shell hook. Readers = `active-reinforcement.ts`.
 * DERIVED, ΠΟΤΕ persisted (όπως ο graph) — η αλήθεια ζει στην τοπολογία, εδώ είναι cache.
 *
 * @see ./derive-beam-support.ts — buildBeamSupportTypeMap (ο builder)
 * @see ../../../hooks/useStructuralOrganism.ts — ο writer
 * @see ../active-reinforcement.ts — ο reader (render path)
 */

import type { BeamSupportType } from '../../types/beam-types';
import { createDerivedMapStore } from './derived-map-store';

/**
 * `beamId → DERIVED supportType`, ή `undefined` αν δεν έχει υπολογιστεί (δοκάρι εκτός
 * οργανισμού) → ο caller fallback στο stored. Χρησιμοποιεί το ΕΝΑ SSoT
 * `createDerivedMapStore` (N.0.2 — κοινό boilerplate με το `ColumnBaseContinuityStore`).
 */
export const BeamSupportConditionStore = createDerivedMapStore<BeamSupportType>();
