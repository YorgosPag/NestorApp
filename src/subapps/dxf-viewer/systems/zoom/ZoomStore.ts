'use client';

import {
  getImmediateTransform,
  updateImmediateTransform,
  useTransformScale,
  subscribeTransformScale,
} from '../cursor/ImmediateTransformStore';

// ADR-040 Phase XIII: ZoomStore is now a thin facade over TransformStore
// (the canonical SSoT for `scale + offsetX + offsetY`). Both ZoomStore.setScale
// and useCanvasTransformState write through to the same underlying state, so
// `useCurrentZoom` and `useTransformValue` always agree.

export const ZoomStore = {
  getScale: (): number => getImmediateTransform().scale,

  setScale: (scale: number): void => {
    const prev = getImmediateTransform();
    if (prev.scale === scale) return;
    updateImmediateTransform({ ...prev, scale });
  },

  subscribe: (listener: () => void): (() => void) => subscribeTransformScale(listener),
};

export function useCurrentZoom(): number {
  return useTransformScale();
}
