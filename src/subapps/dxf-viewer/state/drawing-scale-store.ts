/**
 * ADR-375 Phase B.1 — Drawing Scale Store (Zustand, in-memory).
 *
 * Owns the user-selected drawing scale denominator (e.g. 100 → 1:100).
 * Decoupled from viewport zoom (Revit annotation scale pattern).
 * Phase B.2 adds Firestore persistence.
 *
 * Non-React consumers (BIM renderers): call `useDrawingScaleStore.getState().drawingScale`.
 */

import { create } from 'zustand';

export const DEFAULT_DRAWING_SCALE = 100;
export const DRAWING_SCALE_MIN = 1;
export const DRAWING_SCALE_MAX = 10000;

/** Six scale-column denominator presets matching bim-pen-table.ts SCALE_COLUMNS. */
export const DRAWING_SCALE_PRESETS = [10, 20, 50, 100, 200, 500] as const;
export type DrawingScalePreset = typeof DRAWING_SCALE_PRESETS[number];

interface DrawingScaleState {
  drawingScale: number;
  setDrawingScale: (scale: number) => void;
  resetDrawingScale: () => void;
}

export const useDrawingScaleStore = create<DrawingScaleState>((set) => ({
  drawingScale: DEFAULT_DRAWING_SCALE,
  setDrawingScale: (scale) => {
    const clamped = Math.max(
      DRAWING_SCALE_MIN,
      Math.min(DRAWING_SCALE_MAX, Math.round(scale)),
    );
    set({ drawingScale: clamped });
  },
  resetDrawingScale: () => set({ drawingScale: DEFAULT_DRAWING_SCALE }),
}));
