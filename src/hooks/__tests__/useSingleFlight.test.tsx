/**
 * @file ADR-598 «(θ)» — ο ΕΝΑΣ πυρήνας «μία εκτέλεση τη φορά» και οι τρεις όψεις του.
 *
 * - Π1: δύο κλήσεις στο ίδιο tick ⇒ ΜΙΑ εκτέλεση· η δεύτερη επιστρέφει `ran:false`.
 * - Π2: αποτυχία ⇒ ο φραγμός ανοίγει ΚΑΙ το σφάλμα ξαναπετιέται (όχι σιωπηλή κατάποση).
 * - Π3: `holdOnSuccess` ⇒ μετά την επιτυχία ο φραγμός ΜΕΝΕΙ (πλοήγηση).
 * - Π4: ολοκλήρωση μετά το unmount ⇒ καμία ενημέρωση κατάστασης, καμία προειδοποίηση.
 * - Ε1/Ε2: `useEntrySubmit` (όψη chart-card) — διπλό κλικ ⇒ μία εγγραφή · `isValid` · `onError`.
 */

import { act, renderHook } from '@testing-library/react';

import { useEntrySubmit } from '@/components/ui/chart-card/editor/use-entry-submit';
import { useSingleFlight } from '../useSingleFlight';

function deferred<T = void>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: Error) => void } {
  let resolve: (v: T) => void = () => undefined;
  let reject: (e: Error) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useSingleFlight', () => {
  it('Π1: δύο κλήσεις στο ίδιο tick ⇒ ΜΙΑ εκτέλεση', async () => {
    const gate = deferred<number>();
    const task = jest.fn(() => gate.promise);
    const { result } = renderHook(() => useSingleFlight());

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.run(task);
      second = result.current.run(task);
    });
    expect(result.current.pending).toBe(true);
    await expect(second).resolves.toEqual({ ran: false });

    await act(async () => {
      gate.resolve(7);
      await first;
    });
    await expect(first).resolves.toEqual({ ran: true, value: 7 });
    expect(task).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(false);
  });

  it('Π2: αποτυχία ⇒ ο φραγμός ανοίγει και το σφάλμα φτάνει στον καλούντα', async () => {
    const { result } = renderHook(() => useSingleFlight());
    await act(async () => {
      await expect(result.current.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    });
    expect(result.current.pending).toBe(false);

    const again = jest.fn(async () => 1);
    await act(async () => {
      await result.current.run(again);
    });
    expect(again).toHaveBeenCalledTimes(1);
  });

  it('Π3: holdOnSuccess ⇒ μετά την επιτυχία ο φραγμός ΜΕΝΕΙ', async () => {
    const task = jest.fn(async () => 'ok');
    const { result } = renderHook(() => useSingleFlight());
    await act(async () => {
      await result.current.run(task, { holdOnSuccess: true });
    });
    await act(async () => {
      await expect(result.current.run(task)).resolves.toEqual({ ran: false });
    });
    expect(task).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);
  });

  it('Π4: ολοκλήρωση μετά το unmount ⇒ καμία προειδοποίηση React', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const gate = deferred();
    const { result, unmount } = renderHook(() => useSingleFlight());
    let running: Promise<unknown> = Promise.resolve();
    act(() => {
      running = result.current.run(() => gate.promise);
    });
    unmount();
    await act(async () => {
      gate.resolve();
      await running;
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('useEntrySubmit (όψη του πυρήνα)', () => {
  it('Ε1: διπλό κλικ ⇒ ΜΙΑ εγγραφή· onSubmitted μετά την επιτυχία· isValid φράζει', async () => {
    const gate = deferred();
    const onSubmit = jest.fn(() => gate.promise);
    const onSubmitted = jest.fn();
    const { result } = renderHook(() =>
      useEntrySubmit<number>({ onSubmit, onSubmitted, isValid: (v) => v > 0 }),
    );

    await act(() => result.current.submit(0));
    expect(onSubmit).not.toHaveBeenCalled();

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.submit(5);
      void result.current.submit(5);
    });
    expect(result.current.submitting).toBe(true);
    await act(async () => {
      gate.resolve();
      await first;
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(result.current.submitting).toBe(false);
  });

  it('Ε2: απόρριψη ⇒ onError, αλλιώς ξαναπετιέται· το κουμπί ξεκλειδώνει', async () => {
    const onError = jest.fn();
    const failing = () => Promise.reject(new Error('nope'));
    const handled = renderHook(() => useEntrySubmit<number>({ onSubmit: failing, onError }));
    await act(() => handled.result.current.submit(1));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'nope' }));
    expect(handled.result.current.submitting).toBe(false);

    const bare = renderHook(() => useEntrySubmit<number>({ onSubmit: failing }));
    await act(async () => {
      await expect(bare.result.current.submit(1)).rejects.toThrow('nope');
    });
  });
});
