/**
 * Associative Grid Hosting — Re-derive params from guide offsets (ADR-441, Slice 3).
 *
 * Pure SSoT step του follow-on-move: όταν μετακινηθεί ένας άξονας κανάβου, κάθε
 * hosted entity ξαναγράφει ΜΟΝΟ τα coordinates που ελέγχει ο άξονας, διαβάζοντας
 * το **τρέχον** offset. Καμία kind-specific γεωμετρία εδώ — μόνο slot→coordinate
 * writes· η γεωμετρία βγαίνει μετά από το SSoT `computeFoundationGeometry`.
 *
 * Idempotent: re-derive με ίδια offsets → ίδια params → επιστρέφει `null` (no-op,
 * ώστε ο reconciler να μη γράφει στη σκηνή χωρίς λόγο). Immutable: ποτέ mutate
 * το input — νέο `FoundationParams` object όταν αλλάζει κάτι.
 *
 * Slot mapping (ADR-441 Slice 0):
 *   start-x → start.x · start-y → start.y · end-x → end.x · end-y → end.y
 *   (γραμμικά: strip / tie-beam)
 *   center-x → position.x · center-y → position.y (σημειακά: pad)
 *
 * v1: μόνο foundation entities φέρουν bindings (από `buildStripGridFromGuides`).
 * Όταν αύριο wall/column/beam αποκτήσουν bindings, αυτό γίνεται strategy registry
 * ανά kind· η coordinate-slot λογική παραμένει η ίδια.
 *
 * @see bim/hosting/guide-binding-types.ts — slot-based hosting model
 * @see bim/geometry/foundation-geometry.ts — geometry re-derive (SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { FoundationParams } from '../types/foundation-types';
import type { GuideBinding } from './guide-binding-types';
import { mmScaleFor } from '../../utils/scene-units';

/**
 * Scene-units μετατόπιση ενός binding endpoint: το `extend` (mm, signed) →
 * scene units μέσω του SSoT `mmScaleFor`. `undefined` extend → 0 (καμία
 * μετατόπιση). Conversion ΜΟΝΟ στο extend term — το offset μένει σκέτο.
 */
function extendInSceneUnits(binding: GuideBinding, scale: number): number {
  return binding.extend !== undefined ? binding.extend * scale : 0;
}

/**
 * Lookup του τρέχοντος offset ενός άξονα. Επιστρέφει `undefined` αν ο άξονας
 * δεν υπάρχει πλέον (διαγραμμένος) ή είναι διαγώνιος (XZ — δεν έχει 1D offset):
 * τότε το αντίστοιχο slot αγνοείται και η entity κρατά το τελευταίο coordinate.
 */
export type GuideOffsetLookup = (guideId: string) => number | undefined;

/**
 * Re-derive `FoundationParams` από τα τρέχοντα guide offsets. Επιστρέφει νέα
 * params ΜΟΝΟ αν άλλαξε ένα τουλάχιστον coordinate, αλλιώς `null` (no-op).
 */
export function deriveFoundationParamsFromGuides(
  params: FoundationParams,
  bindings: readonly GuideBinding[],
  getOffset: GuideOffsetLookup,
): FoundationParams | null {
  const scale = mmScaleFor(params);

  if (params.kind === 'pad') {
    let { x, y } = params.position;
    let changed = false;
    for (const b of bindings) {
      const off = getOffset(b.guideId);
      if (off === undefined) continue;
      const target = off + extendInSceneUnits(b, scale);
      if (b.slot === 'center-x' && x !== target) { x = target; changed = true; }
      else if (b.slot === 'center-y' && y !== target) { y = target; changed = true; }
    }
    return changed ? { ...params, position: { ...params.position, x, y } } : null;
  }

  // strip / tie-beam (line-based)
  let sx = params.start.x, sy = params.start.y;
  let ex = params.end.x, ey = params.end.y;
  let changed = false;
  for (const b of bindings) {
    const off = getOffset(b.guideId);
    if (off === undefined) continue;
    const target = off + extendInSceneUnits(b, scale);
    if (b.slot === 'start-x' && sx !== target) { sx = target; changed = true; }
    else if (b.slot === 'start-y' && sy !== target) { sy = target; changed = true; }
    else if (b.slot === 'end-x' && ex !== target) { ex = target; changed = true; }
    else if (b.slot === 'end-y' && ey !== target) { ey = target; changed = true; }
  }
  if (!changed) return null;
  return {
    ...params,
    start: { ...params.start, x: sx, y: sy },
    end: { ...params.end, x: ex, y: ey },
  };
}
