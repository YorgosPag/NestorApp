/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-430 Slice 2 — Electrical-strong auto-design **proposal store** (LOW-FREQUENCY).
 *
 * Holds the `ElectricalNetworkProposal` currently under review (Revit "Generate →
 * review → accept"). Single-writer / multi-reader module-level pub-sub, the exact
 * shape of `heating-proposal-store.ts` — it mutates ONLY on discrete user actions:
 *   - `set(review)`  — once, when the ribbon "Αυτόματος Ηλεκτρολογικός" runs the engine.
 *   - `reset()`      — once, on Accept or Reject.
 * There is NO per-frame / per-mousemove write. The ghost leaf subscribes with
 * `useElectricalProposal()` and repaints only on these transitions (+ pan/zoom), so it
 * is ADR-040-safe (no high-frequency churn; the shell never subscribes — CHECK 6C).
 *
 * The review carries the proposal PLUS the pre-built circuit `MepSystem` entities (so
 * Accept dispatches them with ids stable from preview) AND the pre-computed home-run
 * `wirePaths` (so the ghost draws the wires WITHOUT needing the scene — the bridge,
 * which has the scene, resolves them once at Generate). Transient by design — the
 * proposal is never persisted; Accept turns the systems into real entities via a
 * `CompoundCommand` and the store is cleared.
 *
 * @see ../heating/heating-proposal-store.ts (store-shape precedent)
 * @see ./design-electrical-strong.ts (producer)
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../../../stores/createExternalStore';
import type { MepSystemEntity } from '../../../bim/types/mep-system-types';
import type { CircuitWirePath } from '../../../bim/mep-systems/mep-wire-routing';
import type { SceneUnits } from '../../../utils/scene-units';

/**
 * The discipline-agnostic summary both proposals satisfy (ADR-431). The store + ghost
 * never read the discipline-specific circuit/channel list — only the systems + wire
 * paths — so the strong `ElectricalNetworkProposal` and the weak `WeakNetworkProposal`
 * both flow through this SAME store as their shared summary.
 */
export interface ProposalReviewSummary {
  readonly warnings: readonly string[];
  readonly storeyId: string;
  readonly skippedAlreadyCircuited: number;
}

/** The proposal under review + the entities Accept will create + the ghost's wire paths. */
export interface ElectricalProposalReview {
  readonly proposal: ProposalReviewSummary;
  /** Pre-built circuit systems (ids stable preview→commit) — Accept creates these. */
  readonly systemEntities: readonly MepSystemEntity[];
  /** Pre-routed home-run wires (panel→members per circuit) — the ghost paints these. */
  readonly wirePaths: readonly CircuitWirePath[];
  /**
   * Active scene units (mm/cm/m) — carried so the 3D proposal ghost can scale the wire
   * plan coordinates to metres (the segment disciplines carry this on their networks; the
   * electrical review carries it here for parity). Set by the ribbon bridge at Generate.
   */
  readonly sceneUnits: SceneUnits;
}

// SSoT pub/sub plumbing via createExternalStore (WAVE 2.6). `equals: Object.is`
// reproduces the two identity guards the hand-rolled store used: `set` bails when
// the same review reference is re-set, and `reset()` (→ set(null)) bails when
// already idle. Behaviour byte-identical.
const store = createExternalStore<ElectricalProposalReview | null>(null, { equals: Object.is });

export const electricalProposalStore = {
  /** Writer — called once by the ribbon bridge when the engine produces a proposal. */
  set(next: ElectricalProposalReview): void {
    store.set(next);
  },
  /** Clear the proposal (Accept committed it, or Reject discarded it). */
  reset(): void {
    store.set(null);
  },
  /** Non-React reader — for the accept/reject handlers. */
  get(): ElectricalProposalReview | null {
    return store.get();
  },
};

/** React subscription. Returns the review under way, or `null` when idle. */
export function useElectricalProposal(): ElectricalProposalReview | null {
  return useSyncExternalStore(store.subscribe, store.get, () => null);
}
