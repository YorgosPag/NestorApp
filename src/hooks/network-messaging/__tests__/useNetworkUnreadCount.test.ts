/**
 * @file ADR-867 §4.5 (Β10) — ο ζωντανός μετρητής αδιάβαστων.
 *
 * - Μ1: ο ακροατής ζητά ΜΙΑ παραπάνω από την οροφή του σήματος (99 ⇒ 100) — αλλιώς το «99+» δεν θα ερχόταν ποτέ.
 * - Μ2: 99 γραμμές = ακριβής αριθμός· 100 = κάτω φράγμα (`atLeast`).
 * - Μ3: χωρίς άνθρωπο ⇒ καμία συνδρομή (κλειδί `null`) και 0.
 * - Μ4: άρνηση / φόρτωση ⇒ 0, ποτέ σφάλμα στη στήλη.
 */

import { renderHook } from '@testing-library/react';

import type { LiveState } from '@/services/realtime/hooks/use-live-snapshot';

let mockUser: { uid: string } | null = { uid: 'user_maria' };
let mockLive: LiveState<readonly string[]> = { state: 'loading' };
const liveList = jest.fn((_key: string | null, query: () => unknown) => {
  query();
  return mockLive;
});
const rowsQuery = jest.fn((_uid: string, _max: number) => ({}));

jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/services/realtime/hooks/use-live-snapshot', () => ({
  useLiveList: (key: string | null, query: () => unknown) => liveList(key, query),
}));
jest.mock('@/lib/network-messaging/network-thread-client-ref', () => ({
  clientInboxUnreadRows: (uid: string, max: number) => rowsQuery(uid, max),
}));

import {
  NETWORK_UNREAD_CEILING,
  networkUnreadCountOf,
  useNetworkUnreadCount,
} from '@/hooks/network-messaging/useNetworkUnreadCount';

beforeEach(() => {
  liveList.mockClear();
  rowsQuery.mockClear();
  mockUser = { uid: 'user_maria' };
});

describe('Μ — ο ζωντανός μετρητής αδιάβαστων', () => {
  it('Μ1 ο ακροατής ζητά οροφή + 1 γραμμές, για τον ΙΔΙΟ τον άνθρωπο', () => {
    mockLive = { state: 'ready', value: ['a'] };
    renderHook(() => useNetworkUnreadCount());
    expect(NETWORK_UNREAD_CEILING).toBe(100);
    expect(liveList).toHaveBeenCalledWith('user_maria', expect.any(Function));
    expect(rowsQuery).toHaveBeenCalledWith('user_maria', 100);
  });

  it('Μ2 99 ⇒ ακριβής· 100 ⇒ κάτω φράγμα', () => {
    expect(networkUnreadCountOf(99)).toStrictEqual({ count: 99, atLeast: false });
    expect(networkUnreadCountOf(100)).toStrictEqual({ count: 100, atLeast: true });

    mockLive = { state: 'ready', value: ['a', 'b', 'c'] };
    expect(renderHook(() => useNetworkUnreadCount()).result.current).toStrictEqual({ count: 3, atLeast: false });
  });

  it('Μ3 χωρίς άνθρωπο ⇒ κλειδί `null` (καμία συνδρομή) και 0', () => {
    mockUser = null;
    mockLive = { state: 'idle' };
    const { result } = renderHook(() => useNetworkUnreadCount());
    expect(liveList.mock.calls[0]?.[0]).toBeNull();
    expect(result.current).toStrictEqual({ count: 0, atLeast: false });
  });

  it.each([{ state: 'absent' }, { state: 'loading' }, { state: 'error', message: 'x' }] as const)(
    'Μ4 %o ⇒ 0',
    (state) => {
      mockLive = state;
      expect(renderHook(() => useNetworkUnreadCount()).result.current).toStrictEqual({ count: 0, atLeast: false });
    },
  );
});
