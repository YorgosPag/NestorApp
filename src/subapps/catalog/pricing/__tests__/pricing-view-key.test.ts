/**
 * Ποια όψη τιμών αγγίζει ποια γραφή (ADR-923 §5.11 «3δ» Ζ) — ο ένας χάρτης που ρωτά ο γραφέας των σημάτων.
 */

import { distinctPricingViews, pricingViewKey, pricingViewsOfWrite } from '../pricing-view-key';

const keysOf = (kind: string, record: Record<string, unknown>) => pricingViewsOfWrite(kind, record).map(pricingViewKey);

describe('pricingViewsOfWrite', () => {
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

  it.each(['attribute', 'family', 'product', 'productModel', 'asset', 'settings', 'category'])('%s ⇒ καμία όψη τιμών', (kind) => {
    expect(keysOf(kind, { id: 'x' })).toEqual([]);
  });
});

describe('distinctPricingViews', () => {
  it('μία όψη ανά κλειδί, όσες γραφές κι αν την άγγιξαν', () => {
    const views = [
      ...pricingViewsOfWrite('priceListLine', { derived: { priceListId: 'cprl_a' } }),
      ...pricingViewsOfWrite('priceListLine', { derived: { priceListId: 'cprl_a' } }),
      ...pricingViewsOfWrite('priceListVersion', { priceListId: 'cprl_a' }),
    ];
    expect(distinctPricingViews(views).map(pricingViewKey)).toEqual(['list:cprl_a', 'lists']);
  });
});
