/**
 * ADR-674 Φ C — shape/behaviour smoke for the Edit-Opening-Hardware dialog store.
 *
 * Guards open/close semantics, subscriber notification, and idempotent close —
 * mirrors the sibling `create-edit-type-dialog-store.test.ts` coverage, adapted
 * to this store's `openingId`-keyed (not `typeId`-keyed) module-level singleton.
 */

import {
  closeEditOpeningHardware,
  getEditOpeningHardwareState,
  openEditOpeningHardware,
  subscribeEditOpeningHardware,
} from '../edit-opening-hardware-store';

describe('edit-opening-hardware-store (ADR-674 Φ C)', () => {
  afterEach(() => {
    // Module-level singleton — reset to CLOSED so tests don't leak state.
    closeEditOpeningHardware();
  });

  it('starts closed with a null openingId', () => {
    expect(getEditOpeningHardwareState()).toEqual({ open: false, openingId: null });
  });

  it('opens for an openingId and closes back to the CLOSED sentinel', () => {
    openEditOpeningHardware('op_123');
    expect(getEditOpeningHardwareState()).toEqual({ open: true, openingId: 'op_123' });
    closeEditOpeningHardware();
    expect(getEditOpeningHardwareState()).toEqual({ open: false, openingId: null });
  });

  it('notifies subscribers on real open/close transitions', () => {
    const cb = jest.fn();
    const unsub = subscribeEditOpeningHardware(cb);
    openEditOpeningHardware('op_1');
    closeEditOpeningHardware();
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    openEditOpeningHardware('op_2');
    expect(cb).toHaveBeenCalledTimes(2); // no notification after unsubscribe
    closeEditOpeningHardware();
  });

  it('no-ops a redundant close (already closed → no notification)', () => {
    const cb = jest.fn();
    subscribeEditOpeningHardware(cb);
    closeEditOpeningHardware();
    expect(cb).not.toHaveBeenCalled();
  });

  it('re-opening for a different openingId replaces state (Object.is guard still notifies)', () => {
    openEditOpeningHardware('op_a');
    const cb = jest.fn();
    subscribeEditOpeningHardware(cb);
    openEditOpeningHardware('op_b');
    expect(getEditOpeningHardwareState()).toEqual({ open: true, openingId: 'op_b' });
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
