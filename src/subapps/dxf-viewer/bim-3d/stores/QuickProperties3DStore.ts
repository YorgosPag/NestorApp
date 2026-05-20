/**
 * QuickProperties3DStore — hover state for the 3D viewport BIM entity tooltip.
 *
 * Updated by BimViewport3D (800ms debounced raycasting on mousemove).
 * Consumed by QuickProperties3DHoverPopover (ADR-040 micro-leaf).
 *
 * ADR-366 B.2.Q1.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface QuickProperties3DState {
  hoveredBimId: string | null;
  hoveredBimType: string | null;
  cursorX: number;
  cursorY: number;
}

interface QuickProperties3DActions {
  setHovered(bimId: string, bimType: string, x: number, y: number): void;
  clearHover(): void;
}

type QuickProperties3DStoreType = QuickProperties3DState & QuickProperties3DActions;

export const useQuickProperties3DStore = create<QuickProperties3DStoreType>()(
  subscribeWithSelector((set) => ({
    hoveredBimId: null,
    hoveredBimType: null,
    cursorX: 0,
    cursorY: 0,

    setHovered: (bimId, bimType, x, y) =>
      set({ hoveredBimId: bimId, hoveredBimType: bimType, cursorX: x, cursorY: y }),

    clearHover: () =>
      set({ hoveredBimId: null, hoveredBimType: null, cursorX: 0, cursorY: 0 }),
  })),
);
