// Floor Management Dialog visibility store SSoT.
// Singleton, zero React. Pattern: AdminLayerManagerDialogStore.
// Ανοίγει την καρτέλα «Όροφοι» (FloorsTabContent) σε modal μέσα στον DXF viewer
// (από το panel «Επίπεδα Έργου» ⚙️ ή δεξί κλικ στη γραμμή σταθμών).

export interface FloorManagementDialogState {
  readonly isOpen: boolean;
}

const INITIAL: FloorManagementDialogState = { isOpen: false };

let _state: FloorManagementDialogState = INITIAL;
let _snapshot: FloorManagementDialogState = INITIAL;
const _subs = new Set<() => void>();

function _notify(): void {
  _snapshot = { ..._state };
  _subs.forEach((cb) => cb());
}

export const FloorManagementDialogStore = {
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

  getSnapshot(): FloorManagementDialogState {
    return _snapshot;
  },
};
