/**
 * active-storey-store — dedicated Zustand SSoT holding the current
 * {@link ActiveStoreyContext} (ADR-448 Phase 1).
 *
 * ONE writer (`useActiveStoreySync` React hook) → MANY readers. Readers in
 * non-React contexts (e.g. the Zustand-subscriber callbacks that drive
 * `resyncBimScene`) read the context synchronously via `getState()`, mirroring
 * how `Bim3DEntitiesStore.activeLevelId` is consumed. Zero React state here, so
 * it is safe to read from any context.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-448-storey-aware-dxf-viewer.md
 */

import { create } from 'zustand';
import type { ActiveStoreyContext } from './active-storey-context';

interface ActiveStoreyStoreState {
  /** Active single-floor storey context, or null when no floor is linked. */
  context: ActiveStoreyContext | null;
  setContext: (context: ActiveStoreyContext | null) => void;
}

export const useActiveStoreyStore = create<ActiveStoreyStoreState>((set) => ({
  context: null,
  setContext: (context) => set({ context }),
}));
