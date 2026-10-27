/**
 * Τιμολόγηση PO — συμβάσεις ανά γραμμή → εκπτώσεις → σύνολα (ADR-923 §5.11 «3γ»).
 * Η ίδια συνάρτηση τρέχει στον server (αυθεντικά) και στη φόρμα (προεπισκόπηση).
 */

import { pricePurchaseOrder, pricedRecord, type POPricingInput, type POPricingLine } from '../price-purchase-order-pure';
import { FA_INSIDE_MS, makeAgreement } from '@/subapps/procurement/__fixtures__/framework-agreement-fixture';

function line(unitPrice: number, overrides: Partial<POPricingLine> = {}): POPricingLine {
  return { quantity: 1, unitPrice, materialId: null, categoryCode: 'OIK-7', ...overrides };
}

function input(items: POPricingLine[], overrides: Partial<POPricingInput> = {}): POPricingInput {
  return { supplierId: 'sup_1', projectId: 'p_1', items, taxRate: 24, atMs: FA_INSIDE_MS, ...overrides };
}

const TIERED = {
  discountType: 'volume_breakpoints' as const,
  flatDiscountPercent: null,
  volumeBreakpoints: [{ thresholdEur: 1000, discountPercent: 5 }, { thresholdEur: 5000, discountPercent: 10 }],
};

describe('Α2 — η έκπτωση μειώνει τη φορολογητέα αξία, ο ΦΠΑ υπολογίζεται μετά', () => {
  it('1.000 € −10% @24% ⇒ 900 + 216 = 1.116 € πληρωτέο', () => {
    const pricing = pricePurchaseOrder([makeAgreement('fa_1')], input([line(1000)]));
    expect(pricing.totals).toEqual({ subtotal: 1000, discountAmount: 100, taxableAmount: 900, taxAmount: 216, total: 1116 });
    expect(pricing.lines[0].faDiscount).toEqual({ agreementId: 'fa_1', discountPercent: 10, discountAmount: 100 });
    expect(pricing.appliedFaIds).toEqual(['fa_1']);
  });
});

describe('Α3 — η έκπτωση πέφτει ΜΟΝΟ στις γραμμές του εύρους', () => {
  it('−10% μόνο στα καλώδια: 500 καλώδιο + 500 τσιμέντο ⇒ έκπτωση 50, όχι 100', () => {
    const cables = makeAgreement('cables', { applicableMaterialIds: ['m_cable'] });
    const pricing = pricePurchaseOrder([cables], input([line(500, { materialId: 'm_cable' }), line(500, { materialId: 'm_cement', categoryCode: 'OIK-2' })]));
    expect(pricing.lines.map((l) => l.faDiscount?.discountAmount ?? 0)).toEqual([50, 0]);
    expect(pricing.totals).toEqual({ subtotal: 1000, discountAmount: 50, taxableAmount: 950, taxAmount: 228, total: 1178 });
  });

  it('δύο συμβάσεις σε διαφορετικές γραμμές: κάθε γραμμή τη δική της', () => {
    const cables = makeAgreement('cables', { applicableMaterialIds: ['m_cable'], flatDiscountPercent: 10 });
    const cement = makeAgreement('cement', { applicableAtoeCategoryCodes: ['OIK-2'], flatDiscountPercent: 20 });
    const pricing = pricePurchaseOrder([cables, cement], input([line(100, { materialId: 'm_cable' }), line(100, { categoryCode: 'OIK-2' })]));
    expect(pricing.lines.map((l) => l.faDiscount?.agreementId)).toEqual(['cables', 'cement']);
    expect(pricing.totals.discountAmount).toBe(30);
    expect([...pricing.appliedFaIds].sort()).toEqual(['cables', 'cement']);
  });
});

describe('group condition — η κλίμακα μετρά στο άθροισμα των γραμμών ΤΗΣ σύμβασης', () => {
  it('2.000 + 2.000 εντός εύρους (4.000 ⇒ 5%) · η γραμμή 10.000 εκτός εύρους ΔΕΝ ανεβάζει την κλίμακα', () => {
    const fa = makeAgreement('vol', { ...TIERED, applicableMaterialIds: ['m_cable'] });
    const pricing = pricePurchaseOrder([fa], input([
      line(2000, { materialId: 'm_cable' }),
      line(2000, { materialId: 'm_cable' }),
      line(10000, { materialId: 'm_other', categoryCode: 'OIK-2' }),
    ]));
    expect(pricing.lines.map((l) => l.faDiscount?.discountAmount ?? 0)).toEqual([100, 100, 0]);
  });

  it('3.000 + 3.000 ⇒ βάση 6.000 ≥ 5.000 ⇒ 10% σε ΚΑΘΕ γραμμή (όχι 5% ανά γραμμή)', () => {
    const pricing = pricePurchaseOrder([makeAgreement('vol', TIERED)], input([line(3000), line(3000)]));
    expect(pricing.lines.map((l) => l.faDiscount?.discountPercent)).toEqual([10, 10]);
    expect(pricing.totals.discountAmount).toBe(600);
  });

  it('κάτω από την πρώτη κλίμακα ⇒ καμία έκπτωση και η σύμβαση ΔΕΝ γράφεται ως εφαρμοσμένη', () => {
    const pricing = pricePurchaseOrder([makeAgreement('vol', TIERED)], input([line(500)]));
    expect(pricing.lines[0].faDiscount).toBeNull();
    expect(pricing.appliedFaIds).toEqual([]);
  });
});

describe('ασάφεια, ημερομηνία τιμολόγησης, όρια', () => {
  it('ισοπαλία ⇒ καμία έκπτωση στη γραμμή + ορατή σημαία', () => {
    const pricing = pricePurchaseOrder([makeAgreement('a'), makeAgreement('b')], input([line(100), line(100)]));
    expect(pricing.ambiguousLineIndexes).toEqual([0, 1]);
    expect(pricing.totals.discountAmount).toBe(0);
    expect(pricing.appliedFaIds).toEqual([]);
  });

  it('η ημερομηνία τιμολόγησης αποφασίζει, όχι το «τώρα»', () => {
    const fa = makeAgreement('fa_1', { validUntil: '2026-06-30T00:00:00.000Z' });
    expect(pricePurchaseOrder([fa], input([line(100)], { atMs: Date.parse('2026-05-01T00:00:00Z') })).totals.discountAmount).toBe(10);
    expect(pricePurchaseOrder([fa], input([line(100)], { atMs: Date.parse('2026-08-01T00:00:00Z') })).totals.discountAmount).toBe(0);
  });

  it('χωρίς προμηθευτή ή έργο ⇒ χωρίς συμβάσεις, αλλά τα σύνολα υπολογίζονται', () => {
    const pricing = pricePurchaseOrder([makeAgreement('fa_1')], input([line(100)], { supplierId: '' }));
    expect(pricing.totals).toEqual({ subtotal: 100, discountAmount: 0, taxableAmount: 100, taxAmount: 24, total: 124 });
    expect(pricing.lines[0].selection).toBeNull();
  });

  it('γραμμή που δεν αναπαρίσταται ⇒ μετρά 0 και αναφέρεται (ο server την αρνείται)', () => {
    const pricing = pricePurchaseOrder([], input([line(100), line(0.12345)]));
    expect(pricing.invalidLineIndexes).toEqual([1]);
    expect(pricing.totals.subtotal).toBe(100);
  });
});

describe('pricedRecord — τα πεδία που γράφει η PO', () => {
  it('το total γραμμής είναι του server, ό,τι κι αν έστειλε ο πελάτης', () => {
    const items = [{ ...line(1000), description: 'καλώδιο', total: 999999 }];
    const record = pricedRecord(items, pricePurchaseOrder([makeAgreement('fa_1')], input(items)));
    expect(record.items[0]).toMatchObject({ description: 'καλώδιο', total: 1000, faDiscount: { agreementId: 'fa_1', discountAmount: 100 } });
    expect(record).toMatchObject({ subtotal: 1000, discountAmount: 100, taxableAmount: 900, taxAmount: 216, total: 1116, appliedFaIds: ['fa_1'] });
  });
});
