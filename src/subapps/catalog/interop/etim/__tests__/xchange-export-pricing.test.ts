/**
 * Η τιμή και η ορατότητα ενός SKU στο xChange, και η συναρμολόγηση των SKU (ADR-923 §5.14 · αποφάσεις Ε1 + Ε2 · Ζ5 · Ζ9).
 * Καθαρά: η ετυμηγορία της μηχανής χτίζεται εδώ με το χέρι· τη διαδρομή από άκρη σε άκρη την ελέγχει το test του διακομιστή.
 */

import type { StoredFamily, StoredModel, StoredProduct } from '../../../publishing/publication-chapters';
import type { PriceQuoteResult } from '../../../types/price-list-requests';
import { ANY_SLOT, type AttributeValue, type ValueSlots } from '../../../types/product';
import type { CatalogVisibility, PriceType } from '../../../vocabulary/pricing';
import { assembleXChangeProducts } from '../xchange-export-assembly';
import { xchangeSkuPricing, xchangeUnitOf, type XChangeSkuPricing } from '../xchange-pricing';

const CONTEXT = { viewer: { kind: 'anonymous' as const }, at: '2026-11-03T00:00:00.000Z', listTrace: [] };
const verdict = (visibility: CatalogVisibility) => ({ visibility, ruleId: null, tied: false, trace: [] });

function priced(overrides: { listAmount?: number; netAmount?: number; unitCode?: string; priceQuantity?: number } = {}, visibility: CatalogVisibility = 'visible'): PriceQuoteResult {
  const { listAmount = 12050, netAmount = listAmount, unitCode = 'pcs', priceQuantity = 1 } = overrides;
  return {
    kind: 'priced',
    priceListAudience: { kind: 'anonymous' },
    cascade: [],
    quote: {
      priceListId: 'list', priceListVersionId: 'v1', lineId: 'line', subjectKey: 'variant:sku', quantity: priceQuantity, netPrice: listAmount,
      priceQuantity, unitCode, listAmount, conditionId: null, discountSteps: [], discountAmount: listAmount - netAmount, netAmount, trace: [],
    },
    ...CONTEXT,
    visibility: verdict(visibility),
  };
}

const typeOf = (priceType: PriceType) => () => priceType;
const NET_LIST = typeOf('net_list');

describe('η κρίση ενός SKU', () => {
  it('κρυφό για το κοινό ⇒ εκτός αρχείου, ακόμη κι αν έχει τιμή', () => {
    expect(xchangeSkuPricing(priced({}, 'hidden'), NET_LIST)).toEqual({ kind: 'hidden' });
  });
  it('χωρίς ετυμηγορία ορατότητας ⇒ η προεπιλογή της πλατφόρμας (κρυφό), ποτέ «ορατό»', () => {
    expect(xchangeSkuPricing({ ...priced(), visibility: null }, NET_LIST)).toEqual({ kind: 'hidden' });
  });
  it('ορατό χωρίς τιμή ⇒ ζητήστε προσφορά, με αιτία', () => {
    expect(xchangeSkuPricing(priced({}, 'visibleNoPrice'), NET_LIST)).toEqual({ kind: 'onRequest', reason: 'visibleNoPrice' });
  });
  it('οι αιτίες της μηχανής περνούν αυτούσιες', () => {
    const noLine: PriceQuoteResult = { kind: 'noLine', priceListId: 'list', priceListVersionId: 'v1', ...CONTEXT, visibility: verdict('visible') };
    const noList: PriceQuoteResult = { kind: 'noPriceList', ...CONTEXT, visibility: verdict('visible') };
    expect(xchangeSkuPricing(noLine, NET_LIST)).toEqual({ kind: 'onRequest', reason: 'noLine' });
    expect(xchangeSkuPricing(noList, NET_LIST)).toEqual({ kind: 'onRequest', reason: 'noPriceList' });
  });
  it('τιμή λίστας χωρίς έκπτωση ⇒ μόνο GrossListPrice, στη μονάδα της γραμμής', () => {
    expect(xchangeSkuPricing(priced({ unitCode: 'm', priceQuantity: 100 }), NET_LIST)).toEqual({
      kind: 'priced', price: { unit: 'MTR', quantity: 100, grossList: '120.50', net: null },
    });
  });
  it('τιμή λίστας με έκπτωση του κοινού ⇒ GrossListPrice ΚΑΙ NetPrice', () => {
    expect(xchangeSkuPricing(priced({ listAmount: 10000, netAmount: 9500 }), NET_LIST)).toEqual({
      kind: 'priced', price: { unit: 'C62', quantity: 1, grossList: '100.00', net: '95.00' },
    });
  });
  it('λίστα πελάτη (net_customer) ⇒ μόνο NetPrice', () => {
    expect(xchangeSkuPricing(priced(), typeOf('net_customer'))).toEqual({
      kind: 'priced', price: { unit: 'C62', quantity: 1, grossList: null, net: '120.50' },
    });
  });
  it('μονάδα χωρίς κωδικό του σχήματος ⇒ ζητήστε προσφορά, ποτέ «τεμάχιο»', () => {
    expect(xchangeSkuPricing(priced({ unitCode: 'point' }), NET_LIST)).toEqual({ kind: 'onRequest', reason: 'unitUnmapped' });
    expect(xchangeSkuPricing(priced({ unitCode: 'month' }), NET_LIST)).toEqual({ kind: 'onRequest', reason: 'unitUnmapped' });
  });
});

describe('οι μονάδες', () => {
  it('ίδιος κωδικός, ισοδύναμος κωδικός, συσκευασία χωρίς Χ, καμία αντιστοίχιση', () => {
    expect(xchangeUnitOf('kg')).toBe('KGM');
    expect(xchangeUnitOf('pcs')).toBe('C62');
    expect(xchangeUnitOf('bag')).toBe('BG');
    expect(xchangeUnitOf('pallet')).toBeNull();
    expect(xchangeUnitOf('άγνωστο')).toBeNull();
  });
});

const slots = (value: AttributeValue): ValueSlots => ({ [ANY_SLOT]: { [ANY_SLOT]: value } });
const SCHEME = { code: 'size', labels: {}, levels: [{ axisAttributeIds: ['power'], attributeIds: [] }] };
const FAMILY = { id: 'fan', variantSchemes: [SCHEME] } as unknown as StoredFamily;
const MODEL = { id: 'mfp', parentId: null, variantSchemeCode: 'size', categoryIds: [], values: { color: slots({ type: 'select', optionCode: 'white' }) }, noValueReasons: {}, revision: 1 } as unknown as StoredModel;

function product(id: string, identifier: string | null, sortKey: string): StoredProduct {
  return {
    id, familyId: 'fan', modelId: 'mfp', categoryIds: [], revision: 1,
    values: { power: slots({ type: 'measurement', amount: '1800', unitCode: 'W' }) },
    noValueReasons: {},
    derived: { identifier, label: null, completeChannels: [], sortKey },
  } as unknown as StoredProduct;
}

describe('η συναρμολόγηση', () => {
  const judge = (byId: Record<string, XChangeSkuPricing>) => (sku: StoredProduct) => byId[sku.id];
  const PRICE = { unit: 'C62' as const, quantity: 1, grossList: '1.00', net: null };
  const input = (products: readonly StoredProduct[], byId: Record<string, XChangeSkuPricing>) =>
    assembleXChangeProducts({ families: new Map([['fan', FAMILY]]), models: new Map([['mfp', MODEL]]), products, pricingOf: judge(byId) });

  it('η κληρονομιά λύνεται ανά SKU: το χρώμα του μοντέλου και η ισχύς του SKU', () => {
    const { sources } = input([product('a', 'MFP-15', 'a')], { a: { kind: 'priced', price: PRICE } });
    expect([...sources[0].values.keys()].sort()).toEqual(['color', 'power']);
    expect(sources[0]).toMatchObject({ identifier: 'MFP-15', label: 'MFP-15', price: PRICE });
  });
  it('κρυφό ⇒ μετριέται, όχι γραμμένο · χωρίς κωδικό ή με κωδικό πάνω από 35 ⇒ μετριέται χωριστά · τιμή κατά αιτία', () => {
    const result = input(
      [product('h', 'H', 'h'), product('n', null, 'n'), product('l', 'X'.repeat(36), 'l'), product('r', 'R', 'r'), product('q', 'Q', 'q')],
      { h: { kind: 'hidden' }, n: { kind: 'priced', price: PRICE }, l: { kind: 'priced', price: PRICE }, r: { kind: 'onRequest', reason: 'noLine' }, q: { kind: 'onRequest', reason: 'noLine' } },
    );
    expect(result).toMatchObject({ hidden: 1, unfitIdentifier: 2, onRequest: { noLine: 2 } });
    expect(result.sources.map((source) => [source.identifier, source.price])).toEqual([['Q', null], ['R', null]]);
  });
  it('ο κωδικός των 35 χαρακτήρων γράφεται', () => {
    expect(input([product('a', 'X'.repeat(35), 'a')], { a: { kind: 'priced', price: PRICE } }).sources).toHaveLength(1);
  });
});
