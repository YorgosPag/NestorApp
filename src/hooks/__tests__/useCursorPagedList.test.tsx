/**
 * `useCursorPagedList` — λίστα με δρομέα στον πελάτη (ADR-ACC-010 §2.1.1 Φάση 3β).
 *
 * Υποσχέσεις: πρώτη σελίδα + «περισσότερα» χωρίς διπλά· σφάλμα = ρητό σφάλμα, ΠΟΤΕ «κενή λίστα» σιωπηλά· απάντηση
 * παλιών φίλτρων (ο χρήστης άλλαξε φίλτρο ενώ φόρτωνε) ΔΕΝ γράφει πάνω στη νέα λίστα· διπλό κλικ στο «περισσότερα»
 * φέρνει τη σελίδα ΜΙΑ φορά.
 */

import { renderHook, act, waitFor } from '@testing-library/react';

import { ApiClientError } from '@/lib/api/api-client-types';
import type { PaginatedResult } from '@/lib/pagination';

import { useCursorPagedList } from '../useCursorPagedList';

const mockGet = jest.fn<Promise<PaginatedResult<string>>, [string]>();
jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { get: (url: string) => mockGet(url) } }));

const page = (items: string[], nextCursor: string | null): PaginatedResult<string> =>
  ({ items, hasNext: nextCursor !== null, nextCursor, pageSize: items.length });

/** Υπόσχεση που λύνεται όταν το πει το test — για να ελέγξουμε τη σειρά απαντήσεων. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function render(params: Record<string, string | undefined>) {
  return renderHook(
    (props: { params: Record<string, string | undefined> }) =>
      useCursorPagedList<string>({ url: '/api/x', params: props.params, enabled: true }),
    { initialProps: { params } },
  );
}

beforeEach(() => mockGet.mockReset());

describe('useCursorPagedList', () => {
  it('Π-1 πρώτη σελίδα, «περισσότερα» προσθέτει, τέλος ⇒ hasMore=false', async () => {
    mockGet.mockResolvedValueOnce(page(['a', 'b'], 'c1')).mockResolvedValueOnce(page(['c'], null));
    const { result } = render({ year: '2026' });
    await waitFor(() => expect(result.current.items).toEqual(['a', 'b']));
    expect(result.current.hasMore).toBe(true);
    expect(mockGet).toHaveBeenLastCalledWith('/api/x?year=2026');

    await act(() => result.current.loadMore());
    expect(mockGet).toHaveBeenLastCalledWith('/api/x?year=2026&cursor=c1');
    expect(result.current.items).toEqual(['a', 'b', 'c']);
    expect(result.current.hasMore).toBe(false);
  });

  it('Π-2 σφάλμα πρώτης σελίδας ⇒ ρητό σφάλμα με κωδικό, όχι σιωπηλά κενό', async () => {
    mockGet.mockRejectedValueOnce(new ApiClientError('bad', 400, 'UNSUPPORTED_LIST_FILTER'));
    const { result } = render({});
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toEqual({ status: 400, code: 'UNSUPPORTED_LIST_FILTER' });
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('Π-3 απάντηση ΠΑΛΙΩΝ φίλτρων δεν γράφει πάνω στη νέα λίστα', async () => {
    const slow = deferred<PaginatedResult<string>>();
    mockGet.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(page(['new'], null));
    const { result, rerender } = render({ type: 'income' });
    rerender({ params: { type: 'expense' } });
    await waitFor(() => expect(result.current.items).toEqual(['new']));

    await act(async () => { slow.resolve(page(['stale'], 'c9')); await slow.promise; });
    expect(result.current.items).toEqual(['new']);
    expect(result.current.hasMore).toBe(false);
  });

  it('Π-4 διπλό «περισσότερα» ⇒ η σελίδα ζητείται ΜΙΑ φορά', async () => {
    const next = deferred<PaginatedResult<string>>();
    mockGet.mockResolvedValueOnce(page(['a'], 'c1')).mockReturnValueOnce(next.promise);
    const { result } = render({});
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    let first!: Promise<void>;
    act(() => { first = result.current.loadMore(); void result.current.loadMore(); });
    await act(async () => { next.resolve(page(['b'], null)); await first; });
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(result.current.items).toEqual(['a', 'b']);
  });

  it('Π-5 ίδια φίλτρα σε νέο αντικείμενο ⇒ ΚΑΜΙΑ νέα ανάγνωση (όχι βρόχος ανά render)', async () => {
    mockGet.mockResolvedValue(page(['a'], null));
    const { result, rerender } = render({ year: '2026' });
    await waitFor(() => expect(result.current.items).toEqual(['a']));
    rerender({ params: { year: '2026' } });
    rerender({ params: { year: '2026' } });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
