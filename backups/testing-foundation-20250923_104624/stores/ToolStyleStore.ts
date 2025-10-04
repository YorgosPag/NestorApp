/**
 * Unified Tool Style Store
 * Single source of truth for drawing styles across DXF and Overlay tools
 */

export interface ToolStyle {
  enabled: boolean;          // ΝΕΟ! Ενεργοποίηση/απενεργοποίηση γραμμών
  strokeColor: string;
  fillColor: string;
  lineWidth: number;
  opacity: number;
  lineType: string; // Added lineType for preview styling
}

type OverlayCompletionCallback = () => void;

import { useSyncExternalStore } from 'react';

type Listener = () => void;
let current: ToolStyle = {
  enabled: true,           // Default: γραμμές ενεργοποιημένες
  strokeColor: '#ff5555',
  fillColor:   '#00000000',
  lineWidth:   1,
  opacity:     1,
  lineType:    'dashed', // Default lineType
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
    // console.log('🔴 [toolStyleStore] SET called with:', JSON.stringify(next, null, 2));
    // console.log('🔴 [toolStyleStore] Previous state:', JSON.stringify(current, null, 2));
    // console.trace('🔴 [toolStyleStore] Call stack:');
    current = { ...current, ...next };
    // console.log('🔴 [toolStyleStore] New state:', JSON.stringify(current, null, 2));
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
      console.log('🎯 [toolStyleStore] Triggering overlay completion');
      overlayCompletionCallback();
      overlayCompletionCallback = null; // Clear after use
      return true;
    }
    console.log('🎯 [toolStyleStore] No overlay completion callback available');
    return false;
  }
};

// 🗑️ REMOVED: completionStyleStore - δεν χρειάζεται πια
// Χρησιμοποιούμε το κύριο toolStyleStore για όλες τις φάσεις

export function useToolStyle(): ToolStyle {
  return useSyncExternalStore(toolStyleStore.subscribe, toolStyleStore.get, toolStyleStore.get);
}

// 🗑️ REMOVED: useCompletionStyle - δεν χρειάζεται πια