/**
 * Ο έλεγχος τιμών προμηθευτή σε ένα κτίριο (ADR-923 §5.12 Δ9) και η πύλη του επιλογέα.
 */

import type { ForeignPrice } from '@/subapps/catalog/pricing/foreign-quote';
import type { SupplierDrift } from '@/subapps/catalog/pricing/supplier-drift';
import type { BoqSupplierDriftRow } from '@/subapps/catalog/types/supply-boq';
import { BOQ_ITEM_DEFAULTS, type BOQItem, type BoqSupplierPriceSource } from '@/types/boq';
import { supplierLineQuantity, unitCostsOf } from '../boq-price-source';
import {
  applicableSupplierRows,
  foreignUnitPrice,
  hasFencedSupplierRow,
  supplierPickerGate,
  supplierReviewIds,
  supplierReviewKey,
  supplierReviewRows,
} from '../boq-supplier-review';

const SOURCE: BoqSupplierPriceSource = {
  authority: 'supplier', supplierCompanyId: 'comp_s', variantId: 'cprod_1', audience: null, discountSteps: [], priceListId: 'l', priceListVersionId: 'v', versionNumber: 1,
  lineId: 'x', subjectKey: 's', unit: 'pcs', priceQuantity: 10, breakdown: { material: 10000, labor: 0, equipment: 0 }, defaultWasteBp: 0, appliedAt: 'T1', appliedBy: 'u',
};

const line = (id: string, overrides: Partial<BOQItem> = {}): BOQItem => ({
  ...BOQ_ITEM_DEFAULTS, id, status: 'draft', unit: 'pcs', title: id, estimatedQuantity: 10, wasteFactor: 0.1, wastePolicy: 'inherited',
  priceSource: SOURCE, materialUnitCost: 10, laborUnitCost: 0, equipmentUnitCost: 0, ...overrides,
} as BOQItem);

const PRICE: ForeignPrice = { priceListId: 'l', priceListVersionId: 'v2', lineId: 'y', subjectKey: 's', unitCode: 'pcs', quantity: 10, netAmount: 11000, discountSteps: [], audience: null };
const changed = (exceedsFence: boolean): SupplierDrift => ({ kind: 'changed', price: PRICE, changeBp: 1000, exceedsFence });
const driftRow = (boqItemId: string, drift: SupplierDrift): BoqSupplierDriftRow => ({ boqItemId, relationshipId: 'srel', variantId: 'cprod_1', drift });

describe('supplierReviewRows', () => {
  it('`current` δεν είναι γραμμή ελέγχου', () => {
    expect(supplierReviewRows([line('a')], [driftRow('a', { kind: 'current' })])).toEqual([]);
  });

  it('🔴 η επίπτωση μετρά στη μικτή ποσότητα, όπως το cost-engine', () => {
    const [row] = supplierReviewRows([line('a')], [driftRow('a', changed(false))]);
    expect(row.impact).toBeCloseTo(11, 6);
  });

  it('χωρίς νέα τιμή ⇒ καμία επίπτωση και καμία εφαρμογή', () => {
    const [row] = supplierReviewRows([line('a')], [driftRow('a', { kind: 'unavailable' })]);
    expect(row).toMatchObject({ impact: null, applicable: false });
  });

  it('🔴 γραμμή που δόθηκε φαίνεται, δεν εφαρμόζεται', () => {
    const [row] = supplierReviewRows([line('a', { status: 'submitted' })], [driftRow('a', changed(false))]);
    expect(row.applicable).toBe(false);
  });

  it('🔴 γραμμή του κόστους δεν μπαίνει ποτέ, ούτε αν έρθει απάντηση', () => {
    const cost = line('a', { priceSource: { ...SOURCE, authority: 'master' } as BOQItem['priceSource'] });
    expect(supplierReviewRows([cost], [driftRow('a', changed(false))])).toEqual([]);
    expect(supplierReviewIds([cost])).toEqual([]);
  });
});

describe('ο φράχτης', () => {
  const rows = supplierReviewRows([line('a'), line('b')], [driftRow('a', changed(false)), driftRow('b', changed(true))]);

  it('🔴 χωρίς επιβεβαίωση περνά μόνο ό,τι είναι μέσα', () => {
    expect(applicableSupplierRows(rows, false).map((row) => row.item.id)).toEqual(['a']);
    expect(applicableSupplierRows(rows, true).map((row) => row.item.id)).toEqual(['a', 'b']);
  });

  it('ζητά επιβεβαίωση μόνο όταν κάτι την θέλει και μπορεί να εφαρμοστεί', () => {
    expect(hasFencedSupplierRow(rows)).toBe(true);
    expect(hasFencedSupplierRow(rows.slice(0, 1))).toBe(false);
    expect(hasFencedSupplierRow(supplierReviewRows([line('b', { status: 'approved' })], [driftRow('b', changed(true))]))).toBe(false);
  });
});

describe('το κλειδί του ελέγχου', () => {
  it('🔴 ξαναρωτά μόνο όταν εφαρμοστεί νέα τιμή, όχι σε κάθε ανανέωση της λίστας', () => {
    expect(supplierReviewKey([line('a', { title: 'άλλο' })])).toBe(supplierReviewKey([line('a')]));
    expect(supplierReviewKey([line('a', { priceSource: { ...SOURCE, appliedAt: 'T2' } })])).not.toBe(supplierReviewKey([line('a')]));
  });

  it('χωρίς γραμμές προμηθευτή ⇒ κενό: καμία κλήση', () => {
    expect(supplierReviewKey([line('a', { priceSource: null })])).toBe('');
  });
});

describe('η πύλη του επιλογέα', () => {
  const form = { unit: 'pcs', estimatedQuantity: '10' };

  it('🔴 νέα γραμμή · αλλαγμένη ποσότητα · αλλαγμένη μονάδα ⇒ πρώτα αποθήκευση', () => {
    expect(supplierPickerGate(null, form)).toBe('unsaved');
    expect(supplierPickerGate(line('a'), { ...form, estimatedQuantity: '11' })).toBe('unsaved');
    expect(supplierPickerGate(line('a'), { ...form, unit: 'm2' })).toBe('unsaved');
  });

  it('γραμμή που δόθηκε ⇒ κλειστή', () => {
    expect(supplierPickerGate(line('a', { status: 'approved' }), form)).toBe('locked');
  });

  it('ίδια με την αποθηκευμένη ⇒ ανοιχτή', () => {
    expect(supplierPickerGate(line('a'), form)).toBe('ready');
  });
});

describe('ποσά', () => {
  it('🔴 η ποσότητα της κλίμακας: στα δεκαδικά του επιλυτή, ποτέ μηδενική', () => {
    expect(supplierLineQuantity({ estimatedQuantity: 12.34567 })).toBe(12.346);
    expect(supplierLineQuantity({ estimatedQuantity: 0 })).toBe(1);
    expect(supplierLineQuantity({ estimatedQuantity: 0.0001 })).toBe(1);
  });

  it('ανά μονάδα, ίδιο ποσό με το στιγμιότυπο', () => {
    expect(foreignUnitPrice({ ...PRICE, netAmount: 10000 })).toBe(unitCostsOf(SOURCE).materialUnitCost);
  });
});
