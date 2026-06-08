/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-426 Slice 2 — Water-supply auto-design **proposal store** (LOW-FREQUENCY).
 *
 * Holds the `WaterNetworkProposal` currently under review (Revit "Generate →
 * review → accept"). Single-writer / multi-reader module-level pub-sub, the exact
 * shape of `bim/slabs/slab-preview-store.ts` — but unlike the slab/cursor/transform
 * stores this one mutates ONLY on discrete user actions:
 *   - `set(proposal)`  — once, when the ribbon "Αυτόματη Ύδρευση" runs the engine.
 *   - `reset()`        — once, on Accept or Reject.
 * There is NO per-frame / per-mousemove write. The ghost leaf subscribes with
 * `useWaterProposal()` and repaints only on these transitions (+ pan/zoom), so the
 * subscription is ADR-040-safe at the leaf layer (no high-frequency churn, and the
 * shell never subscribes — CHECK 6C).
 *
 * Transient by design: the proposal is never persisted (ADR-426 §2). Accept turns
 * it into real entities via a `CompoundCommand`; the store is then cleared.
 *
 * @see ../../../bim/slabs/slab-preview-store.ts (store-shape precedent)
 * @see ./design-water-supply.ts (producer)
 */

import { useSyncExternalStore } from 'react';
import type { SceneUnits } from '../../../utils/scene-units';
import type { WaterNetworkProposal } from './water-design-types';

/**
 * The proposal under review plus the scene units it was generated in — the ghost
 * leaf needs `sceneUnits` to convert each run's DN (mm) into a canvas-unit width,
 * and the accept handler reuses it to build the real segments at the same scale.
 */
export interface WaterProposalReview {
  readonly proposal: WaterNetworkProposal;
  readonly sceneUnits: SceneUnits;
}

type Listener = () => void;

let currentReview: WaterProposalReview | null = null;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): WaterProposalReview | null {
  return currentReview;
}

function getServerSnapshot(): WaterProposalReview | null {
  return null;
}

export const waterProposalStore = {
  /** Writer — called once by the ribbon bridge when the engine produces a proposal. */
  set(next: WaterProposalReview): void {
    if (currentReview === next) return;
    currentReview = next;
    for (const l of listeners) l();
  },
  /** Clear the proposal (Accept committed it, or Reject discarded it). */
  reset(): void {
    if (currentReview === null) return;
    currentReview = null;
    for (const l of listeners) l();
  },
  /** Non-React reader — for the accept/reject handlers. */
  get(): WaterProposalReview | null {
    return currentReview;
  },
};

/** React subscription. Returns the review under way, or `null` when idle. */
export function useWaterProposal(): WaterProposalReview | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
