/**
 * Ο δεσμός τιμής μιας γραμμής BOQ και ο έλεγχος τιμών — ADR-923 §5.11 «3ε».
 */

import type { CostRate, CostRateBook } from '@/subapps/catalog/types/cost-rate';
import type { BOQItem, BoqPriceSource } from '@/types/boq';
import { applicableReviewRows, reviewBoqPrices, reviewImpact } from '../boq-price-review';
import {
  boqLineAtoeCode,
  canApplyPrice,
  costRatesForLine,
  detachedPriceFields,
  isSamePriceSource,
  priceFieldsFromRate,
  priceSourceOf,
} from '../boq-price-source';

const RATE: CostRate = {
  priceListId: 'cprl_master',
  priceListCode: 'master',
  priceListLabels: { el: 'Master' },
  projectId: null,
  versionId: 'cplv_1',
  versionNumber: 1,
  validFrom: '2026-01-01T00:00:00.000Z',
  lineId: 'line_a',
  subjectKey: 'costItem:OIK-4.01:*',
  atoeCode: 'OIK-4.01',
  region: null,
  unitCode: 'm2',
  priceQuantity: 10,
  netPrice: 12000,
  breakdown: { description: null, material: 8000, labor: 3000, equipment: 1000, defaultWasteBp: 500, materialVariantId: null },
  fenceBp: 2000,
};

const APPLICATION = { appliedAt: '2026-10-31T10:00:00.000Z', appliedBy: 'user_1' };

const item = (overrides: Partial<BOQItem> = {}): BOQItem => ({
  id: 'boq_1',
  projectId: 'proj_1',
  status: 'draft',
  categoryCode: 'OIK-4.01',
  subCategoryCode: null,
  unit: 'm2',
  estimatedQuantity: 100,
  wasteFactor: 0,
  wastePolicy: 'inherited',
  materialUnitCost: 0,
  laborUnitCost: 0,
  equipmentUnitCost: 0,
  priceAuthority: 'item',
  priceSource: null,
  ...overrides,
} as BOQItem);

const book = (current: readonly CostRate[]): CostRateBook => ({
  freshness: { revision: 1, freshUntil: null },
  asOf: '2026-06-01T00:00:00.000Z',
  priceListIds: ['cprl_master'],
  current,
  upcoming: [],
});

const linked = (): BoqPriceSource => priceSourceOf(RATE, 'm2', APPLICATION);

describe('priceFieldsFromRate — τιμές, δεσμός, προέλευση σε ένα σύνολο', () => {
  it('η τιμή «ανά 10» διαιρείται: 80 € ανά 10 = 8 € ανά μονάδα', () => {
    expect(priceFieldsFromRate(item(), RATE, APPLICATION)).toMatchObject({ materialUnitCost: 8, laborUnitCost: 3, equipmentUnitCost: 1, priceAuthority: 'master' });
  });

  it('η λίστα έργου δίνει προέλευση project', () => {
    expect(priceFieldsFromRate(item(), { ...RATE, projectId: 'proj_1' }, APPLICATION).priceAuthority).toBe('project');
  });

  it('η φύρα ακολουθεί μόνο όσο κληρονομείται', () => {
    expect(priceFieldsFromRate(item(), RATE, APPLICATION).wasteFactor).toBe(0.05);
    expect(priceFieldsFromRate(item({ wastePolicy: 'overridden', wasteFactor: 0.2 }), RATE, APPLICATION)).not.toHaveProperty('wasteFactor');
  });
});

describe('detachedPriceFields — ο δεσμός δεν λέει ψέματα', () => {
  const bound = item({ priceSource: linked(), materialUnitCost: 8, priceAuthority: 'master' });

  it('πληκτρολογημένη άλλη τιμή ⇒ αποσύνδεση', () => {
    expect(detachedPriceFields(bound, { materialUnitCost: 9 })).toEqual({ priceSource: null, priceAuthority: 'item' });
  });

  it('ίδια τιμή (η φόρμα τις στέλνει πάντα) ⇒ τίποτα', () => {
    expect(detachedPriceFields(bound, { materialUnitCost: 8, title: 'x' })).toEqual({});
  });

  it('ενημέρωση που φέρει δικό της δεσμό ⇒ τίποτα · αδέτη γραμμή ⇒ τίποτα', () => {
    expect(detachedPriceFields(bound, { materialUnitCost: 9, priceSource: linked() })).toEqual({});
    expect(detachedPriceFields(item(), { materialUnitCost: 9 })).toEqual({});
  });
});

describe('canApplyPrice · isSamePriceSource', () => {
  it('μόνο πρόχειρη γραμμή, ποτέ σύνοψη', () => {
    expect(canApplyPrice(item())).toBe(true);
    expect(canApplyPrice(item({ status: 'submitted' }))).toBe(false);
    expect(canApplyPrice(item({ isGroupParent: true, groupRole: 'summary' }))).toBe(false);
  });

  it('ίδια γραμμή + έκδοση = ίδιος δεσμός, ανεξάρτητα από το πότε εφαρμόστηκε', () => {
    expect(isSamePriceSource(linked(), { ...linked(), appliedAt: 'later' })).toBe(true);
    expect(isSamePriceSource(linked(), { ...linked(), priceListVersionId: 'cplv_2' })).toBe(false);
    expect(isSamePriceSource(null, undefined)).toBe(true);
    expect(isSamePriceSource(linked(), null)).toBe(false);
  });
});

describe('αντιστοίχιση γραμμής', () => {
  it('το άρθρο προηγείται της κατηγορίας', () => {
    expect(boqLineAtoeCode(item({ categoryCode: 'OIK-4', subCategoryCode: 'OIK-4.01' }))).toBe('OIK-4.01');
    expect(boqLineAtoeCode(item())).toBe('OIK-4.01');
  });

  it('επιλογές: ίδια ομάδα και ίδια μονάδα', () => {
    const rates = [RATE, { ...RATE, lineId: 'b', atoeCode: 'OIK-5.01' }, { ...RATE, lineId: 'c', unitCode: 'm3' }];
    expect(costRatesForLine(rates, { categoryCode: 'OIK-4', unit: 'm2' }).map((rate) => rate.lineId)).toEqual(['line_a']);
  });
});

describe('reviewBoqPrices', () => {
  it('αδέτη γραμμή BIM χωρίς τιμή ⇒ πρόταση με επίπτωση 100 × 12 €', () => {
    const [row] = reviewBoqPrices([item()], book([RATE]));
    expect(row).toMatchObject({ kind: 'proposal', applicable: true, impact: 1200 });
  });

  it('τιμή που έγραψε ο άνθρωπος δεν αντικαθίσταται με πρόταση', () => {
    expect(reviewBoqPrices([item({ laborUnitCost: 5 })], book([RATE]))).toEqual([]);
  });

  it('γραμμή που δόθηκε: η απόκλιση φαίνεται, δεν εφαρμόζεται', () => {
    const newer: CostRate = { ...RATE, versionId: 'cplv_2', netPrice: 13000, breakdown: { ...RATE.breakdown, material: 9000 } };
    const given = item({ status: 'submitted', priceSource: linked(), materialUnitCost: 8, laborUnitCost: 3, equipmentUnitCost: 1 });
    const rows = reviewBoqPrices([given], book([newer]));
    expect(rows[0]).toMatchObject({ kind: 'changed', applicable: false });
    expect(applicableReviewRows(rows, true)).toEqual([]);
  });

  it('πάνω από τον φράχτη: μόνο με ρητή επιβεβαίωση', () => {
    const newer: CostRate = { ...RATE, versionId: 'cplv_2', netPrice: 24000, breakdown: { ...RATE.breakdown, material: 20000 } };
    const rows = reviewBoqPrices([item({ priceSource: linked(), materialUnitCost: 8, laborUnitCost: 3, equipmentUnitCost: 1 })], book([newer]));
    expect(rows[0]).toMatchObject({ kind: 'changed', exceedsFence: true });
    expect(applicableReviewRows(rows, false)).toEqual([]);
    expect(reviewImpact(applicableReviewRows(rows, true))).toBe(1200);
  });

  it('σύνοψη με στρώσεις δεν ελέγχεται ποτέ', () => {
    const summary = item({ id: 'parent', isGroupParent: true, groupRole: 'summary' });
    const layer = item({ id: 'child', parentBoqItemId: 'parent', categoryCode: 'OIK-5.01' });
    expect(reviewBoqPrices([summary, layer], book([RATE]))).toEqual([]);
  });
});
