/**
 * @fileoverview ΑΓΚΥΡΑ — **η επιλογή ζει στο URL, η εφήμερη εστίαση ΠΟΤΕ** (ADR-777 §8.77).
 * @related hooks/listings/useListingFocus.ts · hooks/useSelectedEntityUrlState.ts · lib/listings/listing-focus.ts
 *
 *   Σ1 · σύνδεσμος `?selected=x` ⇒ η σελίδα γεννιέται με το x επιλεγμένο.
 *   Σ2 · κλικ (`select`) ⇒ `?selected=` · τα άσχετα κλειδιά (`?view=`) μένουν.
 *   Σ3 · πέρασμα (`peek`) ⇒ το URL ΔΕΝ αλλάζει (δεκάδες φορές το δευτερόλεπτο — ποτέ στη διεύθυνση).
 *   Σ4 · `Escape` / `clear` ⇒ το κλειδί σβήνει.
 *   Σ5 · νέα αναζήτηση (`carryListingSelection`) ⇒ η επιλογή μεταφέρεται· χωρίς επιλογή ⇒ τίποτα.
 */

import { act, renderHook } from '@testing-library/react';

import { carryListingSelection, LISTING_SELECTED_PARAM } from '@/lib/listings/listing-focus';

import { useUrlListingFocus } from '../useListingFocus';

/** Η ειδοποίηση του `url-query-state` είναι microtask — περιμένουμε να αδειάσει. */
async function settle(action: () => void): Promise<void> {
  await act(async () => {
    action();
    await Promise.resolve();
  });
}

beforeEach(() => {
  window.history.replaceState(null, '', '/offers');
});

describe('useUrlListingFocus — το `selected` στο URL', () => {
  it('Σ1 · ο σύνδεσμος ανοίγει με το ακίνητο επιλεγμένο', () => {
    window.history.replaceState(null, '', '/offers?selected=ownp_7');
    const { result } = renderHook(() => useUrlListingFocus());
    expect(result.current.focus).toEqual({ peeked: null, selected: 'ownp_7' });
  });

  it('Σ2 · επιλογή ⇒ `?selected=`, χωρίς να χαθεί άσχετο κλειδί', async () => {
    window.history.replaceState(null, '', '/offers?view=map');
    const { result } = renderHook(() => useUrlListingFocus());

    await settle(() => result.current.select('ownp_2'));

    expect(new URLSearchParams(window.location.search).get(LISTING_SELECTED_PARAM)).toBe('ownp_2');
    expect(new URLSearchParams(window.location.search).get('view')).toBe('map');
    expect(result.current.focus.selected).toBe('ownp_2');
  });

  it('Σ3 · πέρασμα ⇒ εστίαση ναι, διεύθυνση όχι', async () => {
    const { result } = renderHook(() => useUrlListingFocus());

    await settle(() => result.current.peek('ownp_3'));

    expect(result.current.focus.peeked).toBe('ownp_3');
    expect(window.location.search).toBe('');
  });

  it('Σ4 · Escape ⇒ το κλειδί σβήνει (και το πέρασμα μαζί)', async () => {
    window.history.replaceState(null, '', '/offers?selected=ownp_7&view=map');
    const { result } = renderHook(() => useUrlListingFocus());

    await settle(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));

    expect(result.current.focus).toEqual({ peeked: null, selected: null });
    expect(window.location.search).toBe('?view=map');
  });
});

describe('carryListingSelection — η επιλογή επιβιώνει της νέας αναζήτησης', () => {
  it('Σ5 · μεταφέρεται όταν υπάρχει· τίποτα όταν δεν υπάρχει', () => {
    const next = new URLSearchParams('psalemax=300000');
    carryListingSelection(new URLSearchParams('selected=pl_1&psalemax=200000'), next);
    expect(next.toString()).toBe('psalemax=300000&selected=pl_1');

    const none = new URLSearchParams('psalemax=300000');
    carryListingSelection(new URLSearchParams('psalemax=200000'), none);
    expect(none.toString()).toBe('psalemax=300000');
  });
});
