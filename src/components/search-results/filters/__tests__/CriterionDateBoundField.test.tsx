/**
 * ADR-919 §12 — το χειριστήριο «Παράδοση»: η ημέρα γράφεται ΣΤΟ ΚΛΙΚ (όχι στην απόδοση), και το ξετσεκάρισμα σβήνει
 * μόνο το δικό του άκρο.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { EMPTY_LISTING_CRITERIA, withDateBound } from '@/lib/criteria/listing-criteria';

import { CriterionDateBoundField } from '../CriterionDateBoundField';
import type { FilterCommit } from '../use-filter-commit';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/lib/date-local', () => ({ todayLocalDate: () => '2026-10-24' }));

const BUILDING = 'search-filters:filters.delivery.building';

function renderField(after: string | null, by: string | null) {
  const setDateBound = jest.fn();
  const commit = { setDateBound } as unknown as FilterCommit;
  const criteria = withDateBound(EMPTY_LISTING_CRITERIA, 'delivery', { after, by });
  render(<CriterionDateBoundField criteria={criteria} criterionKey="delivery" commit={commit} />);
  return setDateBound;
}

describe('CriterionDateBoundField', () => {
  it('τσεκάρισμα ⇒ `after` = η σημερινή ημέρα, το `by` μένει ανέγγιχτο', () => {
    const setDateBound = renderField(null, '2027-03-31');
    fireEvent.click(screen.getByLabelText(BUILDING));
    expect(setDateBound).toHaveBeenCalledWith('delivery', { after: '2026-10-24', by: '2027-03-31' });
  });

  it('σύνδεσμος της περιοχής (ημέρα στιγμιότυπου) ⇒ τσεκαρισμένο· ξετσεκάρισμα σβήνει ΜΟΝΟ το `after`', () => {
    const setDateBound = renderField('2026-10-23', null);
    const box = screen.getByLabelText(BUILDING);
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(setDateBound).toHaveBeenCalledWith('delivery', { after: null, by: null });
  });
});
