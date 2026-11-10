/**
 * Ποια όψη καταλόγου αγγίζει ποια γραφή (ADR-923 §5.11 «3δ» Ζ · §5.5.2) — ο ένας χάρτης που ρωτά ο γραφέας των σημάτων.
 * 🔴 Και η μία απάντηση «άλλαξαν τιμές;» για τη βιτρίνα: όψη ≠ τιμή.
 */

import { showcasePricesTouched } from '../../public/showcase-price-writes';
import { catalogViewKey, catalogViewsOfWrite, distinctCatalogViews, isPricingView, type CatalogView } from '../catalog-view-key';

const keysOf = (kind: string, record: Record<string, unknown>) => catalogViewsOfWrite(kind, record).map(catalogViewKey);

describe('catalogViewsOfWrite', () => {
  it('λίστα ⇒ όλοι οι κατάλογοι + η δική της όψη', () => {
    expect(keysOf('priceList', { id: 'cprl_a' })).toEqual(['lists', 'list:cprl_a']);
  });

  it('έκδοση ⇒ όλοι οι κατάλογοι + η όψη της λίστας της', () => {
    expect(keysOf('priceListVersion', { id: 'cplv_1', priceListId: 'cprl_a' })).toEqual(['lists', 'list:cprl_a']);
  });

  it('γραμμή ⇒ ΜΟΝΟ η όψη της λίστας (από το `derived`), ποτέ όλοι οι κατάλογοι', () => {
    expect(keysOf('priceListLine', { id: 'cplln_1', derived: { priceListId: 'cprl_a' } })).toEqual(['list:cprl_a']);
  });

  it('γραμμή χωρίς `derived.priceListId` ⇒ καμία όψη (ποτέ σήμα σε `list:undefined`)', () => {
    expect(keysOf('priceListLine', { id: 'cplln_1' })).toEqual([]);
    expect(keysOf('priceListLine', { id: 'cplln_1', derived: { priceListId: '' } })).toEqual([]);
  });

  it.each(['discountGroup', 'customerGroup', 'customerAssignment', 'discountCondition'])('%s ⇒ όψη εκπτώσεων', (kind) => {
    expect(keysOf(kind, { id: 'x' })).toEqual(['discounts']);
  });

  it('παρτίδα εισαγωγής ⇒ η όψη της ΙΔΙΑΣ παρτίδας (§5.5.2)', () => {
    expect(keysOf('importBatch', { id: 'cibat_1' })).toEqual(['importBatch:cibat_1']);
  });

  it('πρόταση ⇒ η όψη της παρτίδας της (`batchId`), όχι η δική της', () => {
    expect(keysOf('importProposal', { id: 'cipr_1', batchId: 'cibat_1' })).toEqual(['importBatch:cibat_1']);
  });

  it('παρτίδα/πρόταση χωρίς ταυτότητα ⇒ καμία όψη (ποτέ σήμα σε `importBatch:undefined`)', () => {
    expect(keysOf('importBatch', {})).toEqual([]);
    expect(keysOf('importProposal', { id: 'cipr_1', batchId: '' })).toEqual([]);
  });

  it.each(['attribute', 'family', 'product', 'productModel', 'asset', 'settings', 'category', 'importProfile', 'importLabelMemory'])(
    '%s ⇒ καμία όψη', (kind) => {
      expect(keysOf(kind, { id: 'x', batchId: 'cibat_1' })).toEqual([]);
    });
});

describe('distinctCatalogViews', () => {
  it('μία όψη ανά κλειδί, όσες γραφές κι αν την άγγιξαν', () => {
    const views = [
      ...catalogViewsOfWrite('priceListLine', { derived: { priceListId: 'cprl_a' } }),
      ...catalogViewsOfWrite('priceListLine', { derived: { priceListId: 'cprl_a' } }),
      ...catalogViewsOfWrite('priceListVersion', { priceListId: 'cprl_a' }),
    ];
    expect(distinctCatalogViews(views).map(catalogViewKey)).toEqual(['list:cprl_a', 'lists']);
  });

  it('παρτίδα + δέκα προτάσεις της στην ίδια συναλλαγή ⇒ ΕΝΑ σήμα', () => {
    const views = [
      ...catalogViewsOfWrite('importBatch', { id: 'cibat_1' }),
      ...Array.from({ length: 10 }, (_, index) => catalogViewsOfWrite('importProposal', { id: `cipr_${index}`, batchId: 'cibat_1' })).flat(),
    ];
    expect(distinctCatalogViews(views).map(catalogViewKey)).toEqual(['importBatch:cibat_1']);
  });
});

describe('isPricingView + showcasePricesTouched — όψη ≠ τιμή', () => {
  const PRICES: readonly CatalogView[] = [{ kind: 'lists' }, { kind: 'list', priceListId: 'cprl_a' }, { kind: 'discounts' }];
  const NOT_PRICES: readonly CatalogView[] = [{ kind: 'supply' }, { kind: 'importBatch', batchId: 'cibat_1' }];

  it('μόνο τιμοκατάλογοι και εκπτώσεις είναι όψεις τιμών', () => {
    expect(PRICES.every(isPricingView)).toBe(true);
    expect(NOT_PRICES.some(isPricingView)).toBe(false);
  });

  it('🔴 κλικ εισαγωγής ή πρόσκληση προμήθειας ⇒ η βιτρίνα ΔΕΝ ακυρώνεται', () => {
    expect(showcasePricesTouched(NOT_PRICES, ['importProposal', 'importBatch'])).toBe(false);
  });

  it('όψη τιμών ή κατηγορία (ΦΠΑ) ⇒ η βιτρίνα ακυρώνεται', () => {
    for (const view of PRICES) expect(showcasePricesTouched([view, ...NOT_PRICES], [])).toBe(true);
    expect(showcasePricesTouched(NOT_PRICES, ['category'])).toBe(true);
  });
});
