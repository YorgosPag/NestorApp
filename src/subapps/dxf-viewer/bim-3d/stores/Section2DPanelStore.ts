/**
 * Section2DPanelStore — Zustand SSoT για ADR-366 §A.3 Q3 Phase 7.0B
 * (2D Live Section Panel UI state).
 *
 * Owns visibility + active plane selection + panel height. Drives the
 * Section2DPanel component (ADR-040 micro-leaf).
 *
 * Consumers:
 *   - Section2DPanel        → reads visible/activePlaneId/heightPx
 *   - Section3DPanelTab     → toggle button + plane selector
 *   - section-scene-sync.ts → reads activePlaneId σε syncScene()
 *
 * Default: hidden, no active plane, height = 280px.
 *
 * @see ADR-366 §A.3 Q3 — 2D Section Panel decision
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  SECTION_2D_PANEL_DEFAULT_HEIGHT_PX,
  SECTION_2D_PANEL_MIN_HEIGHT_PX,
  SECTION_2D_PANEL_MAX_HEIGHT_PX,
} from '../2d-section/section-2d-constants';

interface Section2DPanelState {
  visible: boolean;
  activePlaneId: string | null;
  heightPx: number;
}

interface Section2DPanelActions {
  setVisible(v: boolean): void;
  setActivePlaneId(id: string | null): void;
  setHeightPx(h: number): void;
  resetToDefault(): void;
}

type Section2DPanelStore = Section2DPanelState & Section2DPanelActions;

const INITIAL_STATE: Section2DPanelState = {
  visible: false,
  activePlaneId: null,
  heightPx: SECTION_2D_PANEL_DEFAULT_HEIGHT_PX,
};

function clampHeight(h: number): number {
  return Math.max(
    SECTION_2D_PANEL_MIN_HEIGHT_PX,
    Math.min(SECTION_2D_PANEL_MAX_HEIGHT_PX, h),
  );
}

export const useSection2DPanelStore = create<Section2DPanelStore>()(
  subscribeWithSelector((set) => ({
    ...INITIAL_STATE,

    setVisible(v) {
      set({ visible: v });
    },

    setActivePlaneId(id) {
      set({ activePlaneId: id });
    },

    setHeightPx(h) {
      set({ heightPx: clampHeight(h) });
    },

    resetToDefault() {
      set(INITIAL_STATE);
    },
  })),
);
