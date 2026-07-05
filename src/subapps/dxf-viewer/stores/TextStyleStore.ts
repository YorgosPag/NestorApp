"use client";

/**
 * Text Style Store
 * Single source of truth for text styling in preview rendering
 */

export interface TextStyle {
  enabled: boolean;           // ΝΕΟ! Ενεργοποίηση/απενεργοποίηση κειμένου
  fontFamily: string;
  fontSize: number;
  color: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: string; // 'none', 'underline', 'line-through', etc.
  opacity: number;
  isSuperscript: boolean;
  isSubscript: boolean;
}

import { useSyncExternalStore } from 'react';
import { UI_COLORS } from '../config/color-config';
import { createExternalStore } from './createExternalStore';

const INITIAL: TextStyle = {
  enabled: true,               // Default: κείμενο ενεργοποιημένο
  fontFamily: 'Arial, sans-serif',
  fontSize: 12,
  color: UI_COLORS.WHITE, // Λευκό για προσχεδίαση (συνεπές με DXF ρυθμίσεις)
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  opacity: 1,
  isSuperscript: false,
  isSubscript: false,
};

// SSoT pub/sub plumbing via createExternalStore (WAVE 2.6). Patch-merge, always-notify,
// no `equals` — byte-identical to the hand-rolled store.
const store = createExternalStore<TextStyle>(INITIAL);

export const textStyleStore = {
  get(): TextStyle {
    return store.get();
  },
  set(next: Partial<TextStyle>) {
    store.set({ ...store.get(), ...next });
  },
  subscribe(cb: () => void) {
    return store.subscribe(cb);
  },
};

export function useTextStyle(): TextStyle {
  return useSyncExternalStore(textStyleStore.subscribe, textStyleStore.get, textStyleStore.get);
}
