/**
 * createExternalStore — SSoT zero-React pub/sub store factory (shared platform primitive).
 *
 * This is the ONE vanilla external-store primitive for the whole app — the shape every
 * big player exposes at core/package level (Zustand `createStore`, Redux `createStore`,
 * Valtio/Jotai vanilla), consumed by React via `useSyncExternalStore`. It began inside the
 * DXF viewer (`subapps/dxf-viewer/stores/`), where ~100+ hand-rolled module-level stores all
 * repeated the SAME machinery: `let state; const listeners = new Set<() => void>(); get /
 * set (notify) / subscribe`. A core primitive does NOT belong buried inside one feature
 * module, so it was promoted here to `src/lib/state/` (WAVE 3) — the DXF path
 * `subapps/dxf-viewer/stores/createExternalStore.ts` is now a thin re-export shim, so every
 * existing dxf consumer keeps its import untouched while non-dxf subapps can share the SSoT.
 *
 * A new store is `createExternalStore(initial)` + thin domain-named wrappers, never
 * re-implemented notify plumbing.
 *
 * Behaviour is byte-identical to the hand-rolled stores:
 *   - `set` reassigns state then notifies EVERY listener (in insertion order).
 *   - `subscribe` returns an unsubscribe; a listener added twice is deduped (Set).
 *   - Optional `equals`: when it reports the next value equal to the current, `set`
 *     is a no-op (no reassign, no notify) — mirrors the `if (next === current) return`
 *     guard some stores use to bail identical writes (retained-mode / signal semantics).
 *     Omitted ⇒ ALWAYS notify (matches the simplest stores).
 *
 * Pairs with `useSyncExternalStore(store.subscribe, store.get, store.get)` — `get` is a
 * pure snapshot reader safe for both the client and the server snapshot argument.
 *
 * @see subapps/dxf-viewer/stores/createConfirmStore.ts — sibling factory (confirm-dialog stores)
 * @see subapps/dxf-viewer/systems/region-preview/RegionPerimeterPreviewStore.ts — first consumer
 */

export interface ExternalStore<T> {
  /** Pure snapshot read (safe as the `useSyncExternalStore` getSnapshot + server arg). */
  readonly get: () => T;
  /** Replace the state and notify subscribers (unless `equals` reports no change). */
  readonly set: (next: T) => void;
  /** Register a listener; returns its unsubscribe. */
  readonly subscribe: (listener: () => void) => () => void;
  /**
   * Test/lifecycle reset: replace the state WITHOUT notifying and drop EVERY current
   * subscriber. Mirrors the hand-rolled `state = INITIAL; listeners.clear()` reset
   * helpers many stores expose for jest isolation (Zustand `destroy`-aligned). This is
   * NOT a runtime setter — always use `set` for normal updates; `reset` bypasses both
   * the notify and the `equals` guard on purpose.
   */
  readonly reset: (next: T) => void;
}

export interface CreateExternalStoreOptions<T> {
  /**
   * Change guard. When it returns `true` for `(current, next)`, `set` bails (no notify).
   * Use `Object.is` (or a field/signature compare) to suppress redundant re-renders;
   * omit to notify on every `set`.
   */
  readonly equals?: (a: T, b: T) => boolean;
}

export function createExternalStore<T>(
  initial: T,
  options?: CreateExternalStoreOptions<T>,
): ExternalStore<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  const equals = options?.equals;

  const get = (): T => state;

  const set = (next: T): void => {
    if (equals?.(state, next)) return;
    state = next;
    for (const listener of listeners) listener();
  };

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const reset = (next: T): void => {
    state = next;
    listeners.clear();
  };

  return { get, set, subscribe, reset };
}
