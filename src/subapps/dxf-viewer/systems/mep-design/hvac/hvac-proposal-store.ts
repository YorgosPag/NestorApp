/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-432 Slice 2 — HVAC (ventilation) auto-design **proposal store** (LOW-FREQUENCY).
 *
 * Holds the `DuctNetworkProposal` currently under review (Revit "Generate →
 * review → accept"). Single-writer / multi-reader module-level pub-sub, the exact
 * shape of `water-proposal-store.ts` — but it mutates ONLY on discrete user
 * actions:
 *   - `set(review)` — once, when the ribbon "Αυτόματος Αερισμός" runs the engine.
 *   - `reset()`     — once, on Accept or Reject.
 * There is NO per-frame / per-mousemove write. The ghost leaf subscribes with
 * `useHvacProposal()` and repaints only on these transitions (+ pan/zoom), so the
 * subscription is ADR-040-safe at the leaf layer (no high-frequency churn, and the
 * shell never subscribes — CHECK 6C).
 *
 * Transient by design: the proposal is never persisted. Accept turns it into real
 * duct entities via a `CompoundCommand`; the store is then cleared.
 *
 * @see ../water/water-proposal-store.ts (store-shape precedent / template)
 * @see ./design-hvac.ts (producer)
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../../../stores/createExternalStore';
import type { SceneUnits } from '../../../utils/scene-units';
import type { DuctNetworkProposal } from './hvac-design-types';

/**
 * The proposal under review plus the scene units it was generated in — the ghost
 * leaf needs `sceneUnits` to convert each run's duct Ø (mm) into a canvas-unit
 * width, and the accept handler reuses it to build the real segments at the same
 * scale.
 */
export interface HvacProposalReview {
  readonly proposal: DuctNetworkProposal;
  readonly sceneUnits: SceneUnits;
}

// SSoT pub/sub plumbing via createExternalStore (WAVE 2.6). `equals: Object.is`
// reproduces the two identity guards the hand-rolled store used: `set` bails when
// the same review reference is re-set, and `reset()` (→ set(null)) bails when
// already idle. Behaviour byte-identical.
const store = createExternalStore<HvacProposalReview | null>(null, { equals: Object.is });

export const hvacProposalStore = {
  /** Writer — called once by the ribbon bridge when the engine produces a proposal. */
  set(next: HvacProposalReview): void {
    store.set(next);
  },
  /** Clear the proposal (Accept committed it, or Reject discarded it). */
  reset(): void {
    store.set(null);
  },
  /** Non-React reader — for the accept/reject handlers. */
  get(): HvacProposalReview | null {
    return store.get();
  },
};

/** React subscription. Returns the review under way, or `null` when idle. */
export function useHvacProposal(): HvacProposalReview | null {
  return useSyncExternalStore(store.subscribe, store.get, () => null);
}
