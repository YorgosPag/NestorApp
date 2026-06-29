/**
 * Bim3DCursorReadoutStore — readout transport + subscription semantics (ADR-366 §B.2.Q1 follow-up).
 */

import {
  Bim3DCursorReadoutStore,
  setBim3DCursorReadout,
  clearBim3DCursorReadout,
  getBim3DCursorReadout,
  subscribeBim3DCursorReadout,
} from '../Bim3DCursorReadoutStore';

describe('Bim3DCursorReadoutStore', () => {
  afterEach(() => clearBim3DCursorReadout());

  it('starts empty', () => {
    expect(getBim3DCursorReadout()).toBeNull();
  });

  it('stores + returns the X/Y/Z readout', () => {
    setBim3DCursorReadout({ x: 5200, y: 3000, z: 0 });
    expect(getBim3DCursorReadout()).toEqual({ x: 5200, y: 3000, z: 0 });
  });

  it('notifies subscribers on change', () => {
    const seen: Array<{ x: number; y: number; z: number } | null> = [];
    const off = subscribeBim3DCursorReadout((r) => seen.push(r));
    setBim3DCursorReadout({ x: 1, y: 2, z: 3 });
    setBim3DCursorReadout(null);
    off();
    expect(seen).toEqual([{ x: 1, y: 2, z: 3 }, null]);
  });

  it('skips notify when the readout is unchanged (dedup)', () => {
    setBim3DCursorReadout({ x: 1, y: 2, z: 3 });
    const fn = jest.fn();
    const off = subscribeBim3DCursorReadout(fn);
    setBim3DCursorReadout({ x: 1, y: 2, z: 3 }); // identical → no notify
    expect(fn).not.toHaveBeenCalled();
    setBim3DCursorReadout({ x: 1, y: 2, z: 9 }); // z changed → notify
    expect(fn).toHaveBeenCalledTimes(1);
    off();
  });

  it('clear() is a no-op when already empty (no spurious notify)', () => {
    const fn = jest.fn();
    const off = subscribeBim3DCursorReadout(fn);
    clearBim3DCursorReadout(); // already null
    expect(fn).not.toHaveBeenCalled();
    off();
  });

  it('unsubscribe stops further notifications', () => {
    const fn = jest.fn();
    const off = subscribeBim3DCursorReadout(fn);
    off();
    setBim3DCursorReadout({ x: 7, y: 8, z: 9 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('exposes the singleton instance for direct use', () => {
    Bim3DCursorReadoutStore.setReadout({ x: 10, y: 20, z: 30 });
    expect(Bim3DCursorReadoutStore.getReadout()).toEqual({ x: 10, y: 20, z: 30 });
  });
});
