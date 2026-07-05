/**
 * Unit tests — ADR-513 §direct-distance-entry (AutoCAD heads-up στο «Δαχτυλίδι Εντολών»):
 *   (α) `isHeadsUpNumericKey` — pure διάκριση πλήκτρου που ανοίγει αυτόματα το «Μήκος».
 *   (β) `lengthRingField.clearOnPlace` — one-shot reset του Μήκους μετά την τοποθέτηση (η Γωνία μένει).
 */

import { isHeadsUpNumericKey } from '../components/RadialCommandRing';
import { DynamicInputLockStore } from '../DynamicInputLockStore';
import { lengthRingField, angleRingField, type RingUnitContext } from '../ring-config';

type KeyLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey'>;
const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...mods,
});

describe('isHeadsUpNumericKey', () => {
  it('δέχεται όλα τα ψηφία 0-9', () => {
    for (let d = 0; d <= 9; d++) {
      expect(isHeadsUpNumericKey(key(String(d)))).toBe(true);
    }
  });

  it('δέχεται δεκαδικό (τελεία & κόμμα) και πρόσημο', () => {
    expect(isHeadsUpNumericKey(key('.'))).toBe(true);
    expect(isHeadsUpNumericKey(key(','))).toBe(true);
    expect(isHeadsUpNumericKey(key('-'))).toBe(true);
  });

  it('απορρίπτει γράμματα / control keys', () => {
    for (const k of ['a', 'Z', 'Enter', 'Tab', 'Escape', 'Backspace', 'ArrowLeft', ' ', '+', '=']) {
      expect(isHeadsUpNumericKey(key(k))).toBe(false);
    }
  });

  it('απορρίπτει ψηφίο ΜΕ ctrl/alt/meta (shortcuts δεν κλέβονται)', () => {
    expect(isHeadsUpNumericKey(key('1', { ctrlKey: true }))).toBe(false);
    expect(isHeadsUpNumericKey(key('2', { altKey: true }))).toBe(false);
    expect(isHeadsUpNumericKey(key('3', { metaKey: true }))).toBe(false);
  });
});

describe('lengthRingField.clearOnPlace (one-shot direct-distance-entry)', () => {
  const CTX: RingUnitContext = { displayUnit: 'mm', sceneUnits: 'mm' };
  afterEach(() => DynamicInputLockStore.unlock());

  it('ορίζεται ως συνάρτηση στο πεδίο Μήκους', () => {
    expect(typeof lengthRingField('x').clearOnPlace).toBe('function');
  });

  it('καθαρίζει το locked length μετά την τοποθέτηση', () => {
    const f = lengthRingField('x');
    f.commitNumeric?.(2500, CTX);
    expect(DynamicInputLockStore.getLocked().length).not.toBeNull();
    f.clearOnPlace?.();
    expect(DynamicInputLockStore.getLocked().length).toBeNull();
  });

  it('ΔΕΝ πειράζει το locked angle (polar-like persists)', () => {
    const len = lengthRingField('x');
    const ang = angleRingField('y');
    len.commitNumeric?.(2500, CTX);
    ang.commitNumeric?.(45, CTX);
    len.clearOnPlace?.();
    expect(DynamicInputLockStore.getLocked().length).toBeNull();
    expect(DynamicInputLockStore.getLocked().angle).toBeCloseTo(45);
  });

  it('η Γωνία ΔΕΝ έχει clearOnPlace (μένει κλειδωμένη μεταξύ segments)', () => {
    expect(angleRingField('y').clearOnPlace).toBeUndefined();
  });
});
