/**
 * Άγκυρες της τιμής της βιτρίνας (ADR-923 §5.13 Σ6): κλειστό σχήμα, ορατότητα πρώτα, ανώνυμος μόνο με ΦΠΑ, τιμή μονάδας,
 * κληρονομιά συντελεστή, «από» μόνο σε συγκρίσιμα SKU.
 */

import { vatInclusiveAmount } from '@/lib/pricing/vat-inclusive';
import type { GreekVatRatePercent } from '@/subapps/accounting/services/config/vat-rates';
import type { PriceQuoteResult } from '../../types/price-list-requests';
import type { CatalogVisibility } from '../../vocabulary/pricing';
import { consumerPricesOf, perUnitAmount, showcaseFromPrice, showcasePriceOf, showcaseVatRateOf, type ShowcasePrice } from '../showcase-price';

function priced(netAmount: number, visibility: CatalogVisibility | null, extra: { priceQuantity?: number; unitCode?: string } = {}): PriceQuoteResult {
  return {
    kind: 'priced',
    viewer: { kind: 'anonymous' },
    at: '2026-11-04T00:00:00.000Z',
    listTrace: [],
    visibility: visibility === null ? null : { visibility, ruleId: 'rule_secret', tied: false, trace: [] },
    priceListAudience: { kind: 'customerGroup', customerGroupId: 'ccgrp_secret' },
    cascade: [],
    quote: {
      priceListId: 'cprl_secret', priceListVersionId: 'cplv_secret', lineId: 'cpll_secret', subjectKey: 'variant:x', quantity: 1,
      netPrice: netAmount, priceQuantity: extra.priceQuantity ?? 1, unitCode: extra.unitCode ?? 'pcs', listAmount: netAmount * 2,
      conditionId: 'cdc_secret', discountSteps: [5000], discountAmount: netAmount, netAmount, trace: [],
    },
  } as PriceQuoteResult;
}

describe('showcasePriceOf — η ορατότητα πρώτα, ποτέ διάκριση «κρυφό» από «χωρίς τιμή»', () => {
  it.each([['hidden'], ['visibleNoPrice']] as const)('%s ⇒ onRequest, ακόμη και με τιμή', (visibility) => {
    expect(showcasePriceOf(priced(1000, visibility), 24, 'buyer')).toEqual({ kind: 'onRequest' });
  });

  it('χωρίς ετυμηγορία ⇒ η προεπιλογή (hidden) ⇒ onRequest', () => {
    expect(showcasePriceOf(priced(1000, null), 24, 'anonymous')).toEqual({ kind: 'onRequest' });
  });

  it('ορατό χωρίς κρίση τιμής ⇒ onRequest', () => {
    const noLine = { ...priced(1000, 'visible'), kind: 'noLine', priceListId: 'p', priceListVersionId: 'v' } as PriceQuoteResult;
    expect(showcasePriceOf(noLine, 24, 'anonymous')).toEqual({ kind: 'onRequest' });
  });
});

describe('showcasePriceOf — ο ανώνυμος είναι καταναλωτής (Οδηγία 98/6 άρθ. 2α)', () => {
  it('τελική με ΦΠΑ · μία στρογγύλευση · κλειστό σχήμα χωρίς κανένα id λίστας, συνθήκης ή κοινού', () => {
    const price = showcasePriceOf(priced(1005, 'visible'), 24, 'anonymous');
    expect(price).toEqual({ kind: 'priced', audience: 'anonymous', currency: 'EUR', unitCode: 'pcs', priceQuantity: 1, net: null, gross: 1246, vatRate: 24, unitNet: null, unitGross: null });
    expect(JSON.stringify(price)).not.toMatch(/secret/);
  });

  it('Μ-5: τίποτα χωρίς ΦΠΑ προς τον ανώνυμο — ούτε σε πεδίο που η οθόνη δεν δείχνει (RSC payload του ISR)', () => {
    const per100 = showcasePriceOf(priced(8400, 'visible', { priceQuantity: 100, unitCode: 'm' }), 24, 'anonymous');
    expect(per100).toMatchObject({ net: null, unitNet: null });
    expect(JSON.stringify(per100)).not.toMatch(/8400|"unitNet":84\b/);
    expect(showcasePriceOf(priced(8400, 'visible', { priceQuantity: 100, unitCode: 'm' }), 24, 'buyer')).toMatchObject({ audience: 'buyer', net: 8400, unitNet: 84 });
  });

  it('χωρίς γνωστό συντελεστή ⇒ καμία τιμή προς τον ανώνυμο · ο αγοραστής παίρνει καθαρή χωρίς τελική', () => {
    expect(showcasePriceOf(priced(1000, 'visible'), null, 'anonymous')).toEqual({ kind: 'onRequest' });
    expect(showcasePriceOf(priced(1000, 'visible'), null, 'buyer')).toMatchObject({ kind: 'priced', audience: 'buyer', net: 1000, gross: null, vatRate: null });
  });

  it('τιμή «ανά 100 m» ⇒ και τιμή για ένα μέτρο (άρθ. 3) · ανά τεμάχιο ⇒ καμία δεύτερη', () => {
    const per100 = showcasePriceOf(priced(8400, 'visible', { priceQuantity: 100, unitCode: 'm' }), 24, 'anonymous');
    expect(per100).toMatchObject({ gross: 10416, unitGross: 104 });
  });
});

describe('vatInclusiveAmount', () => {
  it('ακέραια λεπτά, μισό-προς-τα-πάνω · αρνείται άκυρα', () => {
    expect(vatInclusiveAmount(1000, 24)).toBe(1240);
    expect(vatInclusiveAmount(1, 6)).toBe(1);
    expect(vatInclusiveAmount(25, 6)).toBe(27);
    expect(vatInclusiveAmount(1000, 0)).toBe(1000);
    expect(vatInclusiveAmount(-1, 24)).toBeNull();
    expect(vatInclusiveAmount(10.5, 24)).toBeNull();
    expect(vatInclusiveAmount(1000, 13.5)).toBeNull();
  });
});

describe('showcaseVatRateOf — κάθε κλάδος χωριστά, αντίφαση ⇒ καμία τελική (Χ2)', () => {
  const cat = (id: string, vatRate: GreekVatRatePercent | null, ancestorIds: readonly string[] = []) => [id, { id, vatRate, ancestorIds }] as const;
  const byId = new Map<string, { readonly id: string; readonly vatRate: GreekVatRatePercent | null; readonly ancestorIds: readonly string[] }>([
    cat('root', 24), cat('food', 13, ['root']), cat('silent', null, ['root']), cat('deep', null, ['root', 'silent']), cat('books', 6), cat('orphan', null),
  ]);

  it('ο απόγονος νικά τον πρόγονο στον ΙΔΙΟ κλάδο · η αδήλωτη κατηγορία κληρονομεί', () => {
    expect(showcaseVatRateOf(['food'], byId)).toBe(13);
    expect(showcaseVatRateOf(['deep'], byId)).toBe(24);
  });

  it('διαφορετικοί συντελεστές σε διαφορετικούς κλάδους ⇒ null, ΟΣΟ βαθιά κι αν είναι ο ένας', () => {
    expect(showcaseVatRateOf(['food', 'books'], byId)).toBeNull();
    expect(showcaseVatRateOf(['deep', 'books'], byId)).toBeNull();
  });

  it('ίδιος συντελεστής σε δύο κλάδους ⇒ αυτός · κλάδος χωρίς κανέναν δεν αντιφάσκει · τίποτα ⇒ null', () => {
    expect(showcaseVatRateOf(['deep', 'root'], byId)).toBe(24);
    expect(showcaseVatRateOf(['books', 'orphan'], byId)).toBe(6);
    expect(showcaseVatRateOf(['orphan', 'gone'], byId)).toBeNull();
  });
});

describe('perUnitAmount — τιμή μονάδας και με δεκαδική ποσότητα (Χ3)', () => {
  it('ανά 0,5 m² ⇒ διπλάσιο ανά m² · ανά 2,5 ⇒ μία στρογγύλευση · ανά 1 ⇒ καμία δεύτερη', () => {
    expect(perUnitAmount(1000, 0.5)).toBe(2000);
    expect(perUnitAmount(1001, 2.5)).toBe(400);
    expect(perUnitAmount(1000, 1)).toBeNull();
  });

  it('ποσότητα που δεν αναπαρίσταται ⇒ ο ανώνυμος παίρνει «Κατόπιν προσφοράς», όχι τιμή χωρίς τιμή μονάδας', () => {
    expect(perUnitAmount(1000, 1 / 3)).toBeNull();
    expect(showcasePriceOf(priced(1000, 'visible', { priceQuantity: 1 / 3 }), 24, 'anonymous')).toEqual({ kind: 'onRequest' });
    expect(showcasePriceOf(priced(1000, 'visible', { priceQuantity: 0.5, unitCode: 'm2' }), 24, 'anonymous')).toMatchObject({ unitGross: 2480 });
  });
});

describe('showcaseFromPrice — «από» μόνο ανάμεσα σε συγκρίσιμες τιμές', () => {
  const at = (gross: number, unitCode = 'pcs', priceQuantity = 1): ShowcasePrice =>
    ({ kind: 'priced', audience: 'anonymous', currency: 'EUR', unitCode, priceQuantity, net: null, gross, vatRate: 24, unitNet: null, unitGross: null });

  it('η χαμηλότερη τελική · το «Κατόπιν προσφοράς» δεν μετρά', () => {
    expect(showcaseFromPrice([at(900), { kind: 'onRequest' }, at(500), at(700)])?.gross).toBe(500);
  });

  it('η κάρτα είναι ανώνυμη: τιμή αγοραστή δεν γίνεται ποτέ «από»', () => {
    const buyer: ShowcasePrice = { kind: 'priced', audience: 'buyer', currency: 'EUR', unitCode: 'pcs', priceQuantity: 1, net: 100, gross: 124, vatRate: 24, unitNet: null, unitGross: null };
    expect(showcaseFromPrice([buyer, at(900)])?.gross).toBe(900);
  });

  it('3ος γύρος: η πόρτα προς τη διαδρομή του ανώνυμου κρατά μόνο τιμές καταναλωτή · τιμή αγοραστή ⇒ «Κατόπιν προσφοράς»', () => {
    const buyer: ShowcasePrice = { kind: 'priced', audience: 'buyer', currency: 'EUR', unitCode: 'pcs', priceQuantity: 1, net: 100, gross: 124, vatRate: 24, unitNet: null, unitGross: null };
    expect(consumerPricesOf({ a: at(900), b: buyer, c: { kind: 'onRequest' } })).toEqual({ a: at(900), b: { kind: 'onRequest' }, c: { kind: 'onRequest' } });
  });

  it('άλλη μονάδα ή ποσότητα ⇒ null · καμία τιμή ⇒ null', () => {
    expect(showcaseFromPrice([at(900), at(500, 'm')])).toBeNull();
    expect(showcaseFromPrice([at(900), at(500, 'pcs', 10)])).toBeNull();
    expect(showcaseFromPrice([{ kind: 'onRequest' }])).toBeNull();
  });
});
