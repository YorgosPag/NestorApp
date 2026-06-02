/**
 * MepSystemStore — Zustand store for loaded MEP systems (ADR-408 Φ2).
 *
 * Systems are geometry-less and NOT scene entities, so they live in their own
 * store (mirror of how `envelope-spec-store` holds non-geometric BIM state).
 * `useMepSystemPersistence` is the sole writer (subscribe → `setSystems`,
 * optimistic create/update/delete). Read consumers (color-by-system, the
 * assignment UI) land in Φ5.
 *
 * @see ./mep-system-firestore-service.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { MepSystemEntity } from '../types/mep-system-types';

export interface MepSystemStoreState {
  readonly systems: readonly MepSystemEntity[];
  setSystems(systems: readonly MepSystemEntity[]): void;
  upsertSystem(system: MepSystemEntity): void;
  removeSystem(systemId: string): void;
  getSystems(): readonly MepSystemEntity[];
}

export const useMepSystemStore = create<MepSystemStoreState>()(
  subscribeWithSelector((set, get) => ({
    systems: [],
    setSystems: (systems) => set({ systems }),
    upsertSystem: (system) =>
      set((s) => {
        const idx = s.systems.findIndex((x) => x.id === system.id);
        if (idx === -1) return { systems: [...s.systems, system] };
        const next = s.systems.slice();
        next[idx] = system;
        return { systems: next };
      }),
    removeSystem: (systemId) =>
      set((s) => ({ systems: s.systems.filter((x) => x.id !== systemId) })),
    getSystems: () => get().systems,
  })),
);
