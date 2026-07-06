/**
 * ADR-397/513 — applyTypedAngleKey SSoT (inline typed rotation-angle input, shared grip ⊕ ROTATE tool).
 * Κλειδώνει: πολυψήφια συσσώρευση, κόμμα ≡ τελεία, signed, Backspace edit, Enter commit-signal, non-keys.
 */

import { DirectDistanceEntry } from '../../../text-engine/interaction/DirectDistanceEntry';
import { applyTypedAngleKey } from '../typed-angle-entry';

describe('ADR-397/513 — applyTypedAngleKey', () => {
  let dde: DirectDistanceEntry;
  beforeEach(() => { dde = new DirectDistanceEntry(); });

  it('buffers a single digit (consumed, preview value)', () => {
    const r = applyTypedAngleKey(dde, '4');
    expect(r).toMatchObject({ consumed: true, kind: 'buffer', buffer: '4', value: 4 });
  });

  it('ΣΥΣΣΩΡΕΥΕΙ πολλά ψηφία (45, 90) — όχι μόνο το πρώτο', () => {
    applyTypedAngleKey(dde, '4');
    const r = applyTypedAngleKey(dde, '5');
    expect(r).toMatchObject({ kind: 'buffer', buffer: '45', value: 45 });
  });

  it('κόμμα ≡ τελεία (45,5 ≡ 45.5) — κανονικοποίηση για έγκυρο Number()', () => {
    for (const k of ['4', '5', ',', '5']) applyTypedAngleKey(dde, k);
    const s = dde.snapshot();
    expect(s.buffer).toBe('45.5');
    expect(s.value).toBeCloseTo(45.5, 6);
  });

  it('τελεία δεκαδικό λειτουργεί επίσης (45.5)', () => {
    for (const k of ['4', '5', '.', '5']) applyTypedAngleKey(dde, k);
    expect(dde.snapshot().value).toBeCloseTo(45.5, 6);
  });

  it('αρνητική γωνία (-30, signed +CCW/−CW, ΧΩΡΙΣ normalize)', () => {
    for (const k of ['-', '3', '0']) applyTypedAngleKey(dde, k);
    expect(dde.snapshot().value).toBe(-30);
  });

  it('Backspace επεξεργάζεται το buffer όσο πληκτρολογείς', () => {
    for (const k of ['4', '5']) applyTypedAngleKey(dde, k);
    const r = applyTypedAngleKey(dde, 'Backspace');
    expect(r).toMatchObject({ consumed: true, kind: 'buffer', buffer: '4', value: 4 });
  });

  it('Backspace ΕΚΤΟΣ εισαγωγής = no-op (δεν καταναλώνεται → smart-delete δουλεύει)', () => {
    const r = applyTypedAngleKey(dde, 'Backspace');
    expect(r).toMatchObject({ consumed: false, kind: 'none' });
  });

  it('Enter → σήμα commit με την τιμή (consumed)', () => {
    for (const k of ['9', '0']) applyTypedAngleKey(dde, k);
    const r = applyTypedAngleKey(dde, 'Enter');
    expect(r).toMatchObject({ consumed: true, kind: 'commit', value: 90 });
  });

  it('Enter με κενό buffer → commit-signal καταναλώνεται (value null· ο caller αποφασίζει)', () => {
    const r = applyTypedAngleKey(dde, 'Enter');
    expect(r).toMatchObject({ consumed: true, kind: 'commit', value: null });
  });

  it('πλήκτρο εκτός αλφαβήτου γωνίας → none, ΔΕΝ καταναλώνεται', () => {
    const r = applyTypedAngleKey(dde, 'a');
    expect(r).toMatchObject({ consumed: false, kind: 'none' });
  });
});
