/**
 * ADR-923 §5.10.4 Β5 — ο βρόχος επανυπολογισμού με **γενιές** (σφάλμα που βρέθηκε ζωντανά 2026-10-26: μετά από
 * «Ολοκληρώθηκε», δεύτερη αλλαγή γλωσσών δεν ξαναπρότεινε επανυπολογισμό).
 */
import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';

import { useCatalogRecompute } from '../useCatalogRecompute';

const recompute = jest.fn();
jest.mock('@/services/catalog/catalog-api.client', () => ({
  recomputeCatalogDerived: (...args: unknown[]) => recompute(...args),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => recompute.mockReset());

describe('useCatalogRecompute', () => {
  it('βρόχος ως nextCursor === null, αθροίζει σελίδες, στέλνει τον δρομέα και την οικογένεια', async () => {
    recompute
      .mockResolvedValueOnce({ processed: 25, rejected: 1, nextCursor: 'm:abc' })
      .mockResolvedValueOnce({ processed: 3, rejected: 0, nextCursor: null });
    const { result } = renderHook(() => useCatalogRecompute());
    act(() => result.current.invalidate());
    expect(result.current.needed).toBe(true);
    await act(() => result.current.run('fam_1'));
    expect(recompute.mock.calls).toEqual([[{ familyId: 'fam_1', cursor: null }], [{ familyId: 'fam_1', cursor: 'm:abc' }]]);
    expect(result.current.state).toEqual({ kind: 'done', processed: 28, rejected: 1 });
    expect(result.current.needed).toBe(false);
  });

  it('🔴 νέα αλλαγή ΜΕΤΑ από ολοκλήρωση ⇒ ξανά «χρειάζεται»', async () => {
    recompute.mockResolvedValue({ processed: 0, rejected: 0, nextCursor: null });
    const { result } = renderHook(() => useCatalogRecompute());
    act(() => result.current.invalidate());
    await act(() => result.current.run(null));
    expect(result.current.needed).toBe(false);
    act(() => result.current.invalidate());
    expect(result.current.needed).toBe(true);
  });

  it('🔴 αλλαγή ΕΝΩ ΤΡΕΧΕΙ ⇒ η εκτέλεση δεν την καλύπτει: μετά το τέλος ακόμη «χρειάζεται»', async () => {
    const page = deferred<{ processed: number; rejected: number; nextCursor: string | null }>();
    recompute.mockReturnValueOnce(page.promise);
    const { result } = renderHook(() => useCatalogRecompute());
    act(() => result.current.invalidate());
    let running!: Promise<void>;
    act(() => { running = result.current.run(null); });
    act(() => result.current.invalidate());
    await act(async () => { page.resolve({ processed: 5, rejected: 0, nextCursor: null }); await running; });
    expect(result.current.state.kind).toBe('done');
    expect(result.current.needed).toBe(true);
  });

  it('αποτυχία ⇒ «failed» με ό,τι πρόλαβε · δεύτερη κλήση όσο τρέχει αγνοείται', async () => {
    const first = deferred<{ processed: number; rejected: number; nextCursor: string | null }>();
    recompute.mockReturnValueOnce(first.promise).mockRejectedValueOnce(new Error('503'));
    const { result } = renderHook(() => useCatalogRecompute());
    act(() => result.current.invalidate());
    let running!: Promise<void>;
    act(() => { running = result.current.run(null); });
    await act(() => result.current.run(null));
    expect(recompute).toHaveBeenCalledTimes(1);
    await act(async () => { first.resolve({ processed: 25, rejected: 0, nextCursor: 'p:x' }); await running; });
    expect(result.current.state).toEqual({ kind: 'failed', processed: 25 });
    expect(result.current.needed).toBe(true);
  });
});

describe('ADR-923 §5.10.5 — ζωντανό: «Επανυπολογισμός… 0 σύνολα» για πάντα', () => {
  it('🔴 effects που ξανατρέχουν (StrictMode · Fast Refresh · Activity) ⇒ ο βρόχος ΟΛΟΚΛΗΡΩΝΕΤΑΙ, δεν μένει σε «running»', async () => {
    recompute
      .mockResolvedValueOnce({ processed: 1, rejected: 0, nextCursor: 'p:' })
      .mockResolvedValueOnce({ processed: 1, rejected: 0, nextCursor: null });
    const { result } = renderHook(() => useCatalogRecompute(), { wrapper: StrictMode });
    await act(() => result.current.run(null));
    expect(recompute).toHaveBeenCalledTimes(2);
    expect(result.current.state).toEqual({ kind: 'done', processed: 2, rejected: 0 });
  });
});
