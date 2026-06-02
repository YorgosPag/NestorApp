/**
 * MEP System Mutator port — ADR-408 Φ4.
 *
 * Module-level bridge that lets non-React command objects mutate MEP systems
 * through the **single Firestore writer** (`useMepSystemPersistence`). The
 * persistence hook registers its imperative api on mount via
 * `setMepSystemMutator` and clears it on unmount; the cascade commands
 * (`UpdateMepSystemParamsCommand` / `DissolveMepSystemCommand`) read it via
 * `getMepSystemMutator`.
 *
 * Same pattern as `wall-cascade-delete-store.ts` / `cad-toggle-state.ts`: a
 * mutable module singleton bridging hook-owned services to the command layer.
 * SSoT is preserved — the commands never touch Firestore directly; they only
 * invoke the hook api, which stays the sole writer of `floorplan_mep_systems`.
 *
 * Null-safe: if no host is mounted (commands replayed in a headless test, or
 * before the viewer is interactive) the getter returns `null` and callers
 * no-op — the optimistic store stays the source of truth either way.
 *
 * @see ./mep-system-store.ts
 * @see ../../hooks/data/useMepSystemPersistence.ts — the registrant
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { MepSystemEntity, MepSystemParams } from '../types/mep-system-types';

/** Imperative system-mutation surface the command layer depends on. */
export interface MepSystemMutator {
  /**
   * Create a system **id-preserving** (the entity carries a pre-minted
   * enterprise id) — optimistic store + Firestore write. Used by
   * `CreateMepSystemCommand` (Φ5 circuit UI) so create/undo/redo are id-stable.
   */
  createSystem(entity: MepSystemEntity): void;
  /** Patch a system's params (optimistic store update + Firestore update). */
  updateSystemParams(systemId: string, params: MepSystemParams): void;
  /** Delete a system (dissolve a circuit) — optimistic store + Firestore delete. */
  dissolveSystem(systemId: string): void;
  /** Re-create a previously dissolved system **id-preserving** (undo). */
  restoreSystem(entity: MepSystemEntity): void;
}

let _mutator: MepSystemMutator | null = null;

/** Register (or clear, with `null`) the active mutator. Called by the host hook. */
export function setMepSystemMutator(mutator: MepSystemMutator | null): void {
  _mutator = mutator;
}

/** The active mutator, or `null` when no persistence host is mounted. */
export function getMepSystemMutator(): MepSystemMutator | null {
  return _mutator;
}
