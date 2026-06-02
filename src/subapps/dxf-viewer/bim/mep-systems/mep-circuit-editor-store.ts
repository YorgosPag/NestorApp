/**
 * MepCircuitEditorStore — which existing circuit the Φ6 management UI is editing.
 *
 * The `MepSystemStore` owns the circuits themselves (truth); this tiny store
 * owns only the *ephemeral UI selection* — "which circuit is currently shown in
 * the contextual ribbon's Circuit-Properties panel". That choice is genuinely
 * not derivable from the scene when a panel sources more than one circuit (the
 * user must pick), so it lives in its own store rather than as a pure selector.
 *
 * `useMepCircuitEditorSync` reconciles `activeSystemId` against the live
 * candidates (selection → systems); the picker widget sets it explicitly. Zero
 * high-frequency subscriptions — CHECK 6B/6C safe.
 *
 * @see ./mep-circuit-editor.ts
 * @see ../../hooks/data/useMepCircuitEditorSync.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface MepCircuitEditorStoreState {
  /** The circuit (`MepSystem.id`) the management panel is editing, or none. */
  readonly activeSystemId: string | null;
  setActiveSystemId(systemId: string | null): void;
  getActiveSystemId(): string | null;
}

export const useMepCircuitEditorStore = create<MepCircuitEditorStoreState>()(
  subscribeWithSelector((set, get) => ({
    activeSystemId: null,
    setActiveSystemId: (systemId) => {
      if (get().activeSystemId === systemId) return; // referential-stable no-op
      set({ activeSystemId: systemId });
    },
    getActiveSystemId: () => get().activeSystemId,
  })),
);
