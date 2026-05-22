/**
 * ADR-366 §C.6.Q4–Q5 — Crop Region Zustand SSoT.
 *
 * Owns the full lifecycle of the crop region tool:
 *  idle → dragging → editing (handle resize) → committed
 *
 * Coordinates: normalized 0-1 viewport space (resolution-independent).
 * Crop data is ephemeral until committed → then persisted in
 * ViewMode3DStore.finalRenderConfig.cropRegion.
 *
 * @see ADR-366 §C.6 crop region decisions
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { CropRegionRect } from '../../../stores/ViewMode3DStore';

export type HandleId = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br';
export type CropEditState = 'idle' | 'dragging' | 'editing' | 'committed';

interface CropRegionState {
  editState: CropEditState;
  rectangle: CropRegionRect | null;
  depthRangeEnabled: boolean;
  nearNorm: number;
  farNorm: number;
  selectedHandle: HandleId | null;
  showPreview: boolean;
  /** Drag start point (normalized). */
  dragStart: { x: number; y: number } | null;
}

interface CropRegionActions {
  startDrag(startNormX: number, startNormY: number): void;
  updateDrag(normX: number, normY: number): void;
  commitDrag(): void;
  startHandleDrag(handle: HandleId): void;
  updateHandleDrag(normX: number, normY: number): void;
  commitEdit(): void;
  cancelEdit(): void;
  reset(): void;
  setShowPreview(v: boolean): void;
  setDepthRange(near: number, far: number): void;
  setDepthRangeEnabled(v: boolean): void;
}

type CropRegionStore = CropRegionState & CropRegionActions;

const INITIAL: CropRegionState = {
  editState: 'idle',
  rectangle: null,
  depthRangeEnabled: false,
  nearNorm: 0,
  farNorm: 1,
  selectedHandle: null,
  showPreview: true,
  dragStart: null,
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function normalizeRect(r: CropRegionRect): CropRegionRect {
  return {
    x: Math.min(r.x, r.x + r.w),
    y: Math.min(r.y, r.y + r.h),
    w: Math.abs(r.w),
    h: Math.abs(r.h),
  };
}

export const useCropRegionStore = create<CropRegionStore>()(
  subscribeWithSelector((set, get) => ({
    ...INITIAL,

    startDrag(startNormX, startNormY) {
      set({
        editState: 'dragging',
        rectangle: { x: startNormX, y: startNormY, w: 0, h: 0 },
        dragStart: { x: startNormX, y: startNormY },
        selectedHandle: null,
      });
    },

    updateDrag(normX, normY) {
      const start = get().dragStart;
      if (!start || get().editState !== 'dragging') return;
      set({
        rectangle: {
          x: start.x,
          y: start.y,
          w: clamp(normX - start.x, -1, 1),
          h: clamp(normY - start.y, -1, 1),
        },
      });
    },

    commitDrag() {
      const rect = get().rectangle;
      if (!rect || (Math.abs(rect.w) < 0.01 && Math.abs(rect.h) < 0.01)) {
        set({ editState: 'idle', rectangle: null, dragStart: null });
        return;
      }
      set({
        editState: 'editing',
        rectangle: normalizeRect(rect),
        dragStart: null,
      });
    },

    startHandleDrag(handle) {
      set({ selectedHandle: handle });
    },

    updateHandleDrag(normX, normY) {
      const rect = get().rectangle;
      if (!rect || !get().selectedHandle) return;
      const h = get().selectedHandle!;
      let { x, y, w, h: rh } = rect;
      const r = x + w;
      const b = y + rh;
      if (h.includes('l')) { x = clamp(normX, 0, r - 0.01); w = r - x; }
      if (h.includes('r')) { w = clamp(normX - x, 0.01, 1 - x); }
      if (h.includes('t')) { y = clamp(normY, 0, b - 0.01); rh = b - y; }
      if (h.includes('b')) { rh = clamp(normY - y, 0.01, 1 - y); }
      if (h === 'ml' || h === 'mr') { y = rect.y; rh = rect.h; }
      if (h === 'tc' || h === 'bc') { x = rect.x; w = rect.w; }
      set({ rectangle: { x, y, w, h: rh } });
    },

    commitEdit() {
      set({ editState: 'committed', selectedHandle: null });
    },

    cancelEdit() {
      set({ editState: 'idle', rectangle: null, selectedHandle: null, dragStart: null });
    },

    reset() {
      set({ ...INITIAL });
    },

    setShowPreview(v) {
      set({ showPreview: v });
    },

    setDepthRange(near, far) {
      set({ nearNorm: near, farNorm: far });
    },

    setDepthRangeEnabled(v) {
      set({ depthRangeEnabled: v });
    },
  }))
);
