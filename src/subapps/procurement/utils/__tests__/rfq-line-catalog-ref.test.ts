/**
 * @fileoverview **Το SKU και το στιγμιότυπο τιμής στη γραμμή RFQ** (ADR-923 §5.8).
 *
 * 🔴 Το στιγμιότυπο είναι τιμή του προμηθευτή Α, και το ίδιο RFQ φτάνει στον ανταγωνιστή Β. Οι προβολές είναι λίστες επιτρεπόμενων:
 * οι άγκυρες κρατούν πλήρες σύνολο κλειδιών, ώστε και ένα μελλοντικό πεδίο να κοκκινίζει αν βρει δρόμο προς τα έξω.
 */

import type { BoqCostPriceSource, BoqSupplierPriceSource } from '@/types/boq/price-source';
import {
  resolvePublicRfqLines,
  resolveInternalRfqLines,
  rfqLineCatalogFields,
  toPublicLine,
  toPublicRfqLine,
  type RfqLine,
} from '../../types/rfq-line';

const CORE = {
  priceListId: 'pl_1', priceListVersionId: 'plv_1', versionNumber: 3, lineId: 'pll_1', subjectKey: 'variant:var_1', unit: 'pcs',
  priceQuantity: 2, breakdown: { material: 1234, labor: 0, equipment: 0 }, defaultWasteBp: 0, appliedAt: '2026-11-02T10:00:00.000Z', appliedBy: 'u1',
} as const;
const SUPPLIER: BoqSupplierPriceSource = { ...CORE, authority: 'supplier', supplierCompanyId: 'comp-aries', variantId: 'var_1', audience: null, discountSteps: [] };
const COST: BoqCostPriceSource = { ...CORE, authority: 'master', materialVariantId: 'var_own' };

const PUBLIC_KEYS = ['categoryCode', 'description', 'displayOrder', 'id', 'notes', 'quantity', 'trade', 'unit'];

const stored = (overrides: Partial<RfqLine> = {}): RfqLine => ({
  id: 'L1', rfqId: 'rfq1', companyId: 'co1', source: 'boq', boqItemId: 'boq1', description: 'Τσιμέντο', trade: 'concrete', categoryCode: 'OIK-1',
  quantity: 2, unit: 'pcs', unitPrice: 12, notes: null, displayOrder: 0, createdAt: null as never, updatedAt: null as never,
  ...rfqLineCatalogFields(SUPPLIER), ...overrides,
});

describe('rfqLineCatalogFields', () => {
  it('Α1 SKU προμηθευτή: δεσμός και στιγμιότυπο μαζί, από την ίδια πηγή', () => {
    expect(rfqLineCatalogFields(SUPPLIER)).toEqual({ catalogRef: { supplierCompanyId: 'comp-aries', variantId: 'var_1' }, priceSnapshot: SUPPLIER });
  });

  it('Α2 ο τιμοκατάλογος κόστους δεν είναι SKU προμηθευτή · καμία πηγή ⇒ τίποτα', () => {
    const none = { catalogRef: null, priceSnapshot: null };
    expect(rfqLineCatalogFields(COST)).toEqual(none);
    expect(rfqLineCatalogFields(null)).toEqual(none);
    expect(rfqLineCatalogFields(undefined)).toEqual(none);
  });
});

describe('🔒 προβολή προς προμηθευτή', () => {
  const withFuture = { ...stored(), futureInternalField: 'μυστικό' };

  it('Β1 toPublicRfqLine: μόνο η λίστα επιτρεπόμενων, και μελλοντικό πεδίο μένει κλειστό', () => {
    expect(Object.keys(toPublicRfqLine(withFuture)).sort()).toEqual(PUBLIC_KEYS);
  });

  it('Β2 toPublicLine: το ίδιο, ξεκινώντας από την εσωτερική πλευρά', () => {
    const internal = { ...resolveInternalRfqLines({ lines: [], linesStorage: 'boq' }, [stored()])[0], futureInternalField: 'μυστικό' };
    expect(internal.catalogRef).toEqual({ supplierCompanyId: 'comp-aries', variantId: 'var_1' });
    expect(Object.keys(toPublicLine(internal)).sort()).toEqual(PUBLIC_KEYS);
  });

  it('Β3 🔴 ο αναγνώστης των εξόδων: καμία συμβολοσειρά τιμής ή προμηθευτή στο σειριοποιημένο αποτέλεσμα', () => {
    const wire = JSON.stringify(resolvePublicRfqLines({ lines: [], linesStorage: 'boq' }, [stored()]));
    for (const secret of ['comp-aries', 'var_1', 'plv_1', 'catalogRef', 'priceSnapshot', '1234']) expect(wire).not.toContain(secret);
  });

  it('Β4 η εσωτερική πλευρά δεν κουβαλά το στιγμιότυπο: η τιμή μένει στη γραμμή', () => {
    expect(resolveInternalRfqLines({ lines: [], linesStorage: 'boq' }, [stored()])[0]).not.toHaveProperty('priceSnapshot');
  });
});

describe('χωρίς μετανάστευση', () => {
  it('Γ1 γραμμή παλιότερη από τα πεδία διαβάζεται ως «κανένα»', () => {
    const { catalogRef: _ref, priceSnapshot: _snapshot, ...legacy } = stored();
    expect(resolveInternalRfqLines({ lines: [], linesStorage: 'boq' }, [legacy])[0].catalogRef).toBeNull();
  });
});
