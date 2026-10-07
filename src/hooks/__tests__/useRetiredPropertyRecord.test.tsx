/**
 * @fileoverview **ΑΓΚΥΡΕΣ: Ο ΑΝΑΓΝΩΣΤΗΣ ΤΟΥ ΑΠΟΣΥΡΜΕΝΟΥ ΑΚΙΝΗΤΟΥ** (ADR-329 §3.9 · ADR-281).
 * @related hooks/useRetiredPropertyRecord · components/properties/detail/property-page-state
 *
 * Τρία πράγματα μπορεί να κάνει σιωπηλά λάθος ένας «λεπτός» αναγνώστης, και κανένα δεν φαίνεται
 * στην οθόνη ως σφάλμα:
 *   • να ρωτά **πάντα** — δεύτερη ανάγνωση για κάθε ζωντανό ακίνητο, που ο κατάλογος έχει ήδη·
 *   • να δείχνει **ζωντανό** ακίνητο από δεύτερη πόρτα — δύο αναγνώστες για την ίδια εγγραφή·
 *   • να βαφτίζει την **αποτυχία** «δεν βρέθηκε».
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';

import { useRetiredPropertyRecord } from '../useRetiredPropertyRecord';

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: jest.fn() },
}));

const get = apiClient.get as jest.Mock;

const ARCHIVED = { id: 'prop_1', name: 'Δ3', status: 'archived', archivedAt: '2026-10-07T10:00:00.000Z' };
const TRASHED = { id: 'prop_1', name: 'Δ3', status: 'deleted', deletedAt: '2026-10-07T10:00:00.000Z' };
const LIVE = { id: 'prop_1', name: 'Δ3', status: 'for-sale' };

beforeEach(() => {
  get.mockReset();
});

describe('ADR-329 §3.9 — useRetiredPropertyRecord', () => {
  it('Ρ1 🔑 ανενεργός ⇒ ΚΑΜΙΑ ανάγνωση: ο κατάλογος έχει ήδη το ζωντανό ακίνητο', () => {
    const { result } = renderHook(() => useRetiredPropertyRecord('prop_1', false));

    expect(result.current.lookup).toEqual({ kind: 'idle' });
    expect(get).not.toHaveBeenCalled();
  });

  it('Ρ2: ενεργός ⇒ φορτώνει ΑΜΕΣΩΣ, και ρωτά την ΥΠΑΡΧΟΥΣΑ διαδρομή του ενός ακινήτου', async () => {
    get.mockResolvedValue(ARCHIVED);
    const { result } = renderHook(() => useRetiredPropertyRecord('prop_1', true));

    // Το πρώτο καρέ: καμία ετυμηγορία πριν απαντήσει ο διακομιστής.
    expect(result.current.lookup).toEqual({ kind: 'loading' });

    await waitFor(() => expect(result.current.lookup.kind).toBe('retired'));
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(API_ROUTES.PROPERTIES.BY_ID('prop_1'));
  });

  it.each([
    ['αρχείο', ARCHIVED],
    ['κάδος', TRASHED],
  ])('Ρ3: %s ⇒ η εγγραφή ταξιδεύει ΑΥΤΟΥΣΙΑ (οι σφραγίδες της ταινίας μένουν)', async (_place, doc) => {
    get.mockResolvedValue(doc);
    const { result } = renderHook(() => useRetiredPropertyRecord('prop_1', true));

    await waitFor(() => expect(result.current.lookup).toEqual({ kind: 'retired', property: doc }));
  });

  it('Ρ4 🔴 ζωντανό ακίνητο ΔΕΝ γίνεται δεκτό από αυτή την πόρτα', async () => {
    // Το ζωντανό ακίνητο έχει ΕΝΑΝ αναγνώστη: τον κατάλογο. Αν το δεχόταν και αυτός, η σελίδα θα
    // είχε δύο πηγές για την ίδια εγγραφή, και η μία δεν ενημερώνεται.
    get.mockResolvedValue(LIVE);
    const { result } = renderHook(() => useRetiredPropertyRecord('prop_1', true));

    await waitFor(() => expect(result.current.lookup).toEqual({ kind: 'absent' }));
  });

  it.each([403, 404])('Ρ5: άρνηση %s ⇒ «δεν βρέθηκε», χωρίς να ξεχωρίζει ξένο από ανύπαρκτο', async (status) => {
    get.mockRejectedValue(new ApiClientError('nope', status));
    const { result } = renderHook(() => useRetiredPropertyRecord('prop_1', true));

    await waitFor(() => expect(result.current.lookup).toEqual({ kind: 'absent' }));
  });

  it.each([
    ['5xx', new ApiClientError('boom', 500)],
    ['δίκτυο', new TypeError('Failed to fetch')],
  ])('Ρ6 🔴 αποτυχία (%s) ⇒ `failed`, ΟΧΙ «δεν βρέθηκε»', async (_why, error) => {
    get.mockRejectedValue(error);
    const { result } = renderHook(() => useRetiredPropertyRecord('prop_1', true));

    await waitFor(() => expect(result.current.lookup).toEqual({ kind: 'failed' }));
  });

  it('Ρ7: `retry` ξαναρωτά, και στο ενδιάμεσο φορτώνει', async () => {
    get.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useRetiredPropertyRecord('prop_1', true));
    await waitFor(() => expect(result.current.lookup).toEqual({ kind: 'failed' }));

    get.mockResolvedValue(ARCHIVED);
    act(() => result.current.retry());

    expect(result.current.lookup).toEqual({ kind: 'loading' });
    await waitFor(() => expect(result.current.lookup.kind).toBe('retired'));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('Ρ8 🔴 άλλο ακίνητο ⇒ η προηγούμενη απάντηση ΔΕΝ δείχνεται ούτε για ένα καρέ', async () => {
    get.mockResolvedValue(ARCHIVED);
    const { result, rerender } = renderHook(({ id }) => useRetiredPropertyRecord(id, true), {
      initialProps: { id: 'prop_1' },
    });
    await waitFor(() => expect(result.current.lookup.kind).toBe('retired'));

    get.mockReturnValue(new Promise(() => undefined));
    rerender({ id: 'prop_2' });

    expect(result.current.lookup).toEqual({ kind: 'loading' });
  });

  it('Ρ9: ξανά ενεργός μετά από παύση ⇒ ξαναρωτά, δεν σερβίρει το παλιό στιγμιότυπο', async () => {
    // Αποσύρθηκε → επανήλθε (ο κατάλογος το έχει, ο αναγνώστης σβήνει) → αποσύρθηκε ξανά.
    get.mockResolvedValue(ARCHIVED);
    const { result, rerender } = renderHook(({ on }) => useRetiredPropertyRecord('prop_1', on), {
      initialProps: { on: true },
    });
    await waitFor(() => expect(result.current.lookup.kind).toBe('retired'));

    rerender({ on: false });
    expect(result.current.lookup).toEqual({ kind: 'idle' });

    get.mockResolvedValue(TRASHED);
    rerender({ on: true });
    expect(result.current.lookup).toEqual({ kind: 'loading' });
    await waitFor(() => expect(result.current.lookup).toEqual({ kind: 'retired', property: TRASHED }));
  });
});
