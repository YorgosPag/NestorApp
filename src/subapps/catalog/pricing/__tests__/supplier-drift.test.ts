/**
 * Η κρίση απόκλισης τιμής προμηθευτή (ADR-923 §5.12 Δ9 · Σ7).
 */

import { FOREIGN_UNAVAILABLE, type ForeignPrice, type ForeignQuote } from '../foreign-quote';
import { judgeSupplierDrift, type SupplierSnapshot } from '../supplier-drift';

const SNAPSHOT: SupplierSnapshot = { unit: 'pcs', priceQuantity: 2, breakdown: { material: 2000 } };

const priced = (overrides: Partial<ForeignPrice>): ForeignQuote => ({
  kind: 'priced',
  price: {
    priceListId: 'l', priceListVersionId: 'v', lineId: 'x', subjectKey: 's', unitCode: 'pcs', quantity: 2, netAmount: 2000, discountSteps: [], audience: null, ...overrides,
  },
});

describe('judgeSupplierDrift', () => {
  it('ίδια τιμή ⇒ current', () => {
    expect(judgeSupplierDrift(SNAPSHOT, priced({}))).toEqual({ kind: 'current' });
  });

  it('🔴 ίδια τιμή ανά μονάδα σε άλλη ποσότητα ⇒ current, όχι «άλλαξε»', () => {
    expect(judgeSupplierDrift(SNAPSHOT, priced({ quantity: 5, netAmount: 5000 }))).toEqual({ kind: 'current' });
  });

  it('🔴 δεκαδικές ποσότητες δεν σκάνε το BigInt', () => {
    expect(judgeSupplierDrift({ ...SNAPSHOT, priceQuantity: 12.5, breakdown: { material: 12500 } }, priced({ quantity: 12.5, netAmount: 13750 })))
      .toMatchObject({ kind: 'changed', changeBp: 1000, exceedsFence: false });
  });

  it('ακριβώς στον φράχτη ⇒ όχι πάνω του · ένα βήμα πάνω ⇒ φράχτης, προς τα δύο μέρη', () => {
    expect(judgeSupplierDrift(SNAPSHOT, priced({ netAmount: 2400 }))).toMatchObject({ changeBp: 2000, exceedsFence: false });
    expect(judgeSupplierDrift(SNAPSHOT, priced({ netAmount: 2401 }))).toMatchObject({ exceedsFence: true });
    expect(judgeSupplierDrift(SNAPSHOT, priced({ netAmount: 1599 }))).toMatchObject({ exceedsFence: true });
  });

  it('από μηδέν ⇒ χωρίς ποσοστό, πάντα πάνω από τον φράχτη', () => {
    expect(judgeSupplierDrift({ ...SNAPSHOT, breakdown: { material: 0 } }, priced({}))).toMatchObject({ kind: 'changed', changeBp: null, exceedsFence: true });
  });

  it('🔴 άλλη μονάδα ⇒ unitChanged, ποτέ ποσοστό πάνω σε διαφορετικά πράγματα', () => {
    expect(judgeSupplierDrift(SNAPSHOT, priced({ unitCode: 'm2', netAmount: 9999 }))).toEqual({ kind: 'unitChanged' });
  });

  it('🔴 Σ7: η μη διαθέσιμη πηγή δεν κουβαλά τίποτα', () => {
    expect(judgeSupplierDrift(SNAPSHOT, FOREIGN_UNAVAILABLE)).toEqual({ kind: 'unavailable' });
    expect(judgeSupplierDrift(SNAPSHOT, { kind: 'requestQuote' })).toEqual({ kind: 'requestQuote' });
  });
});
