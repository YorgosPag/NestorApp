// ADR-357 Phase 13 — G14 Length/Angle Locking.
// Singleton zero-React SSoT. Pattern: TrackingPointStore / HoverStore.
// Ctrl+L locks length; Ctrl+A locks angle. Same shortcut or 🔒 click unlocks.

export type LockedField = 'length' | 'angle';

export interface LockState {
  lockedField: LockedField | null;
  lockedValue: number | null;
}

const INITIAL: LockState = { lockedField: null, lockedValue: null };

let _state: LockState = INITIAL;
let _snapshot: LockState = INITIAL;
const _subs = new Set<() => void>();

function _notify(): void {
  _snapshot = { ..._state };
  _subs.forEach(cb => cb());
}

export const DynamicInputLockStore = {
  lockLength(value: number): void {
    _state = { lockedField: 'length', lockedValue: value };
    _notify();
  },

  lockAngle(value: number): void {
    _state = { lockedField: 'angle', lockedValue: value };
    _notify();
  },

  unlock(): void {
    _state = INITIAL;
    _notify();
  },

  toggle(field: LockedField, value: number): void {
    if (_state.lockedField === field) {
      DynamicInputLockStore.unlock();
    } else if (field === 'length') {
      DynamicInputLockStore.lockLength(value);
    } else {
      DynamicInputLockStore.lockAngle(value);
    }
  },

  getLocked(): LockState {
    return _state;
  },

  subscribe(cb: () => void): () => void {
    _subs.add(cb);
    return () => { _subs.delete(cb); };
  },

  getSnapshot(): LockState {
    return _snapshot;
  },
};
