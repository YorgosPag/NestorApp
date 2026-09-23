/**
 * ADR-777 §8.74 — η καρδιά: αισιόδοξα, χωρίς αγώνα, με επαναφορά στην ΕΠΙΒΕΒΑΙΩΜΕΝΗ κατάσταση, και πρόθεση
 * του ανώνυμου που επιβιώνει της σύνδεσης — μία φορά.
 */

import { act, renderHook, waitFor } from '@testing-library/react';

const mockGet = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

let mockAuth: { user: { uid: string } | null; loading: boolean } | null = { user: { uid: 'uid-1' }, loading: false };
jest.mock('@/auth/contexts/AuthContext', () => ({ useAuthOptional: () => mockAuth }));

const mockPush = jest.fn();
jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/search/results',
}));

let mockSearch = new URLSearchParams();
const mockReplaceParams = jest.fn((mutate: (params: URLSearchParams) => void) => mutate(mockSearch));
jest.mock('@/lib/url-query-state', () => ({
  currentSearchParams: () => new URLSearchParams(mockSearch.toString()),
  replaceUrlSearchParams: (mutate: (params: URLSearchParams) => void) => mockReplaceParams(mutate),
}));

import { ApiClientError } from '@/lib/api/api-client-types';

import { useSavedListingsState } from '../useSavedListingsState';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function ready(rows: Array<{ listingId: string }> = []) {
  mockGet.mockResolvedValue({ rows: rows.map((row) => ({ kind: 'withdrawn', savedAt: '2026-10-01T00:00:00Z', ...row })), truncated: false });
  const hook = renderHook(() => useSavedListingsState());
  await waitFor(() => expect(hook.result.current.status).toBe('ready'));
  return hook;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { user: { uid: 'uid-1' }, loading: false };
  mockSearch = new URLSearchParams();
  mockPut.mockResolvedValue({ saved: true });
  mockDelete.mockResolvedValue({ saved: false });
});

describe('Κ1 — ΕΝΑ fetch, και η καρδιά αλλάζει αμέσως', () => {
  it('φορτώνει μία φορά · το κλικ γεμίζει την καρδιά ΠΡΙΝ απαντήσει ο διακομιστής', async () => {
    const { result } = await ready();
    const pending = deferred<{ saved: boolean }>();
    mockPut.mockReturnValue(pending.promise);

    act(() => result.current.toggle('l1'));
    expect(result.current.savedIds.has('l1')).toBe(true);
    expect(mockGet).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve({ saved: true }));
    expect(result.current.savedIds.has('l1')).toBe(true);
  });
});

describe('Κ2 — χωρίς αγώνα: γρήγορα κλικ ⇒ ο διακομιστής καταλήγει στην ΤΕΛΕΥΤΑΙΑ επιθυμία', () => {
  it('κράτα → άφησε ενώ το PUT πετά ⇒ PUT, μετά DELETE, ποτέ ταυτόχρονα', async () => {
    const { result } = await ready();
    const pending = deferred<{ saved: boolean }>();
    mockPut.mockReturnValue(pending.promise);

    act(() => result.current.toggle('l1'));
    act(() => result.current.toggle('l1'));
    expect(mockDelete).not.toHaveBeenCalled();

    await act(async () => pending.resolve({ saved: true }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1));
    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(result.current.savedIds.has('l1')).toBe(false);
  });
});

describe('Κ3 — αποτυχία ⇒ επαναφορά στην επιβεβαιωμένη κατάσταση + ονομασμένη είδηση', () => {
  it('βλάβη δικτύου ⇒ η καρδιά αδειάζει ξανά, είδηση «failed»', async () => {
    const { result } = await ready();
    mockPut.mockRejectedValue(new Error('network'));

    await act(async () => result.current.toggle('l1'));
    await waitFor(() => expect(result.current.savedIds.has('l1')).toBe(false));
    expect(result.current.notice?.kind).toBe('failed');
  });

  it('409 own-listing ⇒ είδηση που λέει ΓΙΑΤΙ', async () => {
    const { result } = await ready();
    mockPut.mockRejectedValue(new ApiClientError('conflict', 409, 'REFUSED', undefined, undefined, undefined, { error: 'REFUSED', reason: 'own-listing' }));

    await act(async () => result.current.toggle('l1'));
    await waitFor(() => expect(result.current.notice?.kind).toBe('own-listing'));
    expect(result.current.savedIds.has('l1')).toBe(false);
  });
});

describe('Κ4 — ο ανώνυμος: σύνδεση με την πρόθεση, και ολοκλήρωση ΜΙΑ φορά', () => {
  it('ανώνυμος ⇒ καμία κλήση API, πλοήγηση στη σύνδεση με `?next=…?save=`', async () => {
    mockAuth = { user: null, loading: false };
    const { result } = renderHook(() => useSavedListingsState());
    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    act(() => result.current.toggle('l1'));
    expect(mockPut).not.toHaveBeenCalled();
    const target = decodeURIComponent(String(mockPush.mock.calls[0]?.[0]));
    expect(target).toContain('/search/results?save=l1');
  });

  it('επιστροφή με `?save=` ⇒ ΕΝΑ PUT, η παράμετρος σβήνεται', async () => {
    mockSearch = new URLSearchParams('q=athens&save=l1');
    const { result } = await ready();

    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
    expect(result.current.savedIds.has('l1')).toBe(true);
    expect(mockSearch.get('save')).toBeNull();
    expect(mockSearch.get('q')).toBe('athens');
  });

  it('η πρόθεση για ήδη κρατημένη αγγελία ⇒ κανένα αίτημα', async () => {
    mockSearch = new URLSearchParams('save=l1');
    await ready([{ listingId: 'l1' }]);
    await waitFor(() => expect(mockReplaceParams).toHaveBeenCalled());
    expect(mockPut).not.toHaveBeenCalled();
  });
});
