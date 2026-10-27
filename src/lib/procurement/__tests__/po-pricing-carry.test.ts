/**
 * Πάγωμα όρων PO στην επεξεργασία (ADR-923 §5.11 «3γ», Α9).
 *
 * Μοντέλο «σύμβαση-πηγή ανά γραμμή» (Oracle BPA source · SAP pricing type D/G/B · commercetools
 * Frozen Cart): αμετάβλητη γραμμή ⇒ αμετάβλητοι όροι · αλλαγμένη βάση ⇒ ίδια σύμβαση, νέα κλίμακα ·
 * νέα γραμμή ⇒ σημερινή επιλογή · νέα τιμολόγηση ΜΟΝΟ ρητά.
 */

import { pricePurchaseOrder, type POPricing, type POPricingInput, type POPricingLine } from '../price-purchase-order-pure';
import { pricingDrift, type POStoredPricing } from '../po-pricing-carry';
import { FA_INSIDE_MS, makeAgreement } from '@/subapps/procurement/__fixtures__/framework-agreement-fixture';

const CABLE: POPricingLine = { quantity: 1, unitPrice: 500, materialId: 'm_cable', categoryCode: 'OIK-9' };
const CONCRETE: POPricingLine = { quantity: 1, unitPrice: 500, materialId: 'm_concrete', categoryCode: 'OIK-2' };
const CEMENT: POPricingLine = { quantity: 1, unitPrice: 200, materialId: 'm_cement', categoryCode: 'OIK-2' };

const FWA_1 = makeAgreement('fwa_1', { applicableMaterialIds: ['m_cable'] });
const FWA_2 = makeAgreement('fwa_2', { applicableMaterialIds: ['m_cable'], flatDiscountPercent: 15 });

const TIERED = makeAgreement('vol', {
  discountType: 'volume_breakpoints',
  flatDiscountPercent: null,
  volumeBreakpoints: [{ thresholdEur: 1000, discountPercent: 5 }, { thresholdEur: 5000, discountPercent: 10 }],
});

function input(items: POPricingLine[], overrides: Partial<POPricingInput> = {}): POPricingInput {
  return { supplierId: 'sup_1', projectId: 'p_1', items, taxRate: 24, atMs: FA_INSIDE_MS, ...overrides };
}

/** Η PO όπως αποθηκεύτηκε: γραμμές + η έκπτωση που πήρε κάθε μία τη στιγμή της αποθήκευσης. */
function stored(items: POPricingLine[], pricing: POPricing): POStoredPricing {
  return {
    supplierId: 'sup_1',
    projectId: 'p_1',
    items: items.map((item, index) => ({ ...item, faDiscount: pricing.lines[index].faDiscount })),
  };
}

/** PO-0001 της ζωντανής επαλήθευσης: καλώδιο −10% (FWA-001) + σκυρόδεμα ⇒ 1.178. */
function po0001(): POStoredPricing {
  const items = [CABLE, CONCRETE];
  const created = pricePurchaseOrder([FWA_1], input(items));
  expect(created.totals.total).toBe(1178);
  return stored(items, created);
}

describe('Σ6 — δεύτερη εξίσου ειδική σύμβαση ΜΕΤΑ τη δημιουργία', () => {
  it('η επεξεργασία ΚΡΑΤΑ τους όρους της παραγγελίας: 1.178, όχι 1.240', () => {
    const pricing = pricePurchaseOrder([FWA_1, FWA_2], input([CABLE, CONCRETE]), { stored: po0001(), mode: 'carry' });
    expect(pricing.totals).toEqual({ subtotal: 1000, discountAmount: 50, taxableAmount: 950, taxAmount: 228, total: 1178 });
    expect(pricing.lines.map((l) => l.origin)).toEqual(['frozen', 'frozen']);
    expect(pricing.lines[0].faDiscount).toEqual({ agreementId: 'fwa_1', discountPercent: 10, discountAmount: 50 });
    expect(pricing.repricedLineIndexes).toEqual([]);
    expect(pricing.ambiguousLineIndexes).toEqual([]);
    expect(pricing.appliedFaIds).toEqual(['fwa_1']);
  });

  it('η ρητή «Επανατιμολόγηση» εφαρμόζει τους σημερινούς όρους: ισοπαλία ⇒ 1.240', () => {
    const pricing = pricePurchaseOrder([FWA_1, FWA_2], input([CABLE, CONCRETE]), { stored: po0001(), mode: 'redetermine' });
    expect(pricing.totals.total).toBe(1240);
    expect(pricing.ambiguousLineIndexes).toEqual([0]);
    expect(pricing.lines.map((l) => l.origin)).toEqual(['sourced', 'sourced']);
    expect(pricing.repricedLineIndexes).toEqual([0, 1]);
  });

  it('η ένδειξη μετατόπισης δείχνει ΠΟΙΑ γραμμή θα άλλαζε και πόσο, χωρίς να αλλάξει τίποτα', () => {
    const carried = pricePurchaseOrder([FWA_1, FWA_2], input([CABLE, CONCRETE]), { stored: po0001(), mode: 'carry' });
    const current = pricePurchaseOrder([FWA_1, FWA_2], input([CABLE, CONCRETE]));
    expect(pricingDrift(carried, current)).toEqual({ lineIndexes: [0], totalDelta: 62 });
    expect(pricingDrift(carried, carried)).toEqual({ lineIndexes: [], totalDelta: 0 });
  });
});

describe('τι ξαναβγαίνει και τι όχι', () => {
  it('αλλαγή ΜΟΝΟ ΦΠΑ ⇒ ίδια έκπτωση, νέα σύνολα (SAP pricing type G)', () => {
    const pricing = pricePurchaseOrder([FWA_1, FWA_2], input([CABLE, CONCRETE], { taxRate: 13 }), { stored: po0001(), mode: 'carry' });
    expect(pricing.totals).toEqual({ subtotal: 1000, discountAmount: 50, taxableAmount: 950, taxAmount: 123.5, total: 1073.5 });
    expect(pricing.repricedLineIndexes).toEqual([]);
  });

  it('νέα γραμμή ⇒ τιμολογείται ΜΟΝΟ αυτή· οι παλιές κρατούν τους όρους τους', () => {
    const pricing = pricePurchaseOrder([FWA_1, FWA_2], input([CABLE, CONCRETE, CEMENT]), { stored: po0001(), mode: 'carry' });
    expect(pricing.lines.map((l) => l.origin)).toEqual(['frozen', 'frozen', 'sourced']);
    expect(pricing.lines.map((l) => l.faDiscount?.discountAmount ?? 0)).toEqual([50, 0, 0]);
    expect(pricing.repricedLineIndexes).toEqual([2]);
  });

  it('αλλαγή ποσότητας ⇒ ΙΔΙΑ σύμβαση-πηγή (καμία νέα επιλογή, άρα καμία ισοπαλία), νέο ποσό', () => {
    const pricing = pricePurchaseOrder([FWA_1, FWA_2], input([{ ...CABLE, quantity: 2 }, CONCRETE]), { stored: po0001(), mode: 'carry' });
    expect(pricing.lines[0]).toMatchObject({ origin: 'adjusted', faDiscount: { agreementId: 'fwa_1', discountPercent: 10, discountAmount: 100 } });
    expect(pricing.ambiguousLineIndexes).toEqual([]);
    expect(pricing.repricedLineIndexes).toEqual([0]);
  });

  it('αλλαγή υλικού ⇒ νέα ταυτότητα ⇒ σημερινή επιλογή', () => {
    const pricing = pricePurchaseOrder([FWA_1, FWA_2], input([{ ...CABLE, materialId: 'm_other' }, CONCRETE]), { stored: po0001(), mode: 'carry' });
    expect(pricing.lines[0]).toMatchObject({ origin: 'sourced', faDiscount: null });
  });

  it('αλλαγή προμηθευτή ή έργου ⇒ όλες οι γραμμές από την αρχή', () => {
    const otherSupplier = pricePurchaseOrder([FWA_1], input([CABLE, CONCRETE], { supplierId: 'sup_2' }), { stored: po0001(), mode: 'carry' });
    expect(otherSupplier.lines.map((l) => l.origin)).toEqual(['sourced', 'sourced']);
    const otherProject = pricePurchaseOrder([FWA_1, FWA_2], input([CABLE, CONCRETE], { projectId: 'p_2' }), { stored: po0001(), mode: 'carry' });
    expect(otherProject.lines.map((l) => l.origin)).toEqual(['sourced', 'sourced']);
    expect(otherProject.ambiguousLineIndexes).toEqual([0]);
  });

  it('η σειρά των γραμμών δεν μετρά· κάθε γραμμή βρίσκει την αποθηκευμένη της', () => {
    const pricing = pricePurchaseOrder([FWA_1, FWA_2], input([CONCRETE, CABLE]), { stored: po0001(), mode: 'carry' });
    expect(pricing.lines.map((l) => l.storedIndex)).toEqual([1, 0]);
    expect(pricing.totals.total).toBe(1178);
  });
});

describe('γραμμή χωρίς σύμβαση-πηγή', () => {
  it('αμετάβλητη ⇒ μένει χωρίς έκπτωση, ακόμα κι αν σήμερα υπάρχει σύμβαση που θα την κάλυπτε', () => {
    const concrete = makeAgreement('fwa_c', { applicableAtoeCategoryCodes: ['OIK-2'] });
    const pricing = pricePurchaseOrder([FWA_1, concrete], input([CABLE, CONCRETE]), { stored: po0001(), mode: 'carry' });
    expect(pricing.lines[1]).toMatchObject({ origin: 'frozen', faDiscount: null });
  });

  it('αλλαγμένη ⇒ τιμολογείται με τους σημερινούς όρους', () => {
    const concrete = makeAgreement('fwa_c', { applicableAtoeCategoryCodes: ['OIK-2'] });
    const pricing = pricePurchaseOrder([FWA_1, concrete], input([CABLE, { ...CONCRETE, quantity: 2 }]), { stored: po0001(), mode: 'carry' });
    expect(pricing.lines[1]).toMatchObject({ origin: 'sourced', faDiscount: { agreementId: 'fwa_c', discountAmount: 100 } });
  });
});

describe('σύμβαση-πηγή που δεν υπάρχει πια (διαγράφηκε)', () => {
  it('αμετάβλητη γραμμή ⇒ ίδιοι όροι', () => {
    const pricing = pricePurchaseOrder([], input([CABLE, CONCRETE]), { stored: po0001(), mode: 'carry' });
    expect(pricing.totals.total).toBe(1178);
    expect(pricing.appliedFaIds).toEqual(['fwa_1']);
  });

  it('αλλαγμένη βάση ⇒ το αποθηκευμένο ποσοστό πάνω στο νέο ποσό', () => {
    const pricing = pricePurchaseOrder([], input([{ ...CABLE, quantity: 3 }, CONCRETE]), { stored: po0001(), mode: 'carry' });
    expect(pricing.lines[0]).toMatchObject({ origin: 'adjusted', faDiscount: { agreementId: 'fwa_1', discountPercent: 10, discountAmount: 150 } });
  });
});

describe('group condition — η κλίμακα ακολουθεί το άθροισμα της ομάδας', () => {
  const big: POPricingLine = { quantity: 1, unitPrice: 3000, materialId: null, categoryCode: 'OIK-7' };

  function tieredPO(): POStoredPricing {
    const items = [big, big];
    const created = pricePurchaseOrder([TIERED], input(items));
    expect(created.lines.map((l) => l.faDiscount?.discountPercent)).toEqual([10, 10]);
    return stored(items, created);
  }

  it('αμετάβλητη ομάδα ⇒ αμετάβλητο ποσοστό', () => {
    const pricing = pricePurchaseOrder([TIERED], input([big, big]), { stored: tieredPO(), mode: 'carry' });
    expect(pricing.lines.map((l) => l.origin)).toEqual(['frozen', 'frozen']);
  });

  it('μία γραμμή μικραίνει ⇒ βάση 4.000 ⇒ 5% και στην ΑΜΕΤΑΒΛΗΤΗ γραμμή της ίδιας ομάδας', () => {
    const pricing = pricePurchaseOrder([TIERED], input([big, { ...big, unitPrice: 1000 }]), { stored: tieredPO(), mode: 'carry' });
    expect(pricing.lines.map((l) => l.faDiscount?.discountPercent)).toEqual([5, 5]);
    expect(pricing.lines.map((l) => l.origin)).toEqual(['adjusted', 'adjusted']);
  });

  it('νέα γραμμή που μπαίνει στην ομάδα ανεβάζει τη βάση όλων — και της παλιάς που ήταν κάτω από την κλίμακα', () => {
    const small: POPricingLine = { quantity: 1, unitPrice: 600, materialId: null, categoryCode: 'OIK-7' };
    const items = [small];
    const po = stored(items, pricePurchaseOrder([TIERED], input(items)));
    expect(po.items[0].faDiscount).toBeNull();
    const pricing = pricePurchaseOrder([TIERED], input([small, small]), { stored: po, mode: 'carry' });
    expect(pricing.lines.map((l) => l.faDiscount?.discountPercent ?? 0)).toEqual([5, 5]);
    expect(pricing.lines.map((l) => l.origin)).toEqual(['adjusted', 'sourced']);
  });
});
