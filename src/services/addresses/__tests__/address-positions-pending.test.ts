/**
 * ΑΓΚΥΡΑ — **η μνήμη των εκκρεμών θέσεων**, μία για κάθε οντότητα με διευθύνσεις (ADR-332 D29).
 *
 * Τρεις ιδιότητες που κάνουν την ένδειξη ειλικρινή:
 * - η νέα αποθήκευση **αντικαθιστά** την παλιά λίστα (και κενή τη σβήνει)·
 * - ό,τι γράφτηκε φεύγει **ονομαστικά** — οι υπόλοιπες μένουν·
 * - το «εντοπίζεται» μπορεί να γίνει «αναβλήθηκε», ποτέ το αντίστροφο χωρίς νέα αποθήκευση.
 */

/* global describe, it, expect, beforeEach */

import { renderHook, act } from '@testing-library/react';
import {
  deferAddressPositionsPending,
  publishAddressPositionsPending,
  resetAddressPositionsPendingForTests,
  settleAddressPositionsPending,
  useAddressPositionsPending,
} from '../address-positions-pending';

beforeEach(() => {
  resetAddressPositionsPendingForTests();
});

describe('μνήμη εκκρεμών θέσεων', () => {
  it('Ε1 — ό,τι δημοσιεύεται για μια οντότητα το βλέπει ΜΟΝΟ εκείνη', () => {
    const project = renderHook(() => useAddressPositionsPending('proj_1'));
    const building = renderHook(() => useAddressPositionsPending('bldg_1'));

    act(() => publishAddressPositionsPending('proj_1', ['addr_1'], 'locating'));

    expect(project.result.current).toEqual({ ids: ['addr_1'], phase: 'locating' });
    expect(building.result.current.ids).toEqual([]);
  });

  it('Ε2 — η επόμενη αποθήκευση ΑΝΤΙΚΑΘΙΣΤΑ· κενή λίστα σβήνει την ένδειξη', () => {
    const { result } = renderHook(() => useAddressPositionsPending('proj_1'));

    act(() => publishAddressPositionsPending('proj_1', ['addr_1', 'addr_2'], 'locating'));
    act(() => publishAddressPositionsPending('proj_1', [], 'locating'));

    expect(result.current.ids).toEqual([]);
  });

  it('Ε3 — ό,τι γράφτηκε φεύγει ονομαστικά, οι υπόλοιπες μένουν στην ίδια φάση', () => {
    const { result } = renderHook(() => useAddressPositionsPending('proj_1'));

    act(() => publishAddressPositionsPending('proj_1', ['addr_1', 'addr_2'], 'locating'));
    act(() => settleAddressPositionsPending('proj_1', ['addr_1']));

    expect(result.current).toEqual({ ids: ['addr_2'], phase: 'locating' });
  });

  it('Ε4 — το παράθυρο έκλεισε ⇒ «αναβλήθηκε», με τις ίδιες διευθύνσεις', () => {
    const { result } = renderHook(() => useAddressPositionsPending('proj_1'));

    act(() => publishAddressPositionsPending('proj_1', ['addr_1'], 'locating'));
    act(() => deferAddressPositionsPending('proj_1'));

    expect(result.current).toEqual({ ids: ['addr_1'], phase: 'deferred' });
  });

  it('Ε5 — χωρίς εκκρεμότητα η αναφορά είναι ΣΤΑΘΕΡΗ (αλλιώς βρόχος απόδοσης)', () => {
    const { result, rerender } = renderHook(() => useAddressPositionsPending('proj_1'));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it('Ε6 — οντότητα χωρίς ταυτότητα (πρόχειρο) δεν έχει ποτέ εκκρεμότητα', () => {
    act(() => publishAddressPositionsPending('proj_1', ['addr_1'], 'locating'));

    const { result } = renderHook(() => useAddressPositionsPending(undefined));

    expect(result.current.ids).toEqual([]);
  });
});
