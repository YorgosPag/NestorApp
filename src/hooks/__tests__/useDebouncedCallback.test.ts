/**
 * useDebouncedCallback — συμβόλαιο (ADR-217 Φ11 · `cancel()` 2026-09-11).
 *
 * Το `cancel()` προστέθηκε για το `SearchInput`: μια εξωτερική αλλαγή τιμής πρέπει να
 * ΑΚΥΡΩΝΕΙ την εκκρεμή (μπαγιάτικη) εκπομπή, αλλιώς την ξαναγράφει πάνω στη νέα.
 */

import { act, renderHook } from '@testing-library/react';

import { useDebouncedCallback } from '../useDebouncedCallback';

describe('useDebouncedCallback', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('Δ1: καλεί ΜΙΑ φορά, με τα ορίσματα της τελευταίας κλήσης', () => {
    const spy = jest.fn((_value: string) => undefined);
    const { result } = renderHook(() => useDebouncedCallback(spy, 300));

    act(() => { result.current('a'); result.current('ab'); });
    act(() => { jest.advanceTimersByTime(299); });
    expect(spy).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(1); });
    expect(spy.mock.calls).toEqual([['ab']]);
  });

  it('Δ2: `cancel()` ακυρώνει την εκκρεμή κλήση', () => {
    const spy = jest.fn((_value: string) => undefined);
    const { result } = renderHook(() => useDebouncedCallback(spy, 300));

    act(() => { result.current('a'); result.current.cancel(); });
    act(() => { jest.advanceTimersByTime(1000); });

    expect(spy).not.toHaveBeenCalled();
  });

  it('Δ3: το `cancel` είναι ΣΤΑΘΕΡΟ ανάμεσα σε αποδόσεις, ακόμη κι αν αλλάξει το callback', () => {
    const { result, rerender } = renderHook(
      ({ cb }: { cb: (value: string) => void }) => useDebouncedCallback(cb, 300),
      { initialProps: { cb: (_value: string) => undefined } },
    );
    const firstCancel = result.current.cancel;

    rerender({ cb: (_value: string) => undefined });

    expect(result.current.cancel).toBe(firstCancel);
  });

  it('Δ4: η αποπροσάρτηση ακυρώνει την εκκρεμή κλήση', () => {
    const spy = jest.fn((_value: string) => undefined);
    const { result, unmount } = renderHook(() => useDebouncedCallback(spy, 300));

    act(() => { result.current('a'); });
    unmount();
    act(() => { jest.advanceTimersByTime(1000); });

    expect(spy).not.toHaveBeenCalled();
  });
});
