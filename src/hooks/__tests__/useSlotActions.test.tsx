/**
 * Θ — **Η ΜΙΑ μηχανή θέσεων** (`useSlotActions`, ADR-916 Φ-Ε1 · ADR-901 Φ2).
 *
 * Δύο όψεις στέκονται πάνω της: οι επαγγελματίες της υπόθεσης (`useCaseProfessionals`) και η πρόσβαση στον
 * φάκελο του ιδιώτη (`useDossierAccess`). Κάθε υπόσχεση του module κλειδώνεται εδώ **μία** φορά, ώστε καμία από
 * τις δύο να μη χρειάζεται δικό της αντίγραφο:
 * - Θ1–Θ3 ανάγνωση (πρώτη · αποτυχία · αλλαγή πηγής ⇒ spinner, ξαναδιάβασμα ⇒ παρασκήνιο)
 * - Θ4–Θ5 πράξη (η όψη = `apply(προηγούμενη, απάντηση)` · το σφάλμα επιστρέφει **ωμό**, η όψη μένει)
 * - Θ6–Θ7 ανά κλειδί «σε εξέλιξη» (δεύτερο κλικ ⇒ κανένα αίτημα · άλλο κλειδί δεν μπλοκάρεται)
 * - Θ8 καμία μπαγιάτικη ανάγνωση πάνω σε πράξη (`epoch`)
 */

/* global describe, it, expect, jest */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useSlotActions, type SlotActOutcome } from '../useSlotActions';

type View = readonly string[];
type Key = 'a' | 'b';

/** Υπόσχεση που κρατιέται ανοιχτή ώσπου να την αφήσουμε — έτσι το «όσο τρέχει» είναι μετρήσιμο. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (e: Error) => void } {
  let resolve: (value: T) => void = () => undefined;
  let reject: (e: Error) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const append = (previous: View | null, item: string): View => [...(previous ?? []), item];

function renderSlots(load: () => Promise<View>, sourceKey = 'src-1', reloadKey = 0) {
  return renderHook(
    ({ s, r }: { s: string; r: number }) => useSlotActions<View, Key>(load, s, r),
    { initialProps: { s: sourceKey, r: reloadKey } },
  );
}

describe('Θ — ανάγνωση', () => {
  it('Θ1 — πρώτη ανάγνωση: spinner ⇒ όψη', async () => {
    const { result } = renderSlots(() => Promise.resolve(['x']));
    expect(result.current.loading).toBe(true);
    expect(result.current.view).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.view).toEqual(['x']);
    expect(result.current.failed).toBe(false);
  });

  it('Θ2 — αποτυχία ανάγνωσης: failed, όψη null, χωρίς spinner', async () => {
    const { result } = renderSlots(() => Promise.reject(new Error('boom')));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.failed).toBe(true);
    expect(result.current.view).toBeNull();
  });

  it('Θ3 — ξαναδιάβασμα (reloadKey) στο παρασκήνιο· αλλαγή πηγής (sourceKey) με spinner', async () => {
    const next = deferred<View>();
    const load = jest.fn<Promise<View>, []>().mockResolvedValueOnce(['v1']).mockReturnValueOnce(next.promise);
    const { result, rerender } = renderSlots(load);
    await waitFor(() => expect(result.current.view).toEqual(['v1']));

    rerender({ s: 'src-1', r: 1 });
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
    await act(async () => { next.resolve(['v2']); await next.promise; });
    expect(result.current.view).toEqual(['v2']);

    load.mockReturnValueOnce(deferred<View>().promise);
    rerender({ s: 'src-2', r: 1 });
    expect(result.current.loading).toBe(true);
    expect(load).toHaveBeenCalledTimes(3);
  });
});

describe('Θ — πράξη', () => {
  it('Θ4 — επιτυχία: η όψη γίνεται apply(προηγούμενη, απάντηση) και η έκβαση φέρει την απάντηση', async () => {
    const { result } = renderSlots(() => Promise.resolve(['x']));
    await waitFor(() => expect(result.current.view).toEqual(['x']));

    let outcome: SlotActOutcome<string> | undefined;
    await act(async () => { outcome = await result.current.act('a', () => Promise.resolve('y'), append); });
    expect(outcome).toEqual({ ok: true, result: 'y' });
    expect(result.current.view).toEqual(['x', 'y']);
    expect(result.current.pending.size).toBe(0);
  });

  it('Θ5 — αποτυχία: το σφάλμα επιστρέφει ωμό, η όψη μένει, το κλειδί ελευθερώνεται', async () => {
    const { result } = renderSlots(() => Promise.resolve(['x']));
    await waitFor(() => expect(result.current.view).toEqual(['x']));

    const error = new Error('DENIED');
    let outcome: SlotActOutcome<string> | undefined;
    await act(async () => { outcome = await result.current.act('a', () => Promise.reject(error), append); });
    expect(outcome).toEqual({ ok: false, error });
    expect(result.current.view).toEqual(['x']);
    expect(result.current.pending.size).toBe(0);
  });
});

describe('Θ — ανά κλειδί «σε εξέλιξη»', () => {
  it('Θ6 — δεύτερο κλικ στο ίδιο κλειδί όσο τρέχει: κανένα αίτημα, έκβαση { ok, result: null }', async () => {
    const { result } = renderSlots(() => Promise.resolve([]));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const gate = deferred<string>();
    const request = jest.fn(() => gate.promise);
    let first: Promise<SlotActOutcome<string>> = Promise.resolve({ ok: true, result: null });
    act(() => { first = result.current.act('a', request, append); });
    expect(result.current.pending.has('a')).toBe(true);

    let second: SlotActOutcome<string> | undefined;
    await act(async () => { second = await result.current.act('a', request, append); });
    expect(second).toEqual({ ok: true, result: null });
    expect(request).toHaveBeenCalledTimes(1);

    await act(async () => { gate.resolve('y'); await first; });
    expect(result.current.pending.has('a')).toBe(false);
    expect(result.current.view).toEqual(['y']);
  });

  it('Θ7 — άλλο κλειδί δεν μπλοκάρεται από πράξη σε εξέλιξη', async () => {
    const { result } = renderSlots(() => Promise.resolve([]));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const gate = deferred<string>();
    let first: Promise<SlotActOutcome<string>> = Promise.resolve({ ok: true, result: null });
    act(() => { first = result.current.act('a', () => gate.promise, append); });

    let other: SlotActOutcome<string> | undefined;
    await act(async () => { other = await result.current.act('b', () => Promise.resolve('b1'), append); });
    expect(other).toEqual({ ok: true, result: 'b1' });
    expect(result.current.pending.has('a')).toBe(true);
    expect(result.current.pending.has('b')).toBe(false);

    await act(async () => { gate.resolve('a1'); await first; });
    expect(result.current.view).toEqual(['b1', 'a1']);
    expect(result.current.pending.size).toBe(0);
  });
});

describe('Θ — καμία μπαγιάτικη ανάγνωση πάνω σε πράξη', () => {
  it('Θ8 — ανάγνωση που ξεκίνησε ΠΡΙΝ από απάντηση πράξης δεν πατά την όψη της πράξης', async () => {
    const stale = deferred<View>();
    const load = jest.fn<Promise<View>, []>().mockResolvedValueOnce(['v1']).mockReturnValueOnce(stale.promise);
    const { result, rerender } = renderSlots(load);
    await waitFor(() => expect(result.current.view).toEqual(['v1']));

    rerender({ s: 'src-1', r: 1 });
    await act(async () => { await result.current.act('a', () => Promise.resolve('y'), append); });
    expect(result.current.view).toEqual(['v1', 'y']);

    await act(async () => { stale.resolve(['v1']); await stale.promise; });
    expect(result.current.view).toEqual(['v1', 'y']);
  });
});
