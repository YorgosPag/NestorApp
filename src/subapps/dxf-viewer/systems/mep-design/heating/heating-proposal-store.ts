/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-428 Slice 2 — Heating (hydronic) auto-design **proposal store** (LOW-FREQUENCY).
 *
 * Holds the `HeatingNetworkProposal` currently under review (Revit "Generate →
 * review → accept"). Single-writer / multi-reader module-level pub-sub, the exact
 * shape of `water-proposal-store.ts` — but, like its water counterpart, this store
 * mutates ONLY on discrete user actions:
 *   - `set(proposal)`  — once, when the ribbon "Αυτόματη Θέρμανση" runs the engine.
 *   - `reset()`        — once, on Accept or Reject.
 * There is NO per-frame / per-mousemove write. The ghost leaf subscribes with
 * `useHeatingProposal()` and repaints only on these transitions (+ pan/zoom), so the
 * subscription is ADR-040-safe at the leaf layer (no high-frequency churn, and the
 * shell never subscribes — CHECK 6C).
 *
 * Transient by design: the proposal is never persisted (ADR-428 §2). Accept turns
 * it into real entities via a `CompoundCommand`; the store is then cleared.
 *
 * @see ../water/water-proposal-store.ts (store-shape precedent)
 * @see ./design-heating.ts (producer)
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../../../stores/createExternalStore';
import type { SceneUnits } from '../../../utils/scene-units';
import type { HeatingNetworkProposal } from './heating-design-types';

/**
 * The proposal under review plus the scene units it was generated in — the ghost
 * leaf needs `sceneUnits` to convert each run's DN (mm) into a canvas-unit width,
 * and the accept handler reuses it to build the real segments at the same scale.
 */
export interface HeatingProposalReview {
  readonly proposal: HeatingNetworkProposal;
  readonly sceneUnits: SceneUnits;
}

// SSoT pub/sub plumbing via createExternalStore (WAVE 2.6). `equals: Object.is`
// reproduces the two identity guards the hand-rolled store used: `set` bails when
// the same review reference is re-set, and `reset()` (→ set(null)) bails when
// already idle. Behaviour byte-identical.
const store = createExternalStore<HeatingProposalReview | null>(null, { equals: Object.is });

export const heatingProposalStore = {
  /** Writer — called once by the ribbon bridge when the engine produces a proposal. */
  set(next: HeatingProposalReview): void {
    store.set(next);
  },
  /** Clear the proposal (Accept committed it, or Reject discarded it). */
  reset(): void {
    store.set(null);
  },
  /** Non-React reader — for the accept/reject handlers. */
  get(): HeatingProposalReview | null {
    return store.get();
  },
};

/** React subscription. Returns the review under way, or `null` when idle. */
export function useHeatingProposal(): HeatingProposalReview | null {
  return useSyncExternalStore(store.subscribe, store.get, () => null);
}
