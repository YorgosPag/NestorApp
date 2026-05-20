/**
 * Selection3DStore — click-selection state for the 3D viewport BIM entity panel.
 *
 * Updated by ThreeJsSceneManager.selectBimEntity() on click raycast.
 * Consumed by BimEntityCardPanel (ADR-040 micro-leaf).
 *
 * ADR-366 A.1.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface Selection3DState {
  selectedBimId: string | null;
  selectedBimType: string | null;
}

interface Selection3DActions {
  selectEntity(bimId: string, bimType: string): void;
  clearSelection(): void;
}

type Selection3DStoreType = Selection3DState & Selection3DActions;

export const useSelection3DStore = create<Selection3DStoreType>()(
  subscribeWithSelector((set) => ({
    selectedBimId: null,
    selectedBimType: null,

    selectEntity: (bimId, bimType) =>
      set({ selectedBimId: bimId, selectedBimType: bimType }),

    clearSelection: () =>
      set({ selectedBimId: null, selectedBimType: null }),
  })),
);
