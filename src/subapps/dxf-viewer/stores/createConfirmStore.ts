/**
 * createConfirmStore — SSoT factory για **Promise-handshake confirm stores**
 * (zero-React, `useSyncExternalStore`-compatible).
 *
 * Αδελφός του `createToggleStore` (που καλύπτει ΜΟΝΟ `{ isOpen }` toggles). Εδώ
 * ζει το pattern «άνοιξε dialog με payload → περίμενε την επιλογή του χρήστη ως
 * Promise»: το copy-paste boilerplate (`_state` + `_pendingResolve` + `_subs` +
 * `_notify` + request/resolve/subscribe/getSnapshot) που επαναλαμβανόταν αυτούσιο
 * σε `column-perimeter-confirm-store`, `column-adopt-size-confirm-store` κ.λπ.
 *
 * Νέο confirm store → `createConfirmStore(closedState)` + thin named wrappers (ώστε
 * το public API να μένει σαφές ανά domain), ΟΧΙ νέο boilerplate.
 *
 * `getSnapshot` επιστρέφει σταθερή reference μεταξύ αλλαγών (προϋπόθεση του
 * `useSyncExternalStore`): το `closedState` όσο είναι κλειστό, ή το `openState`
 * object που δόθηκε στο `request` όσο είναι ανοιχτό — αμετάβλητο μέχρι την επόμενη αλλαγή.
 *
 * @see ./createToggleStore.ts — ο αδελφός για απλά `{ isOpen }` toggles
 */

export interface ConfirmStore<TState, TAction> {
  /** Ανοίγει το dialog με την `openState` και επιστρέφει Promise με την επιλογή. */
  request(openState: TState): Promise<TAction>;
  /** Κλείνει το dialog και resolve-άρει το εκκρεμές Promise με `action`. */
  resolve(action: TAction): void;
  /** useSyncExternalStore-compatible subscribe. */
  subscribe(cb: () => void): () => void;
  /** useSyncExternalStore-compatible snapshot (σταθερή reference μεταξύ αλλαγών). */
  getSnapshot(): TState;
}

export function createConfirmStore<TState, TAction>(
  closedState: TState,
): ConfirmStore<TState, TAction> {
  let _state: TState = closedState;
  let _pendingResolve: ((action: TAction) => void) | null = null;
  const _subs = new Set<() => void>();

  function _notify(): void {
    _subs.forEach((cb) => cb());
  }

  return {
    request(openState: TState): Promise<TAction> {
      return new Promise<TAction>((resolve) => {
        _pendingResolve = resolve;
        _state = openState;
        _notify();
      });
    },
    resolve(action: TAction): void {
      const resolve = _pendingResolve;
      _pendingResolve = null;
      _state = closedState;
      _notify();
      resolve?.(action);
    },
    subscribe(cb: () => void): () => void {
      _subs.add(cb);
      return () => {
        _subs.delete(cb);
      };
    },
    getSnapshot(): TState {
      return _state;
    },
  };
}
