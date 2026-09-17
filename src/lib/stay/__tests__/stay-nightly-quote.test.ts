/** ADR-835 §21 — τιμή ανά νύχτα σε ακέραια λεπτά· ποτέ 0 για άγνωστη νύχτα. */

import { minorFromMajor, sumMinor } from '@/lib/money/money';
import { stayQuoteOf } from '@/lib/stay/stay-nightly-quote';

import { listingOf } from './stay-rules-fixtures';

describe('money — ακέραια λεπτά', () => {
  it('στρογγύλευση χωρίς σφάλμα αναπαράστασης (1.005 € ⇒ 101 λεπτά)', () => {
    expect(minorFromMajor(1.005)).toBe(101);
    expect(minorFromMajor(64.9)).toBe(6490);
  });

  it('🔴 αρνητικό / NaN / άπειρο ⇒ null, ποτέ NaN που ταξιδεύει', () => {
    expect(minorFromMajor(-1)).toBeNull();
    expect(minorFromMajor(Number.NaN)).toBeNull();
    expect(minorFromMajor(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('επτά νύχτες × 64,90 € = ακριβώς 454,30 € (σε κινητή υποδιαστολή δεν είναι)', () => {
    expect(sumMinor(Array.from({ length: 7 }, () => 6490))).toBe(45430);
  });
});

describe('stayQuoteOf', () => {
  it('βάση της αγγελίας + υπέρβαση ημέρας, νύχτα-νύχτα', () => {
    const quote = stayQuoteOf(listingOf(), { '2026-09-11': { nightlyRateMinor: 12000 } }, '2026-09-10', '2026-09-13');
    expect(quote).toEqual({
      kind: 'priced',
      nights: [
        { date: '2026-09-10', amountMinor: 8000, source: 'base' },
        { date: '2026-09-11', amountMinor: 12000, source: 'day' },
        { date: '2026-09-12', amountMinor: 8000, source: 'base' },
      ],
      totalMinor: 28000,
    });
  });

  it('🔴 χωρίς τιμή αγγελίας: μόνο οι νύχτες με υπέρβαση έχουν τιμή — οι άλλες ΟΝΟΜΑΖΟΝΤΑΙ', () => {
    const quote = stayQuoteOf(listingOf(undefined, undefined, null), { '2026-09-10': { nightlyRateMinor: 5000 } }, '2026-09-10', '2026-09-12');
    expect(quote).toEqual({ kind: 'unpriced', missing: ['2026-09-11'] });
  });

  it('🔴 υπέρβαση 0 λεπτών είναι ΤΙΜΗ (δωρεάν νύχτα), όχι απουσία', () => {
    const quote = stayQuoteOf(listingOf(undefined, undefined, null), { '2026-09-10': { nightlyRateMinor: 0 } }, '2026-09-10', '2026-09-11');
    expect(quote).toEqual({ kind: 'priced', nights: [{ date: '2026-09-10', amountMinor: 0, source: 'day' }], totalMinor: 0 });
  });

  it('ανάποδο ή κενό διάστημα ⇒ null', () => {
    expect(stayQuoteOf(listingOf(), {}, '2026-09-12', '2026-09-10')).toBeNull();
    expect(stayQuoteOf(listingOf(), {}, '2026-09-10', '2026-09-10')).toBeNull();
  });
});
