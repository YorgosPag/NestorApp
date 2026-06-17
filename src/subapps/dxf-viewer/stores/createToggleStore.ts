/**
 * createToggleStore — SSoT factory για boolean visibility/toggle singleton stores
 * (zero-React, `useSyncExternalStore`-compatible).
 *
 * Αντικαθιστά το copy-paste boilerplate (`_state`/`_snapshot`/`_subs`/`_notify` +
 * open/close/toggle/isOpen/subscribe/getSnapshot) που επαναλαμβανόταν αυτούσιο σε
 * πολλά απλά dialog stores (AdminLayerManagerDialogStore, CommandLine, κ.λπ.). Νέα
 * απλά toggle stores → `createToggleStore()` (μία γραμμή), όχι νέο boilerplate.
 *
 * Καλύπτει ΜΟΝΟ stores με κατάσταση `{ isOpen: boolean }`. Stores με payload ή
 * Promise-handshake (π.χ. `column-perimeter-confirm-store`) ΔΕΝ ανήκουν εδώ.
 *
 * `getSnapshot` επιστρέφει σταθερή reference μεταξύ αλλαγών (προϋπόθεση του
 * `useSyncExternalStore` — αλλιώς infinite re-render).
 */

export interface ToggleStoreState {
  readonly isOpen: boolean;
}

export interface ToggleStore {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  subscribe(cb: () => void): () => void;
  getSnapshot(): ToggleStoreState;
}

export function createToggleStore(): ToggleStore {
  const CLOSED: ToggleStoreState = { isOpen: false };
  let _state: ToggleStoreState = CLOSED;
  let _snapshot: ToggleStoreState = CLOSED;
  const _subs = new Set<() => void>();

  function _notify(): void {
    _snapshot = { ..._state };
    _subs.forEach((cb) => cb());
  }

  return {
    open(): void {
      if (_state.isOpen) return;
      _state = { isOpen: true };
      _notify();
    },
    close(): void {
      if (!_state.isOpen) return;
      _state = { isOpen: false };
      _notify();
    },
    toggle(): void {
      _state = { isOpen: !_state.isOpen };
      _notify();
    },
    isOpen(): boolean {
      return _state.isOpen;
    },
    subscribe(cb: () => void): () => void {
      _subs.add(cb);
      return () => {
        _subs.delete(cb);
      };
    },
    getSnapshot(): ToggleStoreState {
      return _snapshot;
    },
  };
}
