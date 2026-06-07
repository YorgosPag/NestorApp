/**
 * ADR-419 «Πολλαπλή δημιουργία» — confirm-store handshake tests.
 *
 * Επαληθεύει το Promise handshake (request → resolve), το snapshot (open + intent +
 * counts / aspect) και την ειδοποίηση subscribers — όπως το `wall-cascade-delete-store`.
 */

import {
  requestColumnDiscreteIntentConfirm,
  requestColumnIsColumnWarn,
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
    expect(s.primaryCount).toBe(0);
    expect(s.secondaryCount).toBe(0);
  });

  it('intent request → ανοίγει με intent + counts και ειδοποιεί subscribers', () => {
    let notified = 0;
    const unsub = subscribeColumnPerimeterConfirm(() => {
      notified++;
    });
    void requestColumnDiscreteIntentConfirm({ intent: 'columns', primaryCount: 3, secondaryCount: 2 });
    const s = getColumnPerimeterConfirmState();
    expect(s.open).toBe(true);
    expect(s.mode).toBe('intent-mixed');
    expect(s.intent).toBe('columns');
    expect(s.primaryCount).toBe(3);
    expect(s.secondaryCount).toBe(2);
    expect(notified).toBeGreaterThan(0);
    unsub();
  });

  it("resolve('create-all') → επιλύει σε 'create-all' και κλείνει", async () => {
    const p = requestColumnDiscreteIntentConfirm({ intent: 'walls', primaryCount: 1, secondaryCount: 1 });
    resolveColumnPerimeterConfirm('create-all');
    await expect(p).resolves.toBe('create-all');
    expect(getColumnPerimeterConfirmState().open).toBe(false);
  });

  it("resolve('create-primary') → επιλύει σε 'create-primary' και κλείνει", async () => {
    const p = requestColumnDiscreteIntentConfirm({ intent: 'columns', primaryCount: 2, secondaryCount: 1 });
    resolveColumnPerimeterConfirm('create-primary');
    await expect(p).resolves.toBe('create-primary');
    expect(getColumnPerimeterConfirmState().open).toBe(false);
  });

  it("resolve('cancel') → επιλύει σε 'cancel' και κλείνει", async () => {
    const p = requestColumnDiscreteIntentConfirm({ intent: 'columns', primaryCount: 1, secondaryCount: 2 });
    resolveColumnPerimeterConfirm('cancel');
    await expect(p).resolves.toBe('cancel');
    expect(getColumnPerimeterConfirmState().open).toBe(false);
  });

  it('is-column warn → ανοίγει σε mode is-column με aspect', () => {
    const p = requestColumnIsColumnWarn(3.5);
    const s = getColumnPerimeterConfirmState();
    expect(s.open).toBe(true);
    expect(s.mode).toBe('is-column');
    expect(s.aspect).toBeCloseTo(3.5);
    resolveColumnPerimeterConfirm('create-all');
    return expect(p).resolves.toBe('create-all');
  });
});
