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

type Listener = () => void;
let current: TextStyle = {
  enabled: true,               // Default: κείμενο ενεργοποιημένο
  fontFamily: 'Arial, sans-serif',
  fontSize: 12,
  color: '#ffffff', // Λευκό για προσχεδίαση (συνεπές με DXF ρυθμίσεις)
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  opacity: 1,
  isSuperscript: false,
  isSubscript: false,
};

const listeners = new Set<Listener>();

export const textStyleStore = {
  get(): TextStyle {
    return current;
  },
  set(next: Partial<TextStyle>) {
    current = { ...current, ...next };
    listeners.forEach(l => l());
  },
  subscribe(cb: Listener) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

export function useTextStyle(): TextStyle {
  return useSyncExternalStore(textStyleStore.subscribe, textStyleStore.get, textStyleStore.get);
}