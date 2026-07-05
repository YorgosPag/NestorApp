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
import { createExternalStore } from '../../stores/createExternalStore';

export const OPENING_TAG_LAYER_ID = '__system_opening_tags__';

// `equals: Object.is` = το παλιό `if (visible === next) return` guard.
const store = createExternalStore<boolean>(true, { equals: Object.is });

export function isOpeningTagLayerVisible(): boolean {
  return store.get();
}

export function setOpeningTagLayerVisible(next: boolean): void {
  store.set(next);
}

export function subscribeOpeningTagLayer(cb: () => void): () => void {
  return store.subscribe(cb);
}

/** Test-only reset (silent state reset + drop subscribers). */
export function __resetOpeningTagLayerForTests(): void {
  store.reset(true);
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
