/**
 * ADR-376 Phase A §4.7 — Opening Tags Layer SSoT.
 *
 * Manages the reserved system layer `__system_opening_tags__` που ελέγχει
 * τη global εμφάνιση των opening tags (`OpeningTagRenderer`). Wired σε:
 *   - `OpeningRenderer` καλεί `isOpeningTagLayerVisible()` πριν δείξει tag
 *   - Layers panel toggle setter `setOpeningTagLayerVisible(boolean)`
 *
 * Persistence: layer state lives σε memory-only SSoT (`useSyncExternalStore`
 * pattern). Phase A keeps it in-memory + default ON; persistence σε per-project
 * settings reserved για Phase B.
 *
 * Listeners registered via `subscribeOpeningTagLayer()` are notified όταν
 * αλλάζει το state, ώστε leaves να μπορούν να re-render. ADR-040 compliant —
 * the `useSyncExternalStore` binding is a pure leaf wrapper (no high-freq).
 */

import { useSyncExternalStore } from 'react';

export const OPENING_TAG_LAYER_ID = '__system_opening_tags__';

let visible = true;
const listeners = new Set<() => void>();

export function isOpeningTagLayerVisible(): boolean {
  return visible;
}

export function setOpeningTagLayerVisible(next: boolean): void {
  if (visible === next) return;
  visible = next;
  for (const cb of listeners) cb();
}

export function subscribeOpeningTagLayer(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Test-only reset. */
export function __resetOpeningTagLayerForTests(): void {
  visible = true;
  listeners.clear();
}

// ────────────────────────────────────────────────────────────────────────────
// REACT BINDING (ADR-040 — pure useSyncExternalStore leaf, no high-freq sub)
// ────────────────────────────────────────────────────────────────────────────

export function useOpeningTagLayerVisible(): boolean {
  return useSyncExternalStore(
    subscribeOpeningTagLayer,
    isOpeningTagLayerVisible,
    () => true, // SSR fallback — default ON
  );
}
