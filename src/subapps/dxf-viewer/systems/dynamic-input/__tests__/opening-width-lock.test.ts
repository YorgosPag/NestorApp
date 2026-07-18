/**
 * ADR-513 §opening-width — tests για το `resolveOpeningWidthLockedDelta` (dynamic-input πλάτος
 * κουφώματος). Επιβεβαιώνει: φορά από την πλευρά κέρσορα ως προς τη λαβή, signed πληκτρολογημένη τιμή,
 * ευθυγράμμιση με τον τοπικό άξονα (rotation), και τα no-op gates (no lock / όχι λαβή παρειάς / χωρίς
 * γεωμετρία). Χρησιμοποιεί το ΠΡΑΓΜΑΤΙΚΟ `DynamicInputLockStore` (zero-React) — όχι mock store.
 */

import {
  resolveOpeningWidthLockedDelta,
  isOpeningCornerGripKind,
} from '../opening-width-lock';
import { DynamicInputLockStore } from '../DynamicInputLockStore';
import type { OpeningGripKind } from '../../../hooks/grip-kinds';

// Κούφωμα με κέντρο στην αρχή· rotation=0 → άξονας τοίχου = +x.
const openingAtOrigin = (rotation = 0) => ({ geometry: { position: { x: 0, y: 0 }, rotation } });

// Λαβή end-jamb (θετική αξονική) στη μονάδα width — η ακριβής τιμή δεν έχει σημασία (σχετική).
const END_GRIP = { x: 5, y: 0 };

describe('ADR-513 §opening-width — resolveOpeningWidthLockedDelta', () => {
  afterEach(() => DynamicInputLockStore.unlock());

  it('επιστρέφει null όταν ΔΕΝ υπάρχει ενεργό lock', () => {
    expect(
      resolveOpeningWidthLockedDelta(openingAtOrigin(), 'opening-corner-ne', END_GRIP, { x: 9, y: 0 }),
    ).toBeNull();
  });

  it('επιστρέφει null για μη-λαβή-παρειάς (move/rotation/facing)', () => {
    DynamicInputLockStore.lockLength(100);
    for (const kind of ['opening-move', 'opening-rotation', 'opening-facing'] as OpeningGripKind[]) {
      expect(resolveOpeningWidthLockedDelta(openingAtOrigin(), kind, END_GRIP, { x: 9, y: 0 })).toBeNull();
    }
  });

  it('επιστρέφει null χωρίς γεωμετρία κουφώματος', () => {
    DynamicInputLockStore.lockLength(100);
    expect(resolveOpeningWidthLockedDelta({}, 'opening-corner-ne', END_GRIP, { x: 9, y: 0 })).toBeNull();
    expect(resolveOpeningWidthLockedDelta(null, 'opening-corner-ne', END_GRIP, { x: 9, y: 0 })).toBeNull();
  });

  it('κέρσορας ΠΡΟΣ ΤΑ ΕΞΩ (πέρα από τη λαβή) → μετατόπιση +100 κατά τον άξονα (μεγαλώνει)', () => {
    DynamicInputLockStore.lockLength(100);
    const delta = resolveOpeningWidthLockedDelta(openingAtOrigin(), 'opening-corner-ne', END_GRIP, { x: 20, y: 0 });
    expect(delta).not.toBeNull();
    expect(delta!.x).toBeCloseTo(100);
    expect(delta!.y).toBeCloseTo(0);
  });

  it('κέρσορας ΠΡΟΣ ΤΑ ΜΕΣΑ (πριν τη λαβή) → μετατόπιση −100 κατά τον άξονα (μικραίνει)', () => {
    DynamicInputLockStore.lockLength(100);
    const delta = resolveOpeningWidthLockedDelta(openingAtOrigin(), 'opening-corner-ne', END_GRIP, { x: 1, y: 0 });
    expect(delta!.x).toBeCloseTo(-100);
    expect(delta!.y).toBeCloseTo(0);
  });

  it('αρνητική πληκτρολογημένη τιμή ΑΝΤΙΣΤΡΕΦΕΙ τη φορά', () => {
    DynamicInputLockStore.lockLength(-100);
    // κέρσορας προς τα έξω (dirSign +1) αλλά τιμή −100 → −100 (αντιστροφή).
    const delta = resolveOpeningWidthLockedDelta(openingAtOrigin(), 'opening-corner-ne', END_GRIP, { x: 20, y: 0 });
    expect(delta!.x).toBeCloseTo(-100);
  });

  it('ευθυγραμμίζεται με τον τοπικό άξονα (rotation=90° → μετατόπιση κατά y)', () => {
    DynamicInputLockStore.lockLength(100);
    const rot = Math.PI / 2; // άξονας = +y
    const grip = { x: 0, y: 5 };
    const delta = resolveOpeningWidthLockedDelta(openingAtOrigin(rot), 'opening-corner-ne', grip, { x: 0, y: 20 });
    expect(delta!.x).toBeCloseTo(0);
    expect(delta!.y).toBeCloseTo(100);
  });

  it('isOpeningCornerGripKind: true ΜΟΝΟ για τις 4 λαβές παρειάς', () => {
    for (const k of ['opening-corner-ne', 'opening-corner-nw', 'opening-corner-sw', 'opening-corner-se'] as OpeningGripKind[]) {
      expect(isOpeningCornerGripKind(k)).toBe(true);
    }
    for (const k of ['opening-move', 'opening-rotation', 'opening-facing'] as OpeningGripKind[]) {
      expect(isOpeningCornerGripKind(k)).toBe(false);
    }
    expect(isOpeningCornerGripKind(null)).toBe(false);
    expect(isOpeningCornerGripKind(undefined)).toBe(false);
  });
});
