/**
 * ADR-508 §polyline-parity (Giorgio 2026-07-07) — η «πολυγραμμή» μπαίνει στην ΙΔΙΑ commit-λογική με
 * τη γραμμή (`resolveLineFamilyCommitPoint`): length/angle lock στα segments μετά το 1ο σημείο
 * (preview ≡ commit με το typed μήκος), και pass-through όταν δεν υπάρχει lock.
 */

import { resolveLineFamilyCommitPoint } from '../drawing-handler-utils';
import { DynamicInputLockStore } from '../../../systems/dynamic-input/DynamicInputLockStore';

describe('resolveLineFamilyCommitPoint — polyline parity', () => {
  afterEach(() => DynamicInputLockStore.unlock());

  it('εφαρμόζει το locked μήκος στο ενεργό segment (click-2, tempPointsLength=1)', () => {
    const lastRef = { x: 0, y: 0 };
    DynamicInputLockStore.lockLength(500);
    // cursor στα (300,0): χωρίς lock θα έμενε 300· με lock → 500 κατά μήκος της ίδιας φοράς (+x).
    const out = resolveLineFamilyCommitPoint('polyline', { x: 300, y: 0 }, 1, lastRef, 'mm');
    expect(Math.hypot(out.x - lastRef.x, out.y - lastRef.y)).toBeCloseTo(500);
    expect(out.x).toBeCloseTo(500);
    expect(out.y).toBeCloseTo(0);
  });

  it('pass-through όταν ΔΕΝ υπάρχει lock (ελεύθερη περιστροφή του segment)', () => {
    const lastRef = { x: 10, y: 10 };
    const out = resolveLineFamilyCommitPoint('polyline', { x: 40, y: 50 }, 1, lastRef, 'mm');
    // Χωρίς face-snap targets + χωρίς lock → το σημείο μένει αυτούσιο.
    expect(out.x).toBeCloseTo(40);
    expect(out.y).toBeCloseTo(50);
  });

  it('locked γωνία περιστρέφει το segment στη δηλωμένη φορά', () => {
    const lastRef = { x: 0, y: 0 };
    DynamicInputLockStore.lockAngle(90); // κάθετα προς +y
    const out = resolveLineFamilyCommitPoint('polyline', { x: 200, y: 5 }, 1, lastRef, 'mm');
    // απόσταση διατηρείται (~200), φορά κλειδώνεται στις 90° → x≈0, y≈+dist
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBeGreaterThan(0);
  });
});
