/**
 * Επίλυση τιμής καταλόγου (ADR-923 §5.11) — τα σενάρια αποδοχής της Φάσης 3 σε jest:
 * δύο εκδόσεις «ως προς» ημερομηνία · «TOSH-CARR −50%» · «50+10» · απλό χωρίς ομάδα · ασάφεια.
 *
 * @module subapps/catalog/pricing/__tests__/resolve-catalog-price
 */

import {
  MFP_CONDITIONS,
  MFP_PRICE_LIST,
  MFP_V1_PRICES,
  PARTNER,
  SIGNED_IN_ALL,
  SIMPLE_V1_PRICE,
  SIMPLE_VARIANT_ID,
  VERSION_1,
  VERSION_2,
  WHOLESALE,
  WHOLESALE_TOSH_CARR,
  fixtureLineFor,
} from '../../__tests__/fixtures/mfp-price-list.fixture';
import { mfpVariantId } from '../../__tests__/fixtures/mfp-fan-coil-products.fixture';
import type { DiscountConditionDefinition, PricingViewer } from '../../types/price-list';
import { resolveCatalogPrice, type CatalogPriceRequest, type PricedRecord } from '../resolve-catalog-price';

const MARCH = Date.parse('2026-03-01T00:00:00Z');
const AUGUST = Date.parse('2026-08-01T00:00:00Z');

const anonymous: PricingViewer = { kind: 'anonymous' };
const signedIn: PricingViewer = { kind: 'signedIn', customerGroupId: null, party: null };
const wholesaler: PricingViewer = { kind: 'signedIn', customerGroupId: WHOLESALE, party: null };
const partner: PricingViewer = { kind: 'signedIn', customerGroupId: WHOLESALE, party: PARTNER };

function request(overrides: Partial<CatalogPriceRequest> = {}): CatalogPriceRequest {
  return {
    priceList: MFP_PRICE_LIST,
    versions: [VERSION_1, VERSION_2],
    lineFor: fixtureLineFor,
    conditions: MFP_CONDITIONS,
    viewer: anonymous,
    subject: { kind: 'variant', variantId: mfpVariantId(0) },
    quantity: 1,
    atMs: MARCH,
    ...overrides,
  };
}

function quoteOf(overrides: Partial<CatalogPriceRequest>) {
  const result = resolveCatalogPrice(request(overrides));
  if (result.kind !== 'priced') throw new Error(`expected priced, got ${result.kind}`);
  return result.quote;
}

describe('έκδοση «ως προς» ημερομηνία', () => {
  it('Μάρτιος ⇒ έκδοση 1 · Αύγουστος ⇒ έκδοση 2 (+8%) — η παλιά προσφορά βρίσκει την παλιά τιμή', () => {
    expect(quoteOf({ atMs: MARCH })).toMatchObject({ priceListVersionId: VERSION_1.id, listAmount: MFP_V1_PRICES[0] });
    expect(quoteOf({ atMs: AUGUST })).toMatchObject({ priceListVersionId: VERSION_2.id, listAmount: 56160 });
  });

  it('πριν από την πρώτη δημοσίευση ⇒ noVersion· πρόχειρη έκδοση δεν ισχύει ποτέ', () => {
    expect(resolveCatalogPrice(request({ atMs: Date.parse('2025-12-31T23:59:59Z') })).kind).toBe('noVersion');
    const draft = { ...VERSION_2, status: 'draft' as const };
    expect(quoteOf({ versions: [VERSION_1, draft], atMs: AUGUST }).priceListVersionId).toBe(VERSION_1.id);
  });

  it('είδος χωρίς γραμμή ⇒ noLine με την έκδοση', () => {
    expect(resolveCatalogPrice(request({ subject: { kind: 'variant', variantId: 'cpr_unknown' } }))).toEqual({
      kind: 'noLine',
      priceListVersionId: VERSION_1.id,
    });
  });
});

describe('έκπτωση ανά κοινό — ο ειδικότερος νικά', () => {
  it('ανώνυμος: καμία έκπτωση', () => {
    expect(quoteOf({ viewer: anonymous })).toMatchObject({ conditionId: null, discountAmount: 0, netAmount: 52000 });
  });

  it('συνδεδεμένος: −5% σε όλα', () => {
    expect(quoteOf({ viewer: signedIn })).toMatchObject({ conditionId: SIGNED_IN_ALL.id, netAmount: 49400 });
  });

  it('χονδρέμπορος: «TOSH-CARR −50%» νικά το −5% των συνδεδεμένων', () => {
    const quote = quoteOf({ viewer: wholesaler });
    expect(quote).toMatchObject({ conditionId: WHOLESALE_TOSH_CARR.id, discountSteps: [5000], netAmount: 26000 });
    expect(quote.trace).toEqual([
      { id: 'cdcnd_wholesale_tc', verdict: 'selected' },
      { id: 'cdcnd_partner_tc', verdict: 'audienceMismatch' },
      { id: 'cdcnd_signed_all', verdict: 'outranked' },
    ]);
  });

  it('συνεργάτης: «50+10» = 45% του λίστας, όχι 40%', () => {
    expect(quoteOf({ viewer: partner })).toMatchObject({ discountSteps: [5000, 1000], discountAmount: 28600, netAmount: 23400 });
  });

  it('το απλό χωρίς ομάδα έκπτωσης: ο χονδρέμπορος παίρνει μόνο το «σε όλα»', () => {
    const quote = quoteOf({ viewer: wholesaler, subject: { kind: 'variant', variantId: SIMPLE_VARIANT_ID } });
    expect(quote.listAmount).toBe(SIMPLE_V1_PRICE);
    expect(quote.conditionId).toBe(SIGNED_IN_ALL.id);
    expect(quote.trace.find((entry) => entry.id === WHOLESALE_TOSH_CARR.id)?.verdict).toBe('groupMismatch');
  });

  it('τιμοκατάλογος net_customer: η τιμή είναι ήδη τελική, καμία συνθήκη', () => {
    const list = { ...MFP_PRICE_LIST, definition: { ...MFP_PRICE_LIST.definition, priceType: 'net_customer' as const } };
    expect(quoteOf({ priceList: list, viewer: partner })).toMatchObject({ conditionId: null, netAmount: 52000, trace: [] });
  });
});

describe('ισχύς συνθήκης, κλίμακες, ασάφεια', () => {
  const promo = (id: string, definition: Partial<DiscountConditionDefinition>): PricedRecord<DiscountConditionDefinition> => ({
    id,
    definition: { ...WHOLESALE_TOSH_CARR.definition, ...definition },
  });

  it('συνθήκη που έληξε δεν ισχύει — και το ίχνος το λέει', () => {
    const expired = promo('cdcnd_old', { validUntil: '2026-02-01T00:00:00.000Z' });
    const quote = quoteOf({ viewer: wholesaler, conditions: [expired, SIGNED_IN_ALL] });
    expect(quote.conditionId).toBe(SIGNED_IN_ALL.id);
    expect(quote.trace[0]).toEqual({ id: 'cdcnd_old', verdict: 'expired' });
  });

  it('κλίμακα ποσότητας: από 10 τεμάχια «50+10», κάτω από 10 «50»', () => {
    const tiered = promo('cdcnd_tiers', {
      rule: { kind: 'tiers', basis: 'quantity', tiers: [{ min: 0, steps: [5000] }, { min: 10, steps: [5000, 1000] }] },
    });
    expect(quoteOf({ viewer: wholesaler, conditions: [tiered], quantity: 9 }).discountSteps).toEqual([5000]);
    expect(quoteOf({ viewer: wholesaler, conditions: [tiered], quantity: 10 }).discountSteps).toEqual([5000, 1000]);
  });

  it('ίδιο κοινό: η συνθήκη της ομάδας νικά τη συνθήκη «σε όλα»', () => {
    const wholesaleAll = promo('cdcnd_wholesale_all', { discountGroupId: null, rule: { kind: 'chain', steps: [1000] } });
    expect(quoteOf({ viewer: wholesaler, conditions: [wholesaleAll, WHOLESALE_TOSH_CARR] }).conditionId).toBe(WHOLESALE_TOSH_CARR.id);
    const simple = { kind: 'variant' as const, variantId: SIMPLE_VARIANT_ID };
    expect(quoteOf({ viewer: wholesaler, subject: simple, conditions: [wholesaleAll, WHOLESALE_TOSH_CARR] }).conditionId).toBe(
      'cdcnd_wholesale_all',
    );
  });

  it('δύο εξίσου ειδικές έγκυρες συνθήκες ⇒ ambiguousDiscount, όχι «η πρώτη»', () => {
    const twin = promo('cdcnd_twin', { rule: { kind: 'chain', steps: [4000] } });
    const result = resolveCatalogPrice(request({ viewer: wholesaler, conditions: [WHOLESALE_TOSH_CARR, twin] }));
    expect(result).toMatchObject({ kind: 'ambiguousDiscount', tiedConditionIds: [WHOLESALE_TOSH_CARR.id, 'cdcnd_twin'] });
  });

  it('άκυρη ποσότητα ⇒ invalidQuantity', () => {
    expect(resolveCatalogPrice(request({ quantity: 0 })).kind).toBe('invalidQuantity');
  });
});
