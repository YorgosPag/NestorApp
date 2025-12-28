/**
 * Unified Tool Style Store
 * Single source of truth for drawing styles across DXF and Overlay tools
 */

import type { LineType } from '../settings-core/types';
import { UI_COLORS } from '../config/color-config';

export interface ToolStyle {
  enabled: boolean;          // ΝΕΟ! Ενεργοποίηση/απενεργοποίηση γραμμών
  strokeColor: string;
  fillColor: string;
  lineWidth: number;
  opacity: number;
  lineType: LineType; // Added lineType for preview styling
}

type OverlayCompletionCallback = () => void;

import { useSyncExternalStore } from 'react';

type Listener = () => void;
let current: ToolStyle = {
  enabled: true,           // Default: γραμμές ενεργοποιημένες
  strokeColor: UI_COLORS.TEST_PREVIEW_RED,
  fillColor:   UI_COLORS.TRANSPARENT,
  lineWidth:   1,
  opacity:     1,
  lineType:    'dashed' as LineType, // Default lineType
};

// Store for overlay completion callback
let overlayCompletionCallback: OverlayCompletionCallback | null = null;

const listeners = new Set<Listener>();

export const toolStyleStore = {
  get(): ToolStyle {
    return current;
  },
  set(next: Partial<ToolStyle>) {
    // Debug logs commented out for performance

    // console.trace('🔴 [toolStyleStore] Call stack:');
    current = { ...current, ...next };

    listeners.forEach(l => l());
  },
  subscribe(cb: Listener) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  // Overlay completion callback methods
  setOverlayCompletionCallback(callback: OverlayCompletionCallback | null) {
    overlayCompletionCallback = callback;
  },
  getOverlayCompletionCallback(): OverlayCompletionCallback | null {
    return overlayCompletionCallback;
  },
  triggerOverlayCompletion(): boolean {
    if (overlayCompletionCallback) {

      overlayCompletionCallback();
      overlayCompletionCallback = null; // Clear after use
      return true;
    }

    return false;
  }
};

// 🗑️ REMOVED: completionStyleStore - δεν χρειάζεται πια
// Χρησιμοποιούμε το κύριο toolStyleStore για όλες τις φάσεις

export function useToolStyle(): ToolStyle {
  return useSyncExternalStore(toolStyleStore.subscribe, toolStyleStore.get, toolStyleStore.get);
}

// 🗑️ REMOVED: useCompletionStyle - δεν χρειάζεται πια