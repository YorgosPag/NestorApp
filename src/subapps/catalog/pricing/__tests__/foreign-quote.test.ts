/**
 * **Η ξένη απάντηση** (ADR-923 §5.12 Δ4 · Σ7): κάθε κελί της κρίσης, και η άγκυρα ότι τίποτα εσωτερικό δεν ταξιδεύει.
 */

import { foreignOutcomeOf, FOREIGN_UNAVAILABLE } from '../foreign-quote';
import type { PriceQuoteResult } from '../../types/price-list-requests';
import type { CatalogVisibility } from '../../vocabulary/pricing';

const verdict = (visibility: CatalogVisibility) => ({ visibility, ruleId: 'rule-1', tied: false, trace: [{ id: 'rule-1', verdict: 'selected' }] });

const CONTEXT = {
  viewer: { kind: 'signedIn', customerGroupId: 'secret-group', parties: [{ kind: 'contact', contactId: 'secret-contact' }] },
  at: '2026-11-01T00:00:00.000Z',
  listTrace: [{ id: 'secret-list', verdict: 'selected' }],
};

const priced = (visibility: CatalogVisibility | null) => ({
  kind: 'priced',
  priceListAudience: { kind: 'customerGroup', customerGroupId: 'g1' },
  cascade: [{ step: 5000, net: 5000 }],
  quote: {
    priceListId: 'list-1', priceListVersionId: 'version-1', lineId: 'line-1', subjectKey: 'variant:x', quantity: 2, netPrice: 10_000,
    priceQuantity: 1, unitCode: 'pcs', listAmount: 20_000, conditionId: 'secret-condition', discountSteps: [5000], discountAmount: 10_000,
    netAmount: 10_000, trace: [{ id: 'secret-condition', verdict: 'selected' }],
  },
  ...CONTEXT,
  visibility: visibility === null ? null : verdict(visibility),
}) as unknown as PriceQuoteResult;

const unpriced = (visibility: CatalogVisibility, kind: string) => ({ kind, ...CONTEXT, visibility: verdict(visibility) }) as unknown as PriceQuoteResult;

describe('η κρίση', () => {
  it('`hidden` ⇒ ίδια απάντηση με το ανύπαρκτο, ακόμη κι αν υπάρχει τιμή', () => {
    expect(foreignOutcomeOf(priced('hidden'))).toEqual(FOREIGN_UNAVAILABLE);
  });

  it('🔴 χωρίς ετυμηγορία ⇒ `unavailable`: η απουσία κρίσης δεν ανοίγει ποτέ', () => {
    expect(foreignOutcomeOf(priced(null))).toEqual(FOREIGN_UNAVAILABLE);
  });

  it('`visibleNoPrice` ⇒ `requestQuote`, χωρίς ποσό, ακόμη κι αν υπάρχει τιμή', () => {
    expect(foreignOutcomeOf(priced('visibleNoPrice'))).toEqual({ kind: 'requestQuote' });
  });

  it.each(['noPriceList', 'noLine', 'noVersion', 'ambiguousDiscount', 'ambiguousPriceList'])('`visible` χωρίς τιμή (%s) ⇒ `requestQuote`', (kind) => {
    expect(foreignOutcomeOf(unpriced('visible', kind))).toEqual({ kind: 'requestQuote' });
  });

  it('`visible` με τιμή ⇒ μόνο ό,τι χρειάζεται το στιγμιότυπο', () => {
    expect(foreignOutcomeOf(priced('visible'))).toEqual({
      kind: 'priced',
      price: {
        priceListId: 'list-1', priceListVersionId: 'version-1', lineId: 'line-1', subjectKey: 'variant:x', unitCode: 'pcs', quantity: 2,
        netAmount: 10_000, discountSteps: [5000], audience: { kind: 'customerGroup', customerGroupId: 'g1' },
      },
    });
  });
});

describe('🔒 τι δεν ταξιδεύει ποτέ', () => {
  const FORBIDDEN = ['quote', 'cascade', 'trace', 'listTrace', 'viewer', 'visibility', 'listAmount', 'conditionId', 'discountAmount', 'netPrice'];

  function keysOf(value: unknown): string[] {
    if (value === null || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)]);
  }

  it.each(['visible', 'visibleNoPrice', 'hidden'] as const)('`%s`: κανένα εσωτερικό κλειδί, ούτε μυστικό id', (visibility) => {
    const outcome = foreignOutcomeOf(priced(visibility));
    expect(keysOf(outcome).filter((key) => FORBIDDEN.includes(key))).toEqual([]);
    expect(JSON.stringify(outcome)).not.toContain('secret');
  });
});
