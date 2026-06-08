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

type Listener = () => void;

let currentReview: HeatingProposalReview | null = null;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): HeatingProposalReview | null {
  return currentReview;
}

function getServerSnapshot(): HeatingProposalReview | null {
  return null;
}

export const heatingProposalStore = {
  /** Writer — called once by the ribbon bridge when the engine produces a proposal. */
  set(next: HeatingProposalReview): void {
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
  get(): HeatingProposalReview | null {
    return currentReview;
  },
};

/** React subscription. Returns the review under way, or `null` when idle. */
export function useHeatingProposal(): HeatingProposalReview | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
