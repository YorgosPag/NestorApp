/**
 * ADR-362 Round 35 — «Λαβές Μετακίνησης Σειρών» mode store.
 *
 * Vanilla, zero-React singleton (ADR-040 pattern, mirror of the transform / hover
 * SSoT stores): holds ONLY the on/off flag of the row-handle mode. Written by the
 * ribbon toggle widget, read by the `DimRowHandleOverlay` leaf + the widget itself
 * (both via `useSyncExternalStore`). Active-drag state lives locally in the overlay
 * (transient, per-gesture) — the store stays a single boolean SSoT.
 */

import { useSyncExternalStore } from 'react';

let _active = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

export const DimRowHandleModeStore = {
  isActive: (): boolean => _active,
  setActive(value: boolean): void {
    if (_active === value) return;
    _active = value;
    emit();
  },
  toggle(): void {
    _active = !_active;
    emit();
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
} as const;

/** React hook — re-renders the subscriber whenever the mode flips. */
export function useDimRowHandleModeActive(): boolean {
  return useSyncExternalStore(
    DimRowHandleModeStore.subscribe,
    DimRowHandleModeStore.isActive,
    () => false,
  );
}
