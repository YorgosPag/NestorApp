/**
 * @fileoverview Η σύγκριση προσφορών κάτω από ΕΠΙΚΑΛΥΠΤΟΜΕΝΕΣ ανανεώσεις (ADR-327).
 *
 * Σ1 παλιά απάντηση που φτάνει ΜΕΤΑ από νεότερη ⇒ αγνοείται (ποτέ παλιά σύγκριση πάνω από νεότερη) ·
 * Σ2 `loading` μένει `true` όσο η ΤΕΛΕΥΤΑΙΑ αίτηση είναι σε πτήση (όχι `false` από την πρώτη που τελείωσε) ·
 * Σ3 σφάλμα παλιάς αίτησης ⇒ δεν σβήνει/χαλά την τρέχουσα κατάσταση.
 *
 * ⚠️ Μετάλλαξη που ΠΡΕΠΕΙ να κοκκινίζει: αφαίρεση του `if (!isLatest()) return;` ⇒ Σ1.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useComparison } from '../useComparison';

jest.mock('@/services/firestore/firestore-query.service', () => ({
  firestoreQueryService: { subscribe: () => () => undefined },
}));

interface Deferred {
  resolve: (body: unknown) => void;
  reject: (status: number) => void;
}

const pending: Deferred[] = [];

function payload(tag: string) {
  return { data: { comparison: { rfqId: 'rfq_1', templateId: tag }, cherryPick: null } };
}

beforeEach(() => {
  pending.length = 0;
  global.fetch = jest.fn(
    () =>
      new Promise((resolve) => {
        pending.push({
          resolve: (body) => resolve({ ok: true, status: 200, json: async () => body } as Response),
          reject: (status) => resolve({ ok: false, status, json: async () => ({}) } as Response),
        });
      }),
  ) as jest.Mock;
});

async function settle(index: number, body: unknown) {
  await act(async () => {
    pending[index].resolve(body);
  });
}

describe('useComparison — επικαλυπτόμενες ανανεώσεις', () => {
  it('Σ1+Σ2: η παλιά απάντηση που φτάνει ΤΕΛΕΥΤΑΙΑ αγνοείται· loading κλείνει μόνο με τη νεότερη', async () => {
    const { result } = renderHook(() => useComparison('rfq_1'));
    expect(pending).toHaveLength(1); // αρχική φόρτωση (Α)

    act(() => {
      void result.current.refetch(); // χειροκίνητη μετά από ενέργεια (Β)
    });
    expect(pending).toHaveLength(2);

    await settle(0, payload('A-old')); // η ΠΑΛΙΑ τελειώνει πρώτη
    expect(result.current.comparison).toBeNull();
    expect(result.current.loading).toBe(true);

    await settle(1, payload('B-new'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.comparison?.templateId).toBe('B-new');
  });

  it('Σ1: νεότερη πρώτη, παλιά μετά ⇒ μένει η νεότερη', async () => {
    const { result } = renderHook(() => useComparison('rfq_1'));
    act(() => {
      void result.current.refetch();
    });

    await settle(1, payload('B-new'));
    expect(result.current.comparison?.templateId).toBe('B-new');
    expect(result.current.loading).toBe(false);

    await settle(0, payload('A-old'));
    expect(result.current.comparison?.templateId).toBe('B-new');
  });

  it('Σ3: σφάλμα ΠΑΛΙΑΣ αίτησης δεν γράφει error πάνω από επιτυχή νεότερη', async () => {
    const { result } = renderHook(() => useComparison('rfq_1'));
    act(() => {
      void result.current.refetch();
    });

    await settle(1, payload('B-new'));
    await act(async () => {
      pending[0].reject(500);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.comparison?.templateId).toBe('B-new');
  });
});
