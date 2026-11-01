/**
 * Ξένη τιμή στον έλεγχο τιμών (ADR-923 §5.12 Δ9): δεν ζει στο βιβλίο κόστους, άρα δεν πρέπει να εμφανίζεται ως «η λίστα χάθηκε».
 */

import type { CostRateBook } from '@/subapps/catalog/types/cost-rate';
import type { BOQItem } from '@/types/boq';

import { reviewBoqPrices } from '../boq-price-review';

const BOOK = { priceListIds: [], current: [], upcoming: [] } as unknown as CostRateBook;

const line = (authority: string) => ({
  id: 'boq_1', status: 'draft', wastePolicy: 'inherited', wasteFactor: 0, estimatedQuantity: 1, materialUnitCost: 10, laborUnitCost: 0, equipmentUnitCost: 0,
  priceSource: { authority, priceListId: 'foreign-list', subjectKey: 'variant:x', unit: 'pcs', priceQuantity: 1, breakdown: { material: 1000, labor: 0, equipment: 0 } },
}) as unknown as BOQItem;

it('🔴 γραμμή με τιμή προμηθευτή δεν βγαίνει στον έλεγχο', () => {
  expect(reviewBoqPrices([line('supplier')], BOOK)).toEqual([]);
});

it('γραμμή τιμοκαταλόγου που χάθηκε βγαίνει κανονικά', () => {
  expect(reviewBoqPrices([line('master')], BOOK)).toEqual([expect.objectContaining({ kind: 'listGone' })]);
});
