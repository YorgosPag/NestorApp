/**
 * ADR-915 §42 — άγκυρες της προσφοράς: σύνολα σε λεπτά, εγκυρότητα όρων, αναθεώρηση, δέσιμο παραστατικού.
 */

import {
  ELECTRONIC_PAYMENT_THRESHOLD_MINOR,
  agreedQuoteOf,
  areQuoteTermsValid,
  canReviseQuote,
  nextQuoteOf,
  quoteTotalsOf,
  receiptMatchesQuote,
  requiresElectronicPayment,
  type IssuanceQuote,
  type QuoteSubmission,
  type QuoteTerms,
} from '@/lib/document-validity/issuance-quote';
import type { GreekVatRatePercent } from '@/subapps/accounting/services/config/vat-rates';

const TERMS: QuoteTerms = {
  basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false,
  validUntil: '2026-12-31', scope: ['issuance', 'registration'], note: null, deliveryBusinessDays: 5, advance: null,
};
const SUBMISSION: QuoteSubmission = { by: 'recorded', recordedByUid: 'uid_agent' };
const NOW = '2026-10-17T09:00:00.000Z';

function quote(overrides: Partial<IssuanceQuote> = {}): IssuanceQuote {
  return { ...TERMS, revision: 1, at: NOW, submission: SUBMISSION, previous: null, ...overrides };
}

describe('ADR-915 §42 — quoteTotalsOf', () => {
  it('ΦΠΑ εκτός: 10000 στο 24% ⇒ καθαρό 10000 · ΦΠΑ 2400 · σύνολο 12400', () => {
    expect(quoteTotalsOf(TERMS)).toEqual({ netMinor: 10_000, vatMinor: 2_400, totalMinor: 12_400 });
  });

  it('ΦΠΑ μέσα: 12400 στο 24% ⇒ καθαρό 10000 · ΦΠΑ 2400 · σύνολο 12400', () => {
    expect(quoteTotalsOf({ ...TERMS, amountMinor: 12_400, vatIncluded: true })).toEqual({ netMinor: 10_000, vatMinor: 2_400, totalMinor: 12_400 });
  });

  it('συντελεστής 0 ⇒ καθαρό = σύνολο, ΦΠΑ 0', () => {
    expect(quoteTotalsOf({ ...TERMS, vatRatePercent: 0 })).toEqual({ netMinor: 10_000, vatMinor: 0, totalMinor: 10_000 });
    expect(quoteTotalsOf({ ...TERMS, vatRatePercent: 0, vatIncluded: true })).toEqual({ netMinor: 10_000, vatMinor: 0, totalMinor: 10_000 });
  });

  it('η στρογγύλευση κρατά πάντα καθαρό + ΦΠΑ = σύνολο', () => {
    for (const vatIncluded of [true, false]) {
      for (const vatRatePercent of [24, 13, 6, 0] as const) {
        for (const amountMinor of [1, 7, 999, 9_999, 12_345]) {
          const totals = quoteTotalsOf({ amountMinor, vatRatePercent, vatIncluded });
          expect(totals.netMinor + totals.vatMinor).toBe(totals.totalMinor);
          expect(Number.isInteger(totals.vatMinor)).toBe(true);
        }
      }
    }
  });
});

describe('ADR-915 §42 — areQuoteTermsValid', () => {
  const TODAY = '2026-10-17';

  it('έγκυροι όροι ⇒ true (και η ισχύς «σήμερα» επιτρέπεται)', () => {
    expect(areQuoteTermsValid(TERMS, TODAY)).toBe(true);
    expect(areQuoteTermsValid({ ...TERMS, validUntil: TODAY }, TODAY)).toBe(true);
  });

  it('μηδενικό ποσό ⇒ false', () => {
    expect(areQuoteTermsValid({ ...TERMS, amountMinor: 0 }, TODAY)).toBe(false);
  });

  it('συντελεστής εκτός πίνακα ⇒ false', () => {
    expect(areQuoteTermsValid({ ...TERMS, vatRatePercent: Number('20') as GreekVatRatePercent }, TODAY)).toBe(false);
  });

  it('κενό περιεχόμενο τιμής ⇒ false', () => {
    expect(areQuoteTermsValid({ ...TERMS, scope: [] }, TODAY)).toBe(false);
  });

  it('ισχύς στο παρελθόν ⇒ false', () => {
    expect(areQuoteTermsValid({ ...TERMS, validUntil: '2026-10-16' }, TODAY)).toBe(false);
  });
});

describe('ADR-915 §42 — canReviseQuote', () => {
  it('δεσμευτική ⇒ όχι', () => {
    expect(canReviseQuote(quote({ basis: 'firm' }))).toBe(false);
  });

  it('ενδεικτική, αναθεώρηση 1 ⇒ ναι · αναθεώρηση 2 ⇒ όχι', () => {
    expect(canReviseQuote(quote({ basis: 'indicative', revision: 1 }))).toBe(true);
    expect(canReviseQuote(quote({ basis: 'indicative', revision: 2 }))).toBe(false);
  });
});

describe('ADR-915 §42 — nextQuoteOf', () => {
  it('πρώτη προσφορά: αναθεώρηση 1, χωρίς προηγούμενη', () => {
    expect(nextQuoteOf(null, TERMS, SUBMISSION, NOW)).toEqual({ ...TERMS, revision: 1, at: NOW, submission: SUBMISSION, previous: null });
  });

  it('αναθεώρηση: αύξηση αριθμού, η προηγούμενη μένει ΧΩΡΙΣ δική της previous', () => {
    const first = quote({ basis: 'indicative' });
    const later = '2026-10-20T09:00:00.000Z';
    const revised = nextQuoteOf(first, { ...TERMS, amountMinor: 20_000 }, SUBMISSION, later);
    expect(revised.revision).toBe(2);
    expect(revised.amountMinor).toBe(20_000);
    expect(revised.at).toBe(later);
    expect(revised.previous).toEqual({
      basis: 'indicative', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false, validUntil: '2026-12-31',
      scope: ['issuance', 'registration'], note: null, deliveryBusinessDays: 5, advance: null, revision: 1, at: NOW, submission: SUBMISSION,
    });
    expect(revised.previous).not.toHaveProperty('previous');
  });
});

describe('ADR-915 §42 — receiptMatchesQuote', () => {
  const MARK = '123456789012345';
  const approved = quote();

  it('ΜΑΡΚ 14 ψηφίων ⇒ false', () => {
    expect(receiptMatchesQuote({ mark: '12345678901234', totalMinor: 12_400 }, approved, 0)).toBe(false);
  });

  it('λάθος σύνολο ⇒ false', () => {
    expect(receiptMatchesQuote({ mark: MARK, totalMinor: 10_000 }, approved, 0)).toBe(false);
  });

  it('ακριβές σύνολο (με ΦΠΑ) και έγκυρος ΜΑΡΚ ⇒ true', () => {
    expect(receiptMatchesQuote({ mark: MARK, totalMinor: 12_400 }, approved, 0)).toBe(true);
  });

  it('ADR-943 Κ-7 — με εισπραγμένη προκαταβολή: το τελικό = σύνολο − προκαταβολή', () => {
    expect(receiptMatchesQuote({ mark: MARK, totalMinor: 8_400 }, approved, 4_000)).toBe(true);
    expect(receiptMatchesQuote({ mark: MARK, totalMinor: 12_400 }, approved, 4_000)).toBe(false);
  });
});

describe('ADR-915 §42 — requiresElectronicPayment', () => {
  it('κατώφλι 50000 λεπτών: κάτω ⇒ όχι, στο όριο και πάνω ⇒ ναι', () => {
    expect(ELECTRONIC_PAYMENT_THRESHOLD_MINOR).toBe(50_000);
    expect(requiresElectronicPayment({ netMinor: 0, vatMinor: 0, totalMinor: 49_999 })).toBe(false);
    expect(requiresElectronicPayment({ netMinor: 0, vatMinor: 0, totalMinor: 50_000 })).toBe(true);
  });
});

describe('ADR-915 §45.10 — agreedQuoteOf (η συμφωνημένη προσφορά)', () => {
  const approved = (quoteRevision: number | null) => ({ outcome: 'approved' as const, quoteRevision });

  it('έγκριση της τρέχουσας αναθεώρησης ⇒ η προσφορά', () => {
    const current = quote({ revision: 2 });
    expect(agreedQuoteOf({ decision: approved(2), quote: current })).toBe(current);
  });

  it('καμία συμφωνία ⇒ null: χωρίς απόφαση · απόρριψη · έγκριση παλιάς αναθεώρησης · παλιά ανάθεση · χωρίς προσφορά', () => {
    expect(agreedQuoteOf({ decision: null, quote: quote() })).toBeNull();
    expect(agreedQuoteOf({ decision: { outcome: 'rejected', quoteRevision: 1 }, quote: quote() })).toBeNull();
    expect(agreedQuoteOf({ decision: approved(1), quote: quote({ revision: 2 }) })).toBeNull();
    expect(agreedQuoteOf({ decision: approved(null), quote: quote() })).toBeNull();
    expect(agreedQuoteOf({ decision: approved(1), quote: null })).toBeNull();
  });
});
