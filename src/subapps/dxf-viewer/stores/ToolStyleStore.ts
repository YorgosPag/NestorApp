"use client";

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
  dashScale?: number; // ✅ ENTERPRISE FIX: Added dashScale property για line preview
}

type OverlayCompletionCallback = () => void;

import { useSyncExternalStore } from 'react';
import { createExternalStore } from './createExternalStore';

const INITIAL: ToolStyle = {
  enabled: true,           // Default: γραμμές ενεργοποιημένες
  strokeColor: UI_COLORS.TEST_PREVIEW_RED,
  fillColor:   UI_COLORS.TRANSPARENT,
  lineWidth:   1,
  opacity:     1,
  lineType:    'dashed' as LineType, // Default lineType
};

// Store for overlay completion callback — bespoke side-channel, NOT part of the
// pub/sub store; left untouched by the WAVE 2.6 migration.
let overlayCompletionCallback: OverlayCompletionCallback | null = null;

// SSoT pub/sub plumbing via createExternalStore (WAVE 2.6). `set(Partial)` is a
// patch-merge — always-notify, no `equals`, byte-identical to the hand-rolled store.
const store = createExternalStore<ToolStyle>(INITIAL);

export const toolStyleStore = {
  get(): ToolStyle {
    return store.get();
  },
  set(next: Partial<ToolStyle>) {
    // Debug logs commented out for performance

    // console.trace('🔴 [toolStyleStore] Call stack:');
    store.set({ ...store.get(), ...next });
  },
  subscribe(cb: () => void) {
    return store.subscribe(cb);
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
