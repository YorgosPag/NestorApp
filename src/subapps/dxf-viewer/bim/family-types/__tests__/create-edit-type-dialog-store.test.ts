/**
 * ADR-604 Φ2 — shape/behaviour smoke for `createEditTypeDialogStore`.
 *
 * Guards the shared Edit-Type dialog store factory the four `edit-{x}-type-store`
 * modules bind: open/close semantics, subscriber notification, idempotent close,
 * and — critically — INSTANCE ISOLATION (two entities must not share state).
 */

import { createEditTypeDialogStore } from '../create-edit-type-dialog-store';

describe('createEditTypeDialogStore (ADR-604 Φ2)', () => {
  it('starts closed with a null typeId', () => {
    const store = createEditTypeDialogStore();
    expect(store.getState()).toEqual({ open: false, typeId: null });
  });

  it('opens for a typeId and closes back to the CLOSED sentinel', () => {
    const store = createEditTypeDialogStore();
    store.open('wt_123');
    expect(store.getState()).toEqual({ open: true, typeId: 'wt_123' });
    store.close();
    expect(store.getState()).toEqual({ open: false, typeId: null });
  });

  it('notifies subscribers on real open/close transitions', () => {
    const store = createEditTypeDialogStore();
    const cb = jest.fn();
    const unsub = store.subscribe(cb);
    store.open('wt_1');
    store.close();
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    store.open('wt_2');
    expect(cb).toHaveBeenCalledTimes(2); // no notification after unsubscribe
  });

  it('no-ops a redundant close (already closed → no notification)', () => {
    const store = createEditTypeDialogStore();
    const cb = jest.fn();
    store.subscribe(cb);
    store.close();
    expect(cb).not.toHaveBeenCalled();
  });

  it('keeps two instances fully isolated', () => {
    const wall = createEditTypeDialogStore();
    const slab = createEditTypeDialogStore();
    wall.open('wt_1');
    expect(wall.getState()).toEqual({ open: true, typeId: 'wt_1' });
    expect(slab.getState()).toEqual({ open: false, typeId: null });
  });
});
