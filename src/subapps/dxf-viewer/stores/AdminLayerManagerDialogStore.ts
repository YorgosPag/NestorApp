// ADR-391 — AdminLayerManager Dialog visibility store SSoT.
// Singleton, zero React. Pattern: CommandLineStore.

export interface AdminLayerManagerDialogState {
  readonly isOpen: boolean;
}

const INITIAL: AdminLayerManagerDialogState = { isOpen: false };

let _state: AdminLayerManagerDialogState = INITIAL;
let _snapshot: AdminLayerManagerDialogState = INITIAL;
const _subs = new Set<() => void>();

function _notify(): void {
  _snapshot = { ..._state };
  _subs.forEach((cb) => cb());
}

export const AdminLayerManagerDialogStore = {
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

  getSnapshot(): AdminLayerManagerDialogState {
    return _snapshot;
  },
};
