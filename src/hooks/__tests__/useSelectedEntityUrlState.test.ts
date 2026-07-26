/**
 * ============================================================================
 * useSelectedEntityUrlState — Unit tests (ADR-332 D21)
 * ============================================================================
 *
 * Καρφώνει το συμβόλαιο του **ενός** δοχείου επιλογής:
 *   - διαβάζει το id από το query string, χωρίς δεύτερη πηγή,
 *   - γράφει χωρίς να πειράξει άσχετα params,
 *   - `null` ⇒ σβήσιμο του param (αποεπιλογή),
 *   - ιδεμποτεντικό: ίδιο id ⇒ **καμία** εγγραφή στο ιστορικό,
 *   - ο setter έχει σταθερή ταυτότητα ⇒ δεν σπάει memoized καταναλωτές.
 *
 * 🔴 Το κρίσιμο: η επανασχεδίαση **δεν** ανατίθεται στο `useSearchParams()`. Μετρήθηκε
 * ότι ο συγχρονισμός `replaceState → useSearchParams` δουλεύει στο production build
 * αλλά **όχι** στον dev server, κι έτσι οι κάρτες «δεν άνοιγαν» τοπικά. Τα tests
 * «γράψιμο ⇒ νέα τιμή ΧΩΡΙΣ rerender» καρφώνουν ακριβώς αυτό: αν κάποιος ξαναδέσει
 * την ανάγνωση στον router, γίνονται κόκκινα.
 *
 * @see src/hooks/useSelectedEntityUrlState.ts
 */

import { renderHook, act } from '@testing-library/react';
import { useSelectedEntityUrlState } from '../useSelectedEntityUrlState';

/** Φέρνει το jsdom σε γνωστή αφετηρία. */
function startAt(url: string): void {
  window.history.replaceState(null, '', url);
}

describe('useSelectedEntityUrlState', () => {
  beforeEach(() => {
    startAt('/contacts');
    jest.restoreAllMocks();
  });

  it('reads the selected id from the URL', () => {
    startAt('/contacts?contactId=cont_1');

    const { result } = renderHook(() => useSelectedEntityUrlState('contactId'));

    expect(result.current.selectedId).toBe('cont_1');
  });

  it('is null when the param is absent', () => {
    const { result } = renderHook(() => useSelectedEntityUrlState('contactId'));

    expect(result.current.selectedId).toBeNull();
  });

  it('writes the selection into the URL and re-renders WITHOUT any rerender() nudge', () => {
    const { result } = renderHook(() => useSelectedEntityUrlState('contactId'));

    act(() => result.current.setSelectedId('cont_2'));

    expect(window.location.search).toBe('?contactId=cont_2');
    // Καμία χειροκίνητη επανασχεδίαση: αν αυτό περάσει, η ανάγνωση είναι όντως
    // αντιδραστική — το ελάττωμα «οι κάρτες δεν ανοίγουν» ήταν ακριβώς η αποτυχία του.
    expect(result.current.selectedId).toBe('cont_2');
  });

  it('re-renders on browser back/forward (popstate)', () => {
    const { result } = renderHook(() => useSelectedEntityUrlState('contactId'));

    act(() => {
      window.history.replaceState(null, '', '/contacts?contactId=cont_back');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current.selectedId).toBe('cont_back');
  });

  it('re-renders when a router navigation replaces the URL (pushState)', () => {
    const { result } = renderHook(() => useSelectedEntityUrlState('contactId'));

    // Ό,τι κάνει το `router.push('/contacts')` καταλήγει στο ίδιο native API.
    act(() => { window.history.pushState(null, '', '/contacts'); });

    expect(result.current.selectedId).toBeNull();
  });

  it('keeps unrelated query keys when writing', () => {
    startAt('/contacts?filter=%CE%91&tab=basic');

    const { result } = renderHook(() => useSelectedEntityUrlState('contactId'));
    act(() => result.current.setSelectedId('cont_3'));

    const params = new URLSearchParams(window.location.search);
    expect(params.get('contactId')).toBe('cont_3');
    expect(params.get('filter')).toBe('Α');
    expect(params.get('tab')).toBe('basic');
  });

  it('clears the param on null — deselection leaves no trace', () => {
    startAt('/contacts?contactId=cont_1');

    const { result } = renderHook(() => useSelectedEntityUrlState('contactId'));
    act(() => result.current.setSelectedId(null));

    expect(window.location.search).toBe('');
    expect(result.current.selectedId).toBeNull();
  });

  it('switches between two ids in a row — the second click is not swallowed', () => {
    startAt('/contacts?contactId=cont_1');

    const { result } = renderHook(() => useSelectedEntityUrlState('contactId'));
    act(() => result.current.setSelectedId('cont_2'));
    expect(result.current.selectedId).toBe('cont_2');

    act(() => result.current.setSelectedId('cont_3'));
    expect(result.current.selectedId).toBe('cont_3');
  });

  it('does not touch history when the id is unchanged (idempotent)', () => {
    startAt('/contacts?contactId=cont_1');
    const replaceSpy = jest.spyOn(window.history, 'replaceState');

    const { result } = renderHook(() => useSelectedEntityUrlState('contactId'));
    act(() => result.current.setSelectedId('cont_1'));

    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('does not touch history when clearing an already-absent selection', () => {
    const replaceSpy = jest.spyOn(window.history, 'replaceState');

    const { result } = renderHook(() => useSelectedEntityUrlState('contactId'));
    act(() => result.current.setSelectedId(null));

    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('keeps a stable setter identity across re-renders', () => {
    const { result, rerender } = renderHook(() => useSelectedEntityUrlState('contactId'));
    const first = result.current.setSelectedId;

    rerender();

    expect(result.current.setSelectedId).toBe(first);
  });

  it('is generic over the param name', () => {
    startAt('/projects?projectId=proj_9');

    const { result } = renderHook(() => useSelectedEntityUrlState('projectId'));

    expect(result.current.selectedId).toBe('proj_9');
  });
});
