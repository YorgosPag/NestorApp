/**
 * Associative Grid Hosting — Reconciler (ADR-441, Slice 3 + Slice GEN generic).
 *
 * Pure βήμα του follow-on-move: δοθέντος ενός συνόλου hosted entities και των τρεχόντων
 * guide offsets, υπολογίζει την **ελάχιστη** λίστα updates (params + geometry + validation)
 * — μόνο για όσες entities όντως άλλαξαν. Slice GEN: **kind-generic** μέσω του
 * `HostingStrategy` registry (foundation + wall + column) αντί foundation-only branch.
 *
 * ΜΗΔΕΝ side-effects, ΜΗΔΕΝ scene access: το stateful/imperative κομμάτι ζει στον
 * `useHostingReconciler` subscriber (ADR-040). Εδώ μόνο καθαρός υπολογισμός →
 * εύκολα testable + RAF-throttle-friendly.
 *
 * Inverted index (`Map<guideId, Set<entityId>>`): rebuild ΜΟΝΟ όταν αλλάζει το σύνολο των
 * hosted entities (scene add/remove/undo), ΟΧΙ σε κάθε guide move. Kind-agnostic — διαβάζει
 * μόνο `guideBindings`.
 *
 * @see bim/hosting/hosting-strategy.ts — per-kind derive + recompute dispatch
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { AnySceneEntity } from '../../types/scene';
import { hasGuideBindings } from './guide-binding-types';
import { getHostingStrategy } from './hosting-strategy';
import type { HostingUpdate } from './hosting-strategy-types';
import type { GuideOffsetLookup } from './derive-slots';

export type { HostingUpdate } from './hosting-strategy-types';

/**
 * Inverted index `guideId → set of hosted entity ids`. Rebuild όταν το σύνολο των hosted
 * entities αλλάζει (scene add/remove). Pure, kind-agnostic.
 */
export function buildHostingIndex(
  entities: readonly AnySceneEntity[],
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
 * Re-derive μία hosted entity → `HostingUpdate` ή `null`. Dispatch στην per-kind strategy
 * (foundation/wall/column)· entities χωρίς strategy ή χωρίς bindings → `null`.
 */
function reconcileOne(
  entity: AnySceneEntity,
  getOffset: GuideOffsetLookup,
): HostingUpdate | null {
  if (!hasGuideBindings(entity)) return null;
  const strategy = getHostingStrategy(entity.type);
  return strategy ? strategy.reconcile(entity, getOffset) : null;
}

/**
 * Reconcile ένα σύνολο hosted entities ως προς τα τρέχοντα guide offsets. Επιστρέφει ΜΟΝΟ
 * τα updates που πραγματικά άλλαξαν (only-changed) — άδειο array όταν τίποτα δεν
 * μετακινήθηκε (ο subscriber παραλείπει το scene write).
 */
export function reconcileHostedEntities(
  entities: readonly AnySceneEntity[],
  getOffset: GuideOffsetLookup,
): HostingUpdate[] {
  const updates: HostingUpdate[] = [];
  for (const e of entities) {
    const update = reconcileOne(e, getOffset);
    if (update) updates.push(update);
  }
  return updates;
}

/**
 * Backward-compat alias (ADR-441 Slice 3). Foundation-era callers (follow-ghost, tests)
 * συνεχίζουν να δουλεύουν — η υλοποίηση είναι πλέον kind-generic.
 */
export const reconcileHostedFoundations = reconcileHostedEntities;
