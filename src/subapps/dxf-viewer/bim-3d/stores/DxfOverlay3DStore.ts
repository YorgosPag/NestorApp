/**
 * DxfOverlay3DStore — Zustand store for the 2D DXF floor plan overlay in 3D mode.
 *
 * Feed: CanvasLayerStack pushes `dxfScene` whenever it changes (low-freq: entity edits).
 * Consumer: BimViewport3D subscribes and syncs DxfFloorPlanOverlay in Three.js.
 *
 * ADR-366 Phase 2 (DXF floor plan underlay). ADR-040 compliant: shell writes,
 * leaf subscribes — no high-freq path.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';

interface DxfOverlay3DStoreState {
  dxfScene: DxfScene | null;
  setDxfScene: (scene: DxfScene | null) => void;
}

export const useDxfOverlay3DStore = create<DxfOverlay3DStoreState>()(
  subscribeWithSelector((set) => ({
    dxfScene: null,
    setDxfScene: (dxfScene) => set({ dxfScene }),
  })),
);
