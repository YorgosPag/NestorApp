/**
 * Associative Grid Hosting — Reconciler (ADR-441, Slice 3).
 *
 * Pure βήμα του follow-on-move: δοθέντος ενός συνόλου hosted foundation entities
 * και των τρεχόντων guide offsets, υπολογίζει την **ελάχιστη** λίστα updates
 * (params + geometry + validation) — μόνο για όσες entities όντως άλλαξαν.
 *
 * ΜΗΔΕΝ side-effects, ΜΗΔΕΝ scene access: το stateful/imperative κομμάτι ζει στον
 * `useHostingReconciler` subscriber (ADR-040). Εδώ μόνο καθαρός υπολογισμός →
 * εύκολα testable + RAF-throttle-friendly.
 *
 * Inverted index (`Map<guideId, Set<entityId>>`): rebuild ΜΟΝΟ όταν αλλάζει το
 * σύνολο των hosted entities (scene add/remove/undo), ΟΧΙ σε κάθε guide move. Ο
 * subscriber το χρησιμοποιεί για να βρει ποιες entities επηρεάζει ένας
 * μετακινημένος άξονας, χωρίς full scan όλης της σκηνής.
 *
 * @see bim/hosting/derive-params-from-guides.ts — slot→coordinate (pure)
 * @see bim/geometry/foundation-geometry.ts — geometry SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { FoundationEntity, FoundationGeometry, FoundationParams } from '../types/foundation-types';
import type { BimValidation } from '../types/bim-base';
import { computeFoundationGeometry } from '../geometry/foundation-geometry';
import { validateFoundationParams } from '../validators/foundation-validator';
import { hasGuideBindings } from './guide-binding-types';
import { deriveFoundationParamsFromGuides, type GuideOffsetLookup } from './derive-params-from-guides';

/** Ένα έτοιμο-προς-εφαρμογή update για μία hosted entity (re-derived). */
export interface HostingUpdate {
  readonly id: string;
  readonly nextParams: FoundationParams;
  readonly nextGeometry: FoundationGeometry;
  readonly nextValidation: BimValidation;
}

/**
 * Inverted index `guideId → set of hosted entity ids`. Rebuild όταν το σύνολο
 * των hosted entities αλλάζει (scene add/remove). Pure.
 */
export function buildHostingIndex(
  entities: readonly FoundationEntity[],
): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const e of entities) {
    if (!hasGuideBindings(e)) continue;
    for (const b of e.guideBindings) {
      let bucket = index.get(b.guideId);
      if (!bucket) {
        bucket = new Set<string>();
        index.set(b.guideId, bucket);
      }
      bucket.add(e.id);
    }
  }
  return index;
}

/**
 * Re-derive μία hosted entity → `HostingUpdate` ή `null` αν δεν άλλαξε τίποτα.
 * Geometry + validation recomputed από τις νέες params (SSoT pure functions).
 */
function reconcileOne(
  entity: FoundationEntity,
  getOffset: GuideOffsetLookup,
): HostingUpdate | null {
  if (!hasGuideBindings(entity)) return null;
  const nextParams = deriveFoundationParamsFromGuides(entity.params, entity.guideBindings, getOffset);
  if (!nextParams) return null;
  return {
    id: entity.id,
    nextParams,
    nextGeometry: computeFoundationGeometry(nextParams),
    nextValidation: validateFoundationParams(nextParams).bimValidation,
  };
}

/**
 * Reconcile ένα σύνολο hosted entities ως προς τα τρέχοντα guide offsets.
 * Επιστρέφει ΜΟΝΟ τα updates που πραγματικά άλλαξαν (only-changed) — άδειο array
 * όταν τίποτα δεν μετακινήθηκε (ο subscriber παραλείπει το scene write).
 */
export function reconcileHostedFoundations(
  entities: readonly FoundationEntity[],
  getOffset: GuideOffsetLookup,
): HostingUpdate[] {
  const updates: HostingUpdate[] = [];
  for (const e of entities) {
    const update = reconcileOne(e, getOffset);
    if (update) updates.push(update);
  }
  return updates;
}
