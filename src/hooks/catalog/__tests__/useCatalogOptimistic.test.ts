import { act, renderHook, waitFor } from '@testing-library/react';

import { ApiClientError } from '@/lib/api/api-client-types';
import { fastForwardOwnWrites, useCatalogOptimistic, type CatalogOperation } from '../useCatalogOptimistic';

interface Row {
  readonly id: string;
  readonly revision: number;
  readonly isDeleted: boolean;
  readonly label: string;
}

const row = (id: string, revision: number, label: string): Row => ({ id, revision, isDeleted: false, label });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function setup(initial: readonly Row[]) {
  const onFailure = jest.fn();
  const hook = renderHook(({ records }) => useCatalogOptimistic(records, onFailure), { initialProps: { records: initial } });
  return { ...hook, onFailure };
}

describe('useCatalogOptimistic — αισιόδοξα, με CAS, χωρίς αγώνα', () => {
  it('η αλλαγή φαίνεται αμέσως και μένει ώσπου το στιγμιότυπο να τη φτάσει', async () => {
    const { result, rerender } = setup([row('a', 1, 'Ψύξη')]);
    const reply = deferred<Row>();
    act(() => result.current.submit({ key: 'a', optimistic: row('a', 1, 'Ψύξη νέα'), baseRevision: 1, send: () => reply.promise }));
    expect(result.current.view[0].label).toBe('Ψύξη νέα');
    await act(async () => reply.resolve(row('a', 2, 'Ψύξη νέα')));
    expect(result.current.view[0].label).toBe('Ψύξη νέα');
    rerender({ records: [row('a', 2, 'Ψύξη νέα')] });
    expect(result.current.view).toEqual([row('a', 2, 'Ψύξη νέα')]);
  });

  it('η δεύτερη πράξη στέλνει την αναθεώρηση της ΠΡΩΤΗΣ απάντησης — ποτέ 409 στον εαυτό του', async () => {
    const { result } = setup([row('a', 3, 'x')]);
    const sent: (number | null)[] = [];
    const op = (label: string, answer: number): CatalogOperation<Row> => ({
      key: 'a',
      optimistic: row('a', 3, label),
      baseRevision: 3,
      send: async (revision) => { sent.push(revision); return row('a', answer, label); },
    });
    act(() => { result.current.submit(op('b', 4)); result.current.submit(op('c', 5)); });
    await waitFor(() => expect(sent).toEqual([3, 4]));
  });

  it('αλλαγή ΑΛΛΟΥ που έφερε το στιγμιότυπο ΔΕΝ μετακινεί τη βάση του CAS ⇒ ο γραφέας απαντά 409 (μετρημένο ζωντανά, §5.9.2)', async () => {
    const { result, rerender } = setup([row('a', 1, 'Ψύξη')]);
    rerender({ records: [row('a', 2, 'άλλος')] });
    const sent: (number | null)[] = [];
    act(() => result.current.submit({
      key: 'a',
      optimistic: row('a', 2, 'δικό μου'),
      baseRevision: 1,
      send: async (revision) => { sent.push(revision); return row('a', 3, 'δικό μου'); },
    }));
    await waitFor(() => expect(sent).toEqual([1]));
  });

  it('η αλυσίδα των δικών μας εγγραφών προωθεί μόνο ό,τι γράψαμε ΕΜΕΙΣ', () => {
    const chain = new Map([[3, 4], [4, 5]]);
    expect(fastForwardOwnWrites(chain, 3)).toBe(5);
    expect(fastForwardOwnWrites(chain, 7)).toBe(7);
    expect(fastForwardOwnWrites(undefined, 2)).toBe(2);
    expect(fastForwardOwnWrites(chain, null)).toBeNull();
  });

  it('αποτυχία ⇒ επαναφορά στο στιγμιότυπο + ειδοποίηση + αποτέλεσμα στον καλούντα', async () => {
    const { result, onFailure } = setup([row('a', 1, 'Ψύξη')]);
    const settled = jest.fn();
    const conflict = new ApiClientError('x', 409, undefined, undefined, undefined, undefined, {
      errorCode: 'catalog.revisionMismatch',
      currentRevision: 2,
    });
    act(() => result.current.submit({
      key: 'a',
      optimistic: row('a', 1, 'δικό μου'),
      baseRevision: 1,
      send: () => Promise.reject(conflict),
      onSettled: settled,
    }));
    await waitFor(() => expect(result.current.view[0].label).toBe('Ψύξη'));
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({ kind: 'revisionMismatch', currentRevision: 2 }));
    expect(settled).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it('διαγραφή: εξαφανίζεται αμέσως και δεν ξαναεμφανίζεται πριν φύγει από το στιγμιότυπο', async () => {
    const { result, rerender } = setup([row('a', 1, 'x'), row('b', 1, 'y')]);
    act(() => result.current.submit({ key: 'a', optimistic: null, baseRevision: 1, send: async () => ({ ...row('a', 2, 'x'), isDeleted: true }) }));
    expect(result.current.view.map((item) => item.id)).toEqual(['b']);
    await waitFor(() => expect(result.current.pendingKeys.size).toBe(0));
    expect(result.current.view.map((item) => item.id)).toEqual(['b']);
    rerender({ records: [row('b', 1, 'y')] });
    expect(result.current.view.map((item) => item.id)).toEqual(['b']);
  });
});

describe('ADR-923 §5.10.5 — κανένας βρόχος όσο η απάντηση προηγείται του στιγμιοτύπου', () => {
  it('🔴 records ΝΕΟΣ πίνακας σε κάθε render (όπως `[input.root]`) + απάντηση μπροστά από το ζωντανό ⇒ τα renders ΣΤΑΜΑΤΟΥΝ', async () => {
    const live = row('a', 1, 'Ψύξη');
    let renders = 0;
    const onFailure = jest.fn();
    const { result } = renderHook(() => { renders += 1; return useCatalogOptimistic([live], onFailure); });
    await act(async () => {
      result.current.submit({ key: 'a', optimistic: row('a', 1, 'Ψύξη νέα'), baseRevision: 1, send: async () => row('a', 2, 'Ψύξη νέα') });
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const settled = renders;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(renders).toBe(settled);
    expect(renders).toBeLessThan(20);
    expect(result.current.view[0].label).toBe('Ψύξη νέα');
  });
});
