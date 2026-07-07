/**
 * ADR-397/513 — applyTypedAngleKey SSoT (inline typed rotation-angle input, shared grip ⊕ ROTATE tool).
 * Κλειδώνει: πολυψήφια συσσώρευση, κόμμα ≡ τελεία, signed, Backspace edit, Enter commit-signal, non-keys.
 */

import { DirectDistanceEntry } from '../../../text-engine/interaction/DirectDistanceEntry';
import { applyTypedAngleKey, applyTypedNumericKey } from '../typed-angle-entry';

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

describe('ADR-357/397 — applyTypedNumericKey (neutral SSoT + allowNegative)', () => {
  let dde: DirectDistanceEntry;
  beforeEach(() => { dde = new DirectDistanceEntry(); });

  it('συσσωρεύει ψηφία (ίδια input-λογική με το angle alias)', () => {
    applyTypedNumericKey(dde, '1');
    const r = applyTypedNumericKey(dde, '2');
    expect(r).toMatchObject({ kind: 'buffer', buffer: '12', value: 12 });
  });

  it('κόμμα-parity δωρεάν για αποστάσεις (1,5 ≡ 1.5)', () => {
    for (const k of ['1', ',', '5']) applyTypedNumericKey(dde, k, { allowNegative: false });
    const s = dde.snapshot();
    expect(s.buffer).toBe('1.5');
    expect(s.value).toBeCloseTo(1.5, 6);
  });

  it('allowNegative:false → το «-» ΔΕΝ καταναλώνεται (απόσταση πάντα θετική, AutoCAD DDE)', () => {
    const r = applyTypedNumericKey(dde, '-', { allowNegative: false });
    expect(r).toMatchObject({ consumed: false, kind: 'none' });
    expect(dde.snapshot().buffer).toBe('');
  });

  it('allowNegative default (true) → το «-» γίνεται δεκτό (γωνία signed)', () => {
    for (const k of ['-', '9', '0']) applyTypedNumericKey(dde, k);
    expect(dde.snapshot().value).toBe(-90);
  });

  it('Enter → commit-signal με parsed απόσταση', () => {
    for (const k of ['5', '0']) applyTypedNumericKey(dde, k, { allowNegative: false });
    const r = applyTypedNumericKey(dde, 'Enter', { allowNegative: false });
    expect(r).toMatchObject({ consumed: true, kind: 'commit', value: 50 });
  });

  it('applyTypedAngleKey === thin alias (byte-identical με allowNegative default)', () => {
    const a = new DirectDistanceEntry();
    const b = new DirectDistanceEntry();
    for (const k of ['4', '5', ',', '5']) {
      expect(applyTypedAngleKey(a, k)).toEqual(applyTypedNumericKey(b, k));
    }
  });
});
