import { act, renderHook, waitFor } from '@testing-library/react';

import { ApiClientError } from '@/lib/api/api-client-types';
import { useCatalogOptimistic, type CatalogOperation } from '../useCatalogOptimistic';

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
    act(() => result.current.submit({ key: 'a', optimistic: row('a', 1, 'Ψύξη νέα'), send: () => reply.promise }));
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
      send: async (revision) => { sent.push(revision); return row('a', answer, label); },
    });
    act(() => { result.current.submit(op('b', 4)); result.current.submit(op('c', 5)); });
    await waitFor(() => expect(sent).toEqual([3, 4]));
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
      send: () => Promise.reject(conflict),
      onSettled: settled,
    }));
    await waitFor(() => expect(result.current.view[0].label).toBe('Ψύξη'));
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({ kind: 'revisionMismatch', currentRevision: 2 }));
    expect(settled).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it('διαγραφή: εξαφανίζεται αμέσως και δεν ξαναεμφανίζεται πριν φύγει από το στιγμιότυπο', async () => {
    const { result, rerender } = setup([row('a', 1, 'x'), row('b', 1, 'y')]);
    act(() => result.current.submit({ key: 'a', optimistic: null, send: async () => ({ ...row('a', 2, 'x'), isDeleted: true }) }));
    expect(result.current.view.map((item) => item.id)).toEqual(['b']);
    await waitFor(() => expect(result.current.pendingKeys.size).toBe(0));
    expect(result.current.view.map((item) => item.id)).toEqual(['b']);
    rerender({ records: [row('b', 1, 'y')] });
    expect(result.current.view.map((item) => item.id)).toEqual(['b']);
  });
});
