import type { PriceListVersionWire } from '@/subapps/catalog/types/pricing-views';
import type { PriceListVersionStatus } from '@/subapps/catalog/vocabulary/pricing';
import { summarizePriceList } from '../price-list-summary';

const version = (id: string, number: number, status: PriceListVersionStatus, validFrom: string | null, priceListId = 'pl_a') =>
  ({ id, number, status, validFrom, priceListId, basedOnVersionId: null, seal: null }) as unknown as PriceListVersionWire;

const NOW = Date.parse('2026-10-28T12:00:00.000Z');

describe('summarizePriceList — η λίστα τη στιγμή «τώρα»', () => {
  const versions = [
    version('v1', 1, 'superseded', '2026-01-01T00:00:00.000Z'),
    version('v2', 2, 'published', '2026-07-01T00:00:00.000Z'),
    version('v3', 3, 'published', '2027-01-01T00:00:00.000Z'),
    version('v4', 4, 'draft', null),
    version('v5', 5, 'draft', '2027-06-01T00:00:00.000Z'),
    version('v6', 6, 'discarded', '2027-03-01T00:00:00.000Z'),
    version('x1', 1, 'published', '2026-01-01T00:00:00.000Z', 'pl_other'),
  ];
  const summary = summarizePriceList('pl_a', versions, NOW);

  it('τρέχουσα = η τελευταία που άρχισε· μελλοντική = όσες αρχίζουν μετά το «τώρα»', () => {
    expect(summary.current?.id).toBe('v2');
    expect(summary.future.map((v) => v.id)).toEqual(['v3']);
  });

  it('χρονογραμμή: παραγόμενο «έως» από την επόμενη, φάσεις past · current · future', () => {
    expect(summary.bands.map((band) => [band.entry.version.id, band.phase, band.entry.window.untilMs])).toEqual([
      ['v1', 'past', Date.parse('2026-07-01T00:00:00.000Z')],
      ['v2', 'current', Date.parse('2027-01-01T00:00:00.000Z')],
      ['v3', 'future', null],
    ]);
  });

  it('πρόχειρες νεότερη πρώτη · εκδόσεις άλλης λίστας δεν μετρούν', () => {
    expect(summary.drafts.map((v) => v.id)).toEqual(['v5', 'v4']);
    expect(summary.discarded.map((v) => v.id)).toEqual(['v6']);
    expect(summary.hasVersions).toBe(true);
    expect(summarizePriceList('pl_empty', versions, NOW).hasVersions).toBe(false);
  });

  it('πριν από την πρώτη δημοσίευση ⇒ καμία τρέχουσα', () => {
    expect(summarizePriceList('pl_a', versions, Date.parse('2025-01-01T00:00:00.000Z')).current).toBeNull();
  });
});
