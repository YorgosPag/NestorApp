/**
 * Text Style Store — pure vanilla external store (SSoT for preview text styling).
 *
 * ⚠️ WORKER-SAFE — NEVER import `react` here (no `useSyncExternalStore`, no `"use client"`).
 * This module sits in the DXF parse import chain (`run-dxf-parse` → dxf-scene-builder →
 * dxf-block-expander → dxf-entity-converters → geometry-rendering-utils →
 * useTextPreviewStyle → HERE), which Turbopack bundles into the parse Web Worker
 * (`workers/dxf-parser.worker.ts`). A single `from 'react'` in this chunk fails the worker
 * module load → `worker.onerror` fires an opaque `{}` → the import silently falls back to a
 * main-thread parse that FREEZES the UI on large files (ADR-639 Στάδιο 1 root cause).
 *
 * The vanilla store already exposes `get`/`set`/`subscribe`; a React component that wants a
 * reactive subscription calls, at the CONSUMER:
 *   `useSyncExternalStore(textStyleStore.subscribe, textStyleStore.get, textStyleStore.get)`
 * (the `createExternalStore` doctrine — the Zustand vanilla/react split). This keeps the
 * store framework-agnostic and safe to import from a Worker/server.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-639-dxf-viewer-large-file-performance.md
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
