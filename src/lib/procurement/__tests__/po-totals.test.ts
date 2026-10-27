/**
 * Σύνολα παραγγελίας — ο ΕΝΑΣ λογαριασμός (ADR-923 §5.11 «3γ», Α2 + Α6).
 * Ο ΦΠΑ υπολογίζεται πάνω στη φορολογητέα αξία ΜΕΤΑ την έκπτωση (ν. 2859/2000 άρθ. 19 §5α · EN 16931).
 */

import {
  computePOTotalsMinor,
  poLineGrossMinor,
  poTotalsInMajor,
  vatMinor,
} from '../po-totals';

describe('poLineGrossMinor — ποσότητα × τιμή σε λεπτά, μία στρογγύλευση', () => {
  it('3 × 33,33 € = 99,99 €', () => {
    expect(poLineGrossMinor({ quantity: 3, unitPrice: 33.33 })).toBe(9999);
  });

  it('0,29 × 3 = 0,87 € (η float παγίδα 0,8699…)', () => {
    expect(poLineGrossMinor({ quantity: 3, unitPrice: 0.29 })).toBe(87);
  });

  it('τιμή με 4 δεκαδικά και κλασματική ποσότητα: 12,5 × 0,1250 € = 1,5625 € ⇒ 1,56 €', () => {
    expect(poLineGrossMinor({ quantity: 12.5, unitPrice: 0.125 })).toBe(156);
  });

  it('στρογγυλεύει μισό-προς-τα-πάνω: 1 × 0,0050 € ⇒ 1 λεπτό', () => {
    expect(poLineGrossMinor({ quantity: 1, unitPrice: 0.005 })).toBe(1);
  });

  it('αρνείται (null) ό,τι δεν αναπαρίσταται ακριβώς — ποτέ σιωπηλή στρογγύλευση', () => {
    expect(poLineGrossMinor({ quantity: 1.2345, unitPrice: 10 })).toBeNull();
    expect(poLineGrossMinor({ quantity: 1, unitPrice: 0.12345 })).toBeNull();
    expect(poLineGrossMinor({ quantity: 1, unitPrice: -1 })).toBeNull();
    expect(poLineGrossMinor({ quantity: 0, unitPrice: 1 })).toBeNull();
    expect(poLineGrossMinor({ quantity: 1, unitPrice: Number.NaN })).toBeNull();
  });
});

describe('vatMinor — ΦΠΑ πάνω στη φορολογητέα βάση', () => {
  it('900,00 € × 24% = 216,00 €', () => {
    expect(vatMinor(90000, 24)).toBe(21600);
  });

  it('μισό-προς-τα-πάνω: 3 λεπτά × 24% = 0,72 ⇒ 1 · 1 λεπτό × 24% = 0,24 ⇒ 0', () => {
    expect(vatMinor(3, 24)).toBe(1);
    expect(vatMinor(1, 24)).toBe(0);
  });

  it('αρνείται συντελεστή που δεν είναι ακέραιο ποσοστό 0..100', () => {
    expect(() => vatMinor(100, 23.5)).toThrow(RangeError);
    expect(() => vatMinor(100, 101)).toThrow(RangeError);
    expect(() => vatMinor(100, -1)).toThrow(RangeError);
  });
});

describe('computePOTotalsMinor — υποσύνολο → έκπτωση → φορολογητέα → ΦΠΑ → σύνολο', () => {
  it('Α2: 1.000 € −10% @24% ⇒ φορολογητέα 900, ΦΠΑ 216, πληρωτέο 1.116 (όχι ΦΠΑ 240 / σύνολο 1.240)', () => {
    expect(computePOTotalsMinor([{ gross: 100000, discount: 10000 }], 24)).toEqual({
      subtotal: 100000,
      discountAmount: 10000,
      taxableAmount: 90000,
      taxAmount: 21600,
      total: 111600,
    });
  });

  it('ο ΦΠΑ στρογγυλεύεται ΜΙΑ φορά στο σύνολο της βάσης, όχι ανά γραμμή (EN 16931 BT-116/117)', () => {
    // ανά γραμμή: 0,72→1 + 0,72→1 = 2 λεπτά· στη βάση: 6 × 24% = 1,44 ⇒ 1 λεπτό
    const totals = computePOTotalsMinor([{ gross: 3, discount: 0 }, { gross: 3, discount: 0 }], 24);
    expect(totals.taxAmount).toBe(1);
    expect(totals.total).toBe(7);
  });

  it('χωρίς γραμμές ⇒ όλα μηδέν', () => {
    expect(computePOTotalsMinor([], 24)).toEqual({ subtotal: 0, discountAmount: 0, taxableAmount: 0, taxAmount: 0, total: 0 });
  });

  it('αναλλοίωτα: subtotal − discount = taxable, taxable + tax = total', () => {
    const totals = computePOTotalsMinor([{ gross: 12345, discount: 1234 }, { gross: 678, discount: 0 }], 13);
    expect(totals.subtotal - totals.discountAmount).toBe(totals.taxableAmount);
    expect(totals.taxableAmount + totals.taxAmount).toBe(totals.total);
  });
});

describe('poTotalsInMajor', () => {
  it('λεπτά → ευρώ για αποθήκευση και προβολή', () => {
    expect(poTotalsInMajor({ subtotal: 100000, discountAmount: 10000, taxableAmount: 90000, taxAmount: 21600, total: 111600 }))
      .toEqual({ subtotal: 1000, discountAmount: 100, taxableAmount: 900, taxAmount: 216, total: 1116 });
  });
});
