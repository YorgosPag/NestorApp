/**
 * createToolBridgeStore — SSoT factory για τα drawing-mode ↔ ribbon/3D "handle bridge"
 * stores (ADR-363/404/408). Zero-React state + bundled `use()` React binding.
 *
 * The 16 `*-tool-bridge-store.ts` cells (column, foundation, railing, furniture,
 * electrical-panel, floorplan-symbol, wall, slab, beam, 7×mep) all repeat the SAME
 * shape: a module-level `THandle | null` cell that a tool hook (living inside
 * `CanvasSection`) publishes, and a ribbon bridge / 3D placement hook (living in a
 * sibling subtree) reads — imperatively via `get()` and reactively via `use()`. Differ
 * ΜΟΝΟ στο shape του `THandle`. This factory is that single source.
 *
 * Big-player layering (Zustand/Redux/Valtio doctrine): the pub/sub machinery is NOT
 * re-implemented here — it delegates to the vanilla `createExternalStore` primitive
 * (sibling `createExternalStore.ts`). `createToolBridgeStore` adds only the tool-bridge
 * concerns on top: (1) `null` initial handle, (2) `Object.is` identity-guard on `set`
 * (== το χειροκίνητο `if (next === handle) return`, handles=objects/null· behaviorally
 * invisible για τα single-reader stores που δεν είχαν guard, αφού same-ref set αφήνει
 * το state αμετάβλητο), (3) the React `use()` binding via `useSyncExternalStore` with a
 * null server snapshot.
 *
 * Public API is a SUPERSET όλων των legacy shapes ({set,get,use}, {set,get,subscribe},
 * {set,get}) → κάθε υπάρχων consumer δουλεύει αμετάβλητος.
 *
 * @see stores/createExternalStore.ts — the vanilla pub/sub SSoT this delegates to
 * @see stores/createConfirmStore.ts — sibling domain factory
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from './createExternalStore';

export interface ToolBridgeStore<THandle> {
  /**
   * Writer — καλείται από το tool-hook effect· αντικαθιστά το published handle.
   * No-op όταν `next` είναι identity-equal με το τρέχον (bail redundant writes).
   */
  set(next: THandle | null): void;
  /** Imperative read (event-time / bridge callbacks / tests). */
  get(): THandle | null;
  /** Reactive read — re-renders τον consumer σε κάθε handle change. */
  use(): THandle | null;
  /** Low-level subscribe (returns unsubscribe)· ο React consumer προτιμά `use()`. */
  subscribe(listener: () => void): () => void;
}

export function createToolBridgeStore<THandle>(): ToolBridgeStore<THandle> {
  const store = createExternalStore<THandle | null>(null, { equals: Object.is });
  const getServerSnapshot = (): THandle | null => null;

  return {
    set: store.set,
    get: store.get,
    subscribe: store.subscribe,
    use(): THandle | null {
      return useSyncExternalStore(store.subscribe, store.get, getServerSnapshot);
    },
  };
}
