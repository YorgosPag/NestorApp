/**
 * Άγκυρες — ADR-777 §8.60.14.14 (Φάση 4): **το «Εύρος τιμής» των πινάκων φίλτρων.**
 *
 * 1. Το χειριστήριο γράφει **πάντα** ρόλο + όρια· αλλαγή μονάδας **καθαρίζει** τους αριθμούς
 *    (ένα «έως 200.000» πώλησης δεν γίνεται σιωπηλά «έως 200.000 €/μήνα»).
 * 2. Τα πεδία `'ranges.X'` (θέσεις/αποθήκες) γράφουν στο `ranges.X` — πριν έγραφαν στο
 *    **κυριολεκτικό** κλειδί `ranges['ranges.X']`, που καμία μηχανή δεν διάβαζε.
 *
 * ⚠️ Το Radix Select δεν ανοίγει σε jsdom ⇒ αντικαθίσταται από εγγενές `<select>` με το ίδιο
 * συμβόλαιο (`value` · `onValueChange`). Κρίνεται η **λογική** του πεδίου, όχι η βιβλιοθήκη.
 */

import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/ui/select', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const Ctx = ReactActual.createContext<{ value: string; onValueChange: (v: string) => void } | null>(null);
  return {
    Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
      <Ctx.Provider value={{ value, onValueChange }}>{children}</Ctx.Provider>
    ),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => {
      const ctx = ReactActual.useContext(Ctx);
      return (
        <select aria-label="unit" value={ctx?.value} onChange={(e) => ctx?.onValueChange(e.target.value)}>
          {children}
        </select>
      );
    },
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
  };
});

import { PriceRangeFilterField } from '../PriceRangeFilterField';
import { nestedRangeKey, useGenericFilters } from '../useGenericFilters';
import { PRICE_RANGE_ROLE_KEY } from '@/lib/listings/listing-price-keys';
import type { RolePriceRange } from '@/lib/properties/price-range';
import type { GenericFilterState } from '../types';

describe('Α. ΤΟ ΧΕΙΡΙΣΤΗΡΙΟ ΓΡΑΦΕΙ ΑΡΙΘΜΟΥΣ ΜΕ ΜΟΝΑΔΑ', () => {
  function draw(value: RolePriceRange) {
    const onChange = jest.fn<void, [RolePriceRange]>();
    render(<PriceRangeFilterField id="priceRange" value={value} onChange={onChange} />);
    return onChange;
  }

  it('Α1 — ένα όριο ⇒ ΟΛΟΚΛΗΡΟ το εύρος, με τον ρόλο του', () => {
    const onChange = draw({ role: 'rent', min: 50 });
    fireEvent.change(screen.getByLabelText(`filters:maximum — ${PRICE_RANGE_ROLE_KEY.rent}`), { target: { value: '900' } });
    expect(onChange).toHaveBeenLastCalledWith({ role: 'rent', min: 50, max: 900 });
  });

  it('🔴 Α2 — αλλαγή μονάδας ⇒ τα όρια ΚΑΘΑΡΙΖΟΥΝ (ο αριθμός ανήκε στη μονάδα του)', () => {
    const onChange = draw({ role: 'sale', min: 100_000, max: 200_000 });
    fireEvent.change(screen.getByLabelText('unit'), { target: { value: 'rent' } });
    expect(onChange).toHaveBeenLastCalledWith({ role: 'rent', min: undefined, max: undefined });
  });

  it('Α3 — άδειο κουτί ⇒ ανοιχτό άκρο, ποτέ 0', () => {
    const onChange = draw({ role: 'sale', min: 10 });
    fireEvent.change(screen.getByLabelText(`filters:minimum — ${PRICE_RANGE_ROLE_KEY.sale}`), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ role: 'sale', min: undefined, max: undefined });
  });

  it('Α4 — η ετικέτα κάθε ορίου ΛΕΕΙ τη μονάδα (αναγνώστης οθόνης)', () => {
    draw({ role: 'nightly' });
    expect(screen.getByLabelText(`filters:minimum — ${PRICE_RANGE_ROLE_KEY.nightly}`)).toBeTruthy();
  });
});

describe('Β. ΤΑ ΕΜΦΩΛΕΥΜΕΝΑ ΕΥΡΗ ΦΤΑΝΟΥΝ ΣΤΗ ΜΗΧΑΝΗ', () => {
  it('Β1 — `ranges.priceRange` ⇒ `priceRange`· άμεσο πεδίο ⇒ `null`', () => {
    expect(nestedRangeKey('ranges.priceRange')).toBe('priceRange');
    expect(nestedRangeKey('priceRange')).toBeNull();
  });

  it('🔴 Β2 — κουτί εύρους σε `ranges.areaRange` γράφει στο `ranges.areaRange`, ΟΧΙ σε κλειδί με τελεία', () => {
    const onFiltersChange = jest.fn<void, [GenericFilterState]>();
    const filters: GenericFilterState = { ranges: { areaRange: { min: undefined, max: undefined } } };
    const { result } = renderHook(() => useGenericFilters(filters, onFiltersChange));
    act(() => result.current.handleRangeChange('ranges.areaRange', 'min', '12'));
    const next = onFiltersChange.mock.calls[0][0];
    expect(next.ranges?.areaRange).toEqual({ min: 12, max: undefined });
    expect(next.ranges?.['ranges.areaRange']).toBeUndefined();
  });
});
