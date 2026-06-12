/**
 * Associative Grid Hosting — Per-kind strategy contract (ADR-441, Slice GEN).
 *
 * Ο reconciler ήταν foundation-only. Για να ακολουθούν τον κάναβο ΚΑΙ τοίχοι/κολώνες
 * (Revit grid-driven structure) χωρίς να ξαναγραφτεί η μηχανή, κάθε BIM kind δηλώνει μια
 * `HostingStrategy`: (α) πώς re-derives params+geometry+validation από τα guide offsets
 * (`reconcile`) και (β) πώς βγάζει το outline του για το zero-lag follow ghost (`outline`).
 *
 * Τα `nextParams`/`nextGeometry` τυποποιούνται ως `unknown` στο boundary του registry
 * (ετερογενείς strategies) — η εκάστοτε strategy τα παράγει/καταναλώνει type-safe εσωτερικά,
 * ο reconciler τα γράφει στη σκηνή μέσω του υπάρχοντος `AnySceneEntity` spread. Μηδέν `any`.
 *
 * @see bim/hosting/hosting-strategy.ts — registry + lookup
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { BimValidation } from '../types/bim-base';
import type { AnySceneEntity } from '../../types/scene';
import type { GuideOffsetLookup, Vec2 } from './derive-slots';

/** Ένα έτοιμο-προς-εφαρμογή update για μία hosted entity (re-derived από guide offsets). */
export interface HostingUpdate {
  readonly id: string;
  /** Entity type — ο follow-ghost το χρησιμοποιεί για dispatch στο σωστό `outline`. */
  readonly type: AnySceneEntity['type'];
  readonly nextParams: unknown;
  readonly nextGeometry: unknown;
  readonly nextValidation: BimValidation;
}

/** Στρατηγική hosting ενός BIM kind. Pure — μηδέν side-effects, μηδέν scene access. */
export interface HostingStrategy {
  /**
   * Re-derive μία hosted entity ως προς τα τρέχοντα guide offsets → `HostingUpdate` ή
   * `null` αν (α) δεν είναι του kind της strategy, (β) δεν φέρει bindings, ή (γ) τίποτα
   * δεν άλλαξε (only-changed → ο reconciler παραλείπει το scene write).
   */
  reconcile(entity: AnySceneEntity, getOffset: GuideOffsetLookup): HostingUpdate | null;
  /**
   * Outline (world coords) από το re-derived geometry ενός `HostingUpdate.nextGeometry` —
   * για ζωγράφισμα ως live follow ghost (zero-lag overlay).
   */
  outline(nextGeometry: unknown): readonly Vec2[];
}
