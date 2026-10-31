/**
 * Η καθαρή λογική της ανάλυσης τιμής (ADR-923 §5.11 «3δ» Τμήμα 3).
 */

import type { PriceQuoteResult } from '@/subapps/catalog/types/price-list-requests';
import type { PriceQuote } from '@/subapps/catalog/pricing/resolve-catalog-price';
import { bucketTrace, historyListOf, isCompleteAudience, savingVersusBaseline, type AnalysisCell } from '../price-analysis';

const CONTEXT = { viewer: { kind: 'anonymous' }, at: '2026-10-30T00:00:00.000Z', listTrace: [] } as const;

function priced(netAmount: number, priceListId = 'list-a'): AnalysisCell {
  const quote: PriceQuote = {
    priceListId,
    priceListVersionId: 'v1',
    lineId: 'l1',
    subjectKey: 'variant:x',
    quantity: 1,
    netPrice: 10_000,
    priceQuantity: 1,
    unitCode: 'pcs',
    listAmount: 10_000,
    conditionId: null,
    discountSteps: [],
    discountAmount: 10_000 - netAmount,
    netAmount,
    trace: [],
  };
  const result: PriceQuoteResult = { kind: 'priced', quote, priceListAudience: null, cascade: [], ...CONTEXT };
  return { state: 'ready', result };
}

const unpriced: AnalysisCell = { state: 'ready', result: { kind: 'noPriceList', ...CONTEXT } };

describe('isCompleteAudience', () => {
  it('μισό κοινό δεν ρωτά τον διακομιστή', () => {
    expect(isCompleteAudience({ kind: 'anonymous' })).toBe(true);
    expect(isCompleteAudience({ kind: 'customerGroup', customerGroupId: '' })).toBe(false);
    expect(isCompleteAudience({ kind: 'customerGroup', customerGroupId: 'g' })).toBe(true);
    expect(isCompleteAudience({ kind: 'partner', party: { kind: 'contact', contactId: '  ' } })).toBe(false);
    expect(isCompleteAudience({ kind: 'partner', party: { kind: 'contact', contactId: 'c' } })).toBe(true);
  });
});

describe('savingVersusBaseline', () => {
  const baseline = priced(10_000);

  it('θετικό = φθηνότερα · αρνητικό = ακριβότερα', () => {
    expect(savingVersusBaseline(priced(4_500), baseline)).toBe(5_500);
    expect(savingVersusBaseline(priced(12_000), baseline)).toBe(-2_000);
  });

  it('το πρώτο κοινό δεν συγκρίνεται με τον εαυτό του', () => {
    expect(savingVersusBaseline(baseline, baseline)).toBeNull();
  });

  it('⛔ καμία σύγκριση με κενό: χωρίς τιμή, αποτυχία ή φόρτωση σε μία από τις δύο πλευρές', () => {
    expect(savingVersusBaseline(unpriced, baseline)).toBeNull();
    expect(savingVersusBaseline(priced(100), unpriced)).toBeNull();
    expect(savingVersusBaseline({ state: 'failed' }, baseline)).toBeNull();
    expect(savingVersusBaseline(priced(100), { state: 'loading' })).toBeNull();
  });
});

describe('bucketTrace', () => {
  it('πρώτα ο νικητής· οι ανενεργές χωριστά· όσες αφορούν άλλους μόνο μετρούνται', () => {
    const buckets = bucketTrace([
      { id: 'a', verdict: 'audienceMismatch' },
      { id: 'b', verdict: 'outranked' },
      { id: 'c', verdict: 'selected' },
      { id: 'd', verdict: 'expired' },
      { id: 'e', verdict: 'notYetValid' },
      { id: 'f', verdict: 'groupMismatch' },
    ]);
    expect(buckets.relevant.map((entry) => entry.id)).toEqual(['c', 'b']);
    expect(buckets.inactive.map((entry) => entry.id)).toEqual(['d', 'e']);
    expect(buckets.unrelatedCount).toBe(2);
  });

  it('ισοπαλία: και οι δύο πλευρές φαίνονται', () => {
    const { relevant } = bucketTrace([{ id: 'a', verdict: 'tied' }, { id: 'b', verdict: 'tied' }]);
    expect(relevant).toHaveLength(2);
  });
});

describe('historyListOf', () => {
  it('η επιλογή του ανθρώπου υπερισχύει· αλλιώς η λίστα του πρώτου κοινού που έχει τιμή', () => {
    expect(historyListOf('mine', [priced(1, 'other')])).toBe('mine');
    expect(historyListOf(null, [unpriced, { state: 'failed' }, priced(1, 'list-b'), priced(1, 'list-c')])).toBe('list-b');
    expect(historyListOf(null, [unpriced])).toBeNull();
  });
});
