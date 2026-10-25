import { act, renderHook } from '@testing-library/react';

let currentQuery = '';
const replace = jest.fn((href: string) => {
  currentQuery = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
});

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(currentQuery),
}));
jest.mock('@/lib/workspace/navigation', () => ({
  usePathname: () => '/o/comp_x/catalog/attributes',
  useRouter: () => ({ replace }),
}));
jest.mock('@/lib/workspace/route-worlds', () => ({
  declaredHref: (_reason: string, href: string) => href,
}));

import { NEW_SELECTION, useCatalogSelection } from '../use-catalog-selection';

function setup() {
  return renderHook(() => useCatalogSelection('attribute'));
}

describe('useCatalogSelection — η απάντηση του γραφέα δεν κλέβει την οθόνη (ADR-923 §5.9.2)', () => {
  beforeEach(() => {
    currentQuery = '';
    replace.mockClear();
  });

  it('η δημιουργία μεταφέρει στη νέα εγγραφή όσο ο άνθρωπος είναι στην ίδια συνεδρία', () => {
    const { result, rerender } = setup();
    act(() => result.current.select(NEW_SELECTION));
    rerender();
    const session = result.current.key;
    act(() => result.current.selectIfCurrent(session, 'cattr_1'));
    rerender();
    expect(result.current.selected).toBe('cattr_1');
  });

  it('«Νέα» ξανά ενώ στέλνεται η προηγούμενη ⇒ νέα συνεδρία (καθαρή φόρμα), η παλιά απάντηση ΔΕΝ πλοηγεί', () => {
    const { result, rerender } = setup();
    act(() => result.current.select(NEW_SELECTION));
    rerender();
    const firstNew = result.current.key;
    act(() => result.current.select(NEW_SELECTION));
    rerender();
    expect(result.current.selected).toBe(NEW_SELECTION);
    expect(result.current.key).not.toBe(firstNew);
    replace.mockClear();
    act(() => result.current.selectIfCurrent(firstNew, 'cattr_1'));
    expect(replace).not.toHaveBeenCalled();
    expect(result.current.selected).toBe(NEW_SELECTION);
  });

  it('επιλογή άλλης εγγραφής πριν απαντήσει ο γραφέας ⇒ η απάντηση δεν την αντικαθιστά', () => {
    const { result, rerender } = setup();
    act(() => result.current.select(NEW_SELECTION));
    rerender();
    const session = result.current.key;
    act(() => result.current.select('cattr_other'));
    act(() => result.current.selectIfCurrent(session, 'cattr_1'));
    rerender();
    expect(result.current.selected).toBe('cattr_other');
  });

  it('η συνεδρία λήγει τη στιγμή της επιλογής, ΠΡΙΝ αποδοθεί η νέα διεύθυνση', () => {
    const { result } = setup();
    const session = result.current.key;
    act(() => {
      result.current.select('cattr_other');
      result.current.selectIfCurrent(session, 'cattr_1');
    });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(currentQuery).toBe('attribute=cattr_other');
  });
});
