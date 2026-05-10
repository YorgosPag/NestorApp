'use client';

import { useSyncExternalStore } from 'react';

// ADR-040 Phase VII: external store for current zoom scale.
// Written imperatively by wrappedHandleTransformChange — only leaf display
// components subscribe. Prevents DxfViewerContent cascade on every zoom.
let currentScale = 1;
const listeners = new Set<() => void>();

export const ZoomStore = {
  getScale: (): number => currentScale,

  setScale: (scale: number): void => {
    if (currentScale === scale) return;
    currentScale = scale;
    listeners.forEach(l => l());
  },

  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

export function useCurrentZoom(): number {
  return useSyncExternalStore(ZoomStore.subscribe, ZoomStore.getScale);
}
