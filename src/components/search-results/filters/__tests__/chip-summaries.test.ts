/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **ΤΙ ΓΡΑΦΕΙ ΤΟ ΤΣΙΠ, ΚΑΙ ΠΟΤΕ ΥΠΑΡΧΕΙ ΤΟ ΤΣΙΠ ΔΙΑΜΟΝΗΣ** (ADR-777 §8.80).
 *
 * Δύο καθαρές αποφάσεις της γραμμής φίλτρων — ελέγχονται χωρίς DOM.
 */
import type { TFunction } from 'i18next';

import { EMPTY_LISTING_CRITERIA, withValues } from '@/lib/criteria/listing-criteria';
import { EMPTY_LISTING_FILTERS, type ListingFilters } from '@/lib/listings/listing-filters';

import { criterionRangeSummary } from '../criterion-range-summary';
import { askedStayCount, staySearchRelevant } from '../stay-search-relevance';

jest.mock('@/lib/intl-formatting', () => ({
  formatCurrency: (value: number) => `€${value}`,
  formatNumber: (value: number) => String(value),
}));

const t = ((key: string, vars?: Record<string, unknown>) =>
  vars === undefined ? key : `${key}${JSON.stringify(vars)}`) as unknown as TFunction;

describe('criterionRangeSummary', () => {
  it('χωρίς ερώτηση ⇒ ΣΚΕΤΟ το όνομα του άξονα — ποτέ «όλες»', () => {
    expect(criterionRangeSummary(t, 'priceSale')).toBe('search-filters:filters.axis.priceSale');
    expect(criterionRangeSummary(t, 'bedrooms', { min: null, max: null })).toBe(
      'listing-detail:attributes.label.bedrooms',
    );
  });

  it('τιμή: το νόμισμα λέει την ερώτηση — ΧΩΡΙΣ πρόθεμα άξονα', () => {
    expect(criterionRangeSummary(t, 'priceSale', { min: 100000, max: 200000 })).toBe(
      'search-filters:filters.range.summaryBoth{"min":"€100000","max":"€200000"}',
    );
  });

  it('μη-τιμή: ο άξονας ΜΠΑΙΝΕΙ μπροστά — «από 2» μόνο του δεν λέει τι μετρά', () => {
    const summary = criterionRangeSummary(t, 'bedrooms', { min: 2, max: null });
    expect(summary).toContain('search-filters:filters.range.summaryAxis');
    expect(summary).toContain('listing-detail:attributes.label.bedrooms');
    expect(summary).toContain('summaryMin');
  });

  it('μόνο άνω όριο ⇒ «έως»', () => {
    expect(criterionRangeSummary(t, 'priceRent', { min: null, max: 900 })).toBe(
      'search-filters:filters.range.summaryMax{"max":"€900"}',
    );
  });
});

describe('staySearchRelevant', () => {
  const offer = (kinds: string[]): ListingFilters => ({
    ...EMPTY_LISTING_FILTERS,
    criteria: withValues(EMPTY_LISTING_CRITERIA, 'offerKind', kinds),
  });

  it('χωρίς διάθεση ⇒ ορατό (η αναζήτηση περιέχει και διαμονές)', () => {
    expect(staySearchRelevant(EMPTY_LISTING_FILTERS)).toBe(true);
  });

  it('🔴 «Πώληση» ⇒ κρυμμένο — το στιγμιότυπο του Giorgio', () => {
    expect(staySearchRelevant(offer(['sell']))).toBe(false);
  });

  it('βραχυχρόνια ανάμεσα στις διαθέσεις ⇒ ορατό', () => {
    expect(staySearchRelevant(offer(['sell', 'leaseShort']))).toBe(true);
  });

  it('🔴 ενεργή ερώτηση διαμονής ΚΕΡΔΙΖΕΙ τη διάθεση — ενεργό φίλτρο δεν κρύβεται ποτέ', () => {
    expect(staySearchRelevant({ ...offer(['sell']), pets: 1 })).toBe(true);
    expect(
      staySearchRelevant({ ...offer(['sell']), stayWindow: { checkIn: '2026-10-01', checkOut: '2026-10-04' } }),
    ).toBe(true);
  });

  it('askedStayCount μετρά παράθυρο · άτομα · κατοικίδια', () => {
    expect(askedStayCount(EMPTY_LISTING_FILTERS)).toBe(0);
    expect(askedStayCount({ ...EMPTY_LISTING_FILTERS, guests: 2, pets: 0 })).toBe(2);
  });
});
