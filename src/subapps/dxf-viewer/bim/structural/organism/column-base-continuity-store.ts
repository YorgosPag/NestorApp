/**
 * Column base-continuity store — transient DERIVED transport (ADR-489 §6.1).
 *
 * Κρατά την τελευταία DERIVED **effective βάση** ανά κολώνα (`columnId → effectiveBaseZmm`,
 * απόλυτο mm = άνω παρειά στηρίζοντος πεδίλου), ώστε το **render path**
 * (`bim-scene-attach-syncs.syncColumns`) — per-entity, χωρίς πρόσβαση στον graph — να
 * παίρνει το «πόσο κατεβαίνει η βάση» με ΕΝΑ synchronous read.
 *
 * Χρησιμοποιεί το ΕΝΑ SSoT `createDerivedMapStore` (N.0.2 — κοινό boilerplate με το
 * `BeamSupportConditionStore`). Low-freq (organism pass) → ADR-040 safe. DERIVED, ΠΟΤΕ
 * persisted. Writer = `useStructuralOrganism`· reader = `syncColumns`.
 *
 * @see ./derived-map-store.ts — το generic factory
 * @see ./derive-column-base-continuity.ts — buildColumnBaseContinuityMap (ο builder)
 */

import { createDerivedMapStore } from './derived-map-store';

/** `columnId → effectiveBaseZmm` (απόλυτο mm). `undefined` → κολώνα κρατά τη nominal βάση. */
export const ColumnBaseContinuityStore = createDerivedMapStore<number>();
