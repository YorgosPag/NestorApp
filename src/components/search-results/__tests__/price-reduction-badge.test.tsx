/**
 * ΑΓΚΥΡΕΣ — η σήμανση μείωσης τιμής και η λεπτομερής μορφή της (ADR-777 §8.69)
 *
 * ⚠️ **Το `t` επιστρέφει το ΚΛΕΙΔΙ με τις παραμέτρους**, ίδιο ιδίωμα με τα αδέλφια: η άγκυρα
 * ρωτά **ποιο** κείμενο ζητήθηκε, όχι τη διατύπωση.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ListingPriceReduction } from '@/components/listing-detail/ListingPriceReduction';
import { MS_PER_DAY } from '@/lib/date-local';
import { formatCurrency } from '@/lib/intl-formatting';
import type { PriceReduction } from '@/types/price-history';

import { PriceReductionBadge } from '../PriceReductionBadge';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({ text: { success: 'theme-text-success' } }),
}));

const SINCE = '2026-09-10T08:00:00.000Z';

const REDUCTION: PriceReduction = {
  role: 'sale',
  from: 3_490_000,
  to: 3_200_000,
  dropBasisPoints: 830,
  since: SINCE,
};

function at(msAfterSince: number): void {
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse(SINCE) + msAfterSince);
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Σ — η σήμανση δείχνεται μόνο όσο η μείωση είναι ΦΡΕΣΚΙΑ', () => {
  it('Σ1 — φρέσκια μείωση ⇒ διαγραμμένη η παλιά τιμή και το ποσοστό', () => {
    at(MS_PER_DAY);
    const { container } = render(<PriceReductionBadge reduction={REDUCTION} />);

    // ⚠️ **Ακριβής σύγκριση `textContent`, ΟΧΙ `toHaveTextContent`**: το `Intl` βάζει NBSP
    //    (U+00A0) πριν το «€», και ο matcher κανονικοποιεί κενά ⇒ τυπώνονται ίδια αλλά
    //    διαφέρουν. Ρωτάμε το ΙΔΙΟ SSoT, byte προς byte.
    expect(container.querySelector('del')?.textContent).toBe(formatCurrency(3_490_000));
    expect(screen.getByText(/↓/)).toBeInTheDocument();
  });

  it('🔴 Σ2 — μείωση που έληξε (30+ ημέρες) ⇒ ΤΙΠΟΤΑ, ποτέ μπαγιάτικο «↓%»', () => {
    at(31 * MS_PER_DAY);
    const { container } = render(<PriceReductionBadge reduction={REDUCTION} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('Σ3 — καμία μείωση ⇒ τίποτα', () => {
    const { container } = render(<PriceReductionBadge reduction={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('Κ — η σήμανση του κελύφους κουβαλά ΕΝΑ κλειδί (CHECK 3.34)', () => {
  it('🔴 Κ1 — ΜΟΝΟ το `common:priceReduction.was`· καμία ημερομηνία, καμία αναφορά', () => {
    at(MS_PER_DAY);
    render(<PriceReductionBadge reduction={REDUCTION} />);

    expect(screen.queryByText(/listing-detail:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/priceReduction\.basis/)).not.toBeInTheDocument();
  });
});

describe('Λ — η σελίδα της αγγελίας λέει ΠΟΤΕ και ΣΕ ΣΧΕΣΗ ΜΕ ΤΙ', () => {
  it('Λ1 — σήμανση + ημερομηνία μείωσης + η αναφορά των 30 ημερών', () => {
    at(MS_PER_DAY);
    const { container } = render(<ListingPriceReduction reduction={REDUCTION} />);

    expect(container.querySelector('del')).not.toBeNull();
    expect(screen.getByText(/listing-detail:priceReduction\.since/)).toBeInTheDocument();
    expect(screen.getByText('listing-detail:priceReduction.basis')).toBeInTheDocument();
  });

  it('🔴 Λ2 — μείωση που έληξε ⇒ ΟΥΤΕ η ημερομηνία ΟΥΤΕ η αναφορά μένουν ορφανές', () => {
    at(31 * MS_PER_DAY);
    const { container } = render(<ListingPriceReduction reduction={REDUCTION} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('Π — προσβασιμότητα και θέμα', () => {
  it('Π1 — ο αναγνώστης οθόνης ακούει ΤΙ είναι το διαγραμμένο ποσό', () => {
    at(MS_PER_DAY);
    render(<PriceReductionBadge reduction={REDUCTION} />);

    expect(screen.getByText(/common:priceReduction\.was/)).toHaveClass('sr-only');
  });

  it('Π2 — το ποσοστό παίρνει το ΘΕΜΑΤΙΚΟ χρώμα επιτυχίας, ποτέ ωμό', () => {
    at(MS_PER_DAY);
    render(<PriceReductionBadge reduction={REDUCTION} />);

    expect(screen.getByText(/↓/)).toHaveClass('theme-text-success');
  });
});
