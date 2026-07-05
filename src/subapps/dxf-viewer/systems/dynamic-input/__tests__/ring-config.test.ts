/**
 * Unit tests — ring-config (ADR-513 §line-parity): κοινοί builders Μήκους/Γωνίας (lock στο
 * `DynamicInputLockStore`, ίδιοι για τοίχο & γραμμή) + `combineSubscribers`.
 */

import { DynamicInputLockStore } from '../DynamicInputLockStore';
import {
  type RingUnitContext,
  lengthRingField,
  angleRingField,
  combineSubscribers,
  ringStartKey,
} from '../ring-config';

const CTX: RingUnitContext = { displayUnit: 'mm', sceneUnits: 'mm' };

describe('lengthRingField', () => {
  afterEach(() => DynamicInputLockStore.unlock());

  it('numeric, key = length', () => {
    const f = lengthRingField('tools.ring.length');
    expect(f.kind).toBe('numeric');
    expect(f.key).toBe('length');
    expect(f.labelKey).toBe('tools.ring.length');
  });

  it('isLocked ⇔ υπάρχει locked length', () => {
    const f = lengthRingField('x');
    expect(f.isLocked()).toBe(false);
    DynamicInputLockStore.lockLength(500);
    expect(f.isLocked()).toBe(true);
  });

  it('seed = κενό χωρίς lock, formatted όταν κλειδωμένο (mm scene = identity)', () => {
    const f = lengthRingField('x');
    expect(f.seed(CTX)).toBe('');
    DynamicInputLockStore.lockLength(3000);
    expect(f.seed(CTX)).toContain('3000');
  });

  it('commitNumeric κλειδώνει το μήκος (mm display + mm scene = identity)', () => {
    lengthRingField('x').commitNumeric?.(1500, CTX);
    expect(DynamicInputLockStore.getLocked().length).toBeCloseTo(1500);
  });
});

describe('angleRingField', () => {
  afterEach(() => DynamicInputLockStore.unlock());

  it('numeric, key = angle', () => {
    const f = angleRingField('tools.ring.angle');
    expect(f.kind).toBe('numeric');
    expect(f.key).toBe('angle');
  });

  it('commitNumeric κανονικοποιεί τη γωνία στο [0,360)', () => {
    angleRingField('x').commitNumeric?.(-90, CTX);
    expect(DynamicInputLockStore.getLocked().angle).toBeCloseTo(270);
  });

  it('seed = κενό χωρίς lock, 2 δεκαδικά όταν κλειδωμένο', () => {
    const f = angleRingField('x');
    expect(f.seed(CTX)).toBe('');
    DynamicInputLockStore.lockAngle(45);
    expect(f.seed(CTX)).toBe('45.00');
  });
});

describe('ringStartKey', () => {
  it('συντεταγμένες αρχής όταν υπάρχει σημείο', () => {
    expect(ringStartKey({ x: 12, y: 34 })).toBe('12,34');
  });
  it('default fallback (κενό) χωρίς σημείο', () => {
    expect(ringStartKey(null)).toBe('');
    expect(ringStartKey(undefined)).toBe('');
  });
  it('custom fallback χωρίς σημείο', () => {
    expect(ringStartKey(null, 'line-pending')).toBe('line-pending');
  });
});

describe('combineSubscribers', () => {
  it('εγγράφει σε όλους & ένα unsubscribe καθαρίζει όλους', () => {
    const log: string[] = [];
    const make = (tag: string) => (cb: () => void) => {
      log.push(`sub:${tag}`);
      cb();
      return () => log.push(`unsub:${tag}`);
    };
    const combined = combineSubscribers(make('a'), make('b'));
    const unsub = combined(() => log.push('fire'));
    expect(log).toEqual(['sub:a', 'fire', 'sub:b', 'fire']);
    unsub();
    expect(log.slice(-2)).toEqual(['unsub:a', 'unsub:b']);
  });
});
