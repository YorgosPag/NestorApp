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
import { createExternalStore } from '../../stores/createExternalStore';

// `equals: Object.is` αναπαράγει το `if (_active === value) return` guard του setActive.
const store = createExternalStore<boolean>(false, { equals: Object.is });

export const DimRowHandleModeStore = {
  isActive: (): boolean => store.get(),
  setActive(value: boolean): void {
    store.set(value);
  },
  toggle(): void {
    store.set(!store.get());
  },
  subscribe(cb: () => void): () => void {
    return store.subscribe(cb);
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
