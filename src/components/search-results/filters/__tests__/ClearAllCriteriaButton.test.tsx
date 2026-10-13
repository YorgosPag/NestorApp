/**
 * Το κοινό «Καθαρισμός όλων» — κανόνας ορατότητας, πράξη και κλάσεις ανά μέγεθος.
 * Η ιδιότητα «εμφανίζεται / εξαφανίζεται» μέσα στη μπάρα φυλάγεται και στο
 * `PrimaryFilterBar.test.tsx` (ομάδα Γ)· εδώ φυλάγεται το ίδιο το συστατικό.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { EMPTY_LISTING_FILTERS, type ListingFilters } from '@/lib/listings/listing-filters';
import { EMPTY_LISTING_CRITERIA, withValues } from '@/lib/criteria/listing-criteria';

import { ClearAllCriteriaButton } from '../ClearAllCriteriaButton';
import type { FilterCommit } from '../use-filter-commit';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const LABEL = 'search-filters:filters.clearAll';
const ASKING: ListingFilters = {
  ...EMPTY_LISTING_FILTERS,
  criteria: withValues(EMPTY_LISTING_CRITERIA, 'offerKind', ['sell']),
};
const NOT_ASKING: ListingFilters = EMPTY_LISTING_FILTERS;

function makeCommit(clearAllCriteria: () => void): FilterCommit {
  return { clearAllCriteria } as unknown as FilterCommit;
}

describe('ClearAllCriteriaButton', () => {
  it('μπάρα: δεν τυπώνει ΤΙΠΟΤΑ όταν δεν ζητήθηκε κριτήριο', () => {
    const { container } = render(
      <ClearAllCriteriaButton filters={NOT_ASKING} commit={makeCommit(jest.fn())} size="bar" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('πάνελ: δείχνει το `whenEmpty` όταν δεν ζητήθηκε κριτήριο — και όχι το κουμπί', () => {
    render(
      <ClearAllCriteriaButton
        filters={NOT_ASKING}
        commit={makeCommit(jest.fn())}
        size="panel"
        whenEmpty={<span>search-filters:filters.empty</span>}
      />
    );
    expect(screen.getByText('search-filters:filters.empty')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: LABEL })).not.toBeInTheDocument();
  });

  it('όταν ζητήθηκε κριτήριο, το `whenEmpty` δεν τυπώνεται', () => {
    render(
      <ClearAllCriteriaButton
        filters={ASKING}
        commit={makeCommit(jest.fn())}
        size="panel"
        whenEmpty={<span>search-filters:filters.empty</span>}
      />
    );
    expect(screen.queryByText('search-filters:filters.empty')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: LABEL })).toBeInTheDocument();
  });

  it('το πάτημα καλεί `clearAllCriteria`', () => {
    const clearAllCriteria = jest.fn();
    render(<ClearAllCriteriaButton filters={ASKING} commit={makeCommit(clearAllCriteria)} size="bar" />);
    fireEvent.click(screen.getByRole('button', { name: LABEL }));
    expect(clearAllCriteria).toHaveBeenCalledTimes(1);
  });

  it('κάθε μέγεθος κουβαλά τις κλάσεις του', () => {
    const { rerender } = render(
      <ClearAllCriteriaButton filters={ASKING} commit={makeCommit(jest.fn())} size="bar" />
    );
    const bar = screen.getByRole('button', { name: LABEL });
    expect(bar).toHaveClass('shrink-0', 'px-2', 'py-1.5', 'text-sm');
    expect(bar).not.toHaveClass('text-xs');

    rerender(<ClearAllCriteriaButton filters={ASKING} commit={makeCommit(jest.fn())} size="panel" />);
    const panel = screen.getByRole('button', { name: LABEL });
    expect(panel).toHaveClass('px-2', 'py-1', 'text-xs');
    expect(panel).not.toHaveClass('shrink-0', 'text-sm');
  });
});
