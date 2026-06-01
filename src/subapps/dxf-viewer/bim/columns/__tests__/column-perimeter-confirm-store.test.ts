/**
 * ADR-363 Φάση 3c «Κολώνα από περίγραμμα» — confirm-store handshake tests.
 *
 * Επαληθεύει το Promise handshake (request → resolve), το snapshot (open + counts)
 * και την ειδοποίηση subscribers — όπως το `wall-cascade-delete-store`.
 */

import {
  requestColumnPerimeterConfirm,
  resolveColumnPerimeterConfirm,
  subscribeColumnPerimeterConfirm,
  getColumnPerimeterConfirmState,
} from '../column-perimeter-confirm-store';

describe('column-perimeter-confirm-store', () => {
  afterEach(() => {
    // Καθάρισε τυχόν εκκρεμές dialog μεταξύ tests.
    if (getColumnPerimeterConfirmState().open) resolveColumnPerimeterConfirm('cancel');
  });

  it('αρχικό state: κλειστό, μηδενικά counts', () => {
    const s = getColumnPerimeterConfirmState();
    expect(s.open).toBe(false);
    expect(s.walls).toBe(0);
    expect(s.columns).toBe(0);
  });

  it('request → ανοίγει με τα counts και ειδοποιεί subscribers', () => {
    let notified = 0;
    const unsub = subscribeColumnPerimeterConfirm(() => {
      notified++;
    });
    void requestColumnPerimeterConfirm({ walls: 2, columns: 3 });
    const s = getColumnPerimeterConfirmState();
    expect(s.open).toBe(true);
    expect(s.walls).toBe(2);
    expect(s.columns).toBe(3);
    expect(notified).toBeGreaterThan(0);
    unsub();
  });

  it("resolve('create') → επιλύει σε 'create' και κλείνει", async () => {
    const p = requestColumnPerimeterConfirm({ walls: 1, columns: 0 });
    resolveColumnPerimeterConfirm('create');
    await expect(p).resolves.toBe('create');
    expect(getColumnPerimeterConfirmState().open).toBe(false);
  });

  it("resolve('cancel') → επιλύει σε 'cancel' και κλείνει", async () => {
    const p = requestColumnPerimeterConfirm({ walls: 1, columns: 2 });
    resolveColumnPerimeterConfirm('cancel');
    await expect(p).resolves.toBe('cancel');
    expect(getColumnPerimeterConfirmState().open).toBe(false);
  });
});
