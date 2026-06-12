/**
 * Associative Grid Hosting — Re-derive FOUNDATION params from guide offsets (ADR-441).
 *
 * Thin foundation-specific caller πάνω από τους shared slot-writers (`derive-slots.ts`).
 * Η coordinate-slot λογική ΔΕΝ ζει πια εδώ — μοιράζεται με wall/column μέσω του ΕΝΟΣ SSoT
 * writer (Slice GEN). Εδώ μένει μόνο το foundation param-shape mapping (pad → position,
 * strip/tie-beam → start/end) + το unit scale.
 *
 * Slot mapping (ADR-441 Slice 0):
 *   start-x → start.x · start-y → start.y · end-x → end.x · end-y → end.y (γραμμικά)
 *   center-x → position.x · center-y → position.y (σημειακά: pad)
 *
 * @see bim/hosting/derive-slots.ts — shared slot→coordinate writers (SSoT)
 * @see bim/hosting/hosting-strategy.ts — per-kind strategy registry
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { FoundationParams } from '../types/foundation-types';
import type { GuideBinding } from './guide-binding-types';
import { mmScaleFor } from '../../utils/scene-units';
import { deriveLineSlots, derivePointSlots, type GuideOffsetLookup } from './derive-slots';

// Re-export ώστε οι υπάρχοντες consumers (reconciler, useHostingReconciler, follow-ghost)
// να μη χρειαστούν αλλαγή import path.
export type { GuideOffsetLookup };

/**
 * Re-derive `FoundationParams` από τα τρέχοντα guide offsets. Επιστρέφει νέα params ΜΟΝΟ
 * αν άλλαξε ένα τουλάχιστον coordinate, αλλιώς `null` (no-op). Immutable.
 */
export function deriveFoundationParamsFromGuides(
  params: FoundationParams,
  bindings: readonly GuideBinding[],
  getOffset: GuideOffsetLookup,
): FoundationParams | null {
  const scale = mmScaleFor(params);

  if (params.kind === 'pad') {
    const next = derivePointSlots(params.position, bindings, getOffset, scale);
    return next ? { ...params, position: { ...params.position, x: next.x, y: next.y } } : null;
  }

  const next = deriveLineSlots(params.start, params.end, bindings, getOffset, scale);
  if (!next) return null;
  return {
    ...params,
    start: { ...params.start, x: next.start.x, y: next.start.y },
    end: { ...params.end, x: next.end.x, y: next.end.y },
  };
}
