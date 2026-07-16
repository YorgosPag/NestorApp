/**
 * 🧪 useGlobalAuditTrail — characterization tests (ADR-195 Phase 10)
 *
 * Written BEFORE the `useAuditFeed` extraction (ADR-584 / N.18 de-duplication)
 * so the refactor can be proven behaviour-preserving. Assertions describe what
 * the hook did on 2026-07-16 — including the filter→query-string mapping and
 * the `offset` (not `startAfter`) pagination parameter that distinguishes the
 * admin feed from the per-entity one.
 */

import { renderHook, act, waitFor } from '@testing-library/react';

import {
  useGlobalAuditTrail,
  type GlobalAuditFilters,
} from '../useGlobalAuditTrail';
import type {
  AuditSubscriptionCallback,
  GlobalSubscriptionOptions,
} from '@/services/entity-audit-client.service';
import type { EntityAuditEntry } from '@/types/audit-trail';

// ---------------------------------------------------------------------------
// MOCKS
// ---------------------------------------------------------------------------

const mockUser = { uid: 'admin-1' };
let currentUser: { uid: string } | null = mockUser;

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: currentUser }),
}));

const mockGet = jest.fn();
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
}));

const mockUnsubscribe = jest.fn();
const mockSubscribeGlobal = jest.fn();

jest.mock('@/services/entity-audit-client.service', () => ({
  EntityAuditClientService: {
    subscribeGlobal: (...args: unknown[]) => mockSubscribeGlobal(...args),
  },
  dedupDualWrite: jest.requireActual('@/services/audit/dedup-dual-write')
    .dedupDualWrite,
}));

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------

function entry(
  id: string,
  timestamp: string,
  overrides: Partial<EntityAuditEntry> = {},
): EntityAuditEntry {
  return {
    id,
    entityType: 'contact',
    entityId: 'e-1',
    entityName: 'Contact 1',
    action: 'update',
    changes: [],
    performedBy: 'user-1',
    performedByName: 'User One',
    companyId: 'c-1',
    timestamp,
    source: undefined,
    ...overrides,
  } as EntityAuditEntry;
}

function lastCallback(): AuditSubscriptionCallback {
  return mockSubscribeGlobal.mock.calls.at(-1)![1] as AuditSubscriptionCallback;
}

function lastOptions(): GlobalSubscriptionOptions {
  return mockSubscribeGlobal.mock.calls.at(-1)![0] as GlobalSubscriptionOptions;
}

function render(filters?: GlobalAuditFilters, pageSize?: number) {
  return renderHook(() => useGlobalAuditTrail({ filters, pageSize }));
}

beforeEach(() => {
  currentUser = mockUser;
  jest.clearAllMocks();
  mockSubscribeGlobal.mockReturnValue(mockUnsubscribe);
});

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

describe('useGlobalAuditTrail — gating', () => {
  it('does not subscribe when there is no authenticated user', () => {
    currentUser = null;
    const { result } = render();

    expect(mockSubscribeGlobal).not.toHaveBeenCalled();
    expect(result.current.entries).toEqual([]);
  });

  it('works with no options object at all', () => {
    renderHook(() => useGlobalAuditTrail());
    expect(lastOptions().limit).toBe(30);
  });
});

describe('useGlobalAuditTrail — subscription', () => {
  it('subscribes with pageSize as the limit and the filters passed through', () => {
    const filters: GlobalAuditFilters = { entityType: 'contact' };
    render(filters, 10);

    expect(lastOptions()).toEqual({ limit: 10, filters });
  });

  it('defaults the page size to 30', () => {
    render();
    expect(lastOptions().limit).toBe(30);
  });

  it('publishes entries and stops loading on the first callback', () => {
    const { result } = render();

    act(() => lastCallback()([entry('a', '2026-01-01T00:00:00.000Z')], null));

    expect(result.current.entries.map((e) => e.id)).toEqual(['a']);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets hasMore when the live window comes back full', () => {
    const { result } = render(undefined, 2);

    act(() =>
      lastCallback()(
        [
          entry('a', '2026-01-02T00:00:00.000Z'),
          entry('b', '2026-01-01T00:00:00.000Z'),
        ],
        null,
      ),
    );

    expect(result.current.hasMore).toBe(true);
  });

  it('surfaces a subscription error message and stops loading', () => {
    const { result } = render();

    act(() => lastCallback()([], new Error('permission-denied')));

    expect(result.current.error).toBe('permission-denied');
    expect(result.current.isLoading).toBe(false);
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = render();
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does NOT resubscribe when a new filters object is deep-equal', () => {
    const { rerender } = renderHook(
      ({ f }: { f: GlobalAuditFilters }) => useGlobalAuditTrail({ filters: f }),
      { initialProps: { f: { entityType: 'contact' } as GlobalAuditFilters } },
    );

    rerender({ f: { entityType: 'contact' } }); // brand-new object, same value

    expect(mockSubscribeGlobal).toHaveBeenCalledTimes(1);
  });

  it('resubscribes when the filter value actually changes', () => {
    const { rerender } = renderHook(
      ({ f }: { f: GlobalAuditFilters }) => useGlobalAuditTrail({ filters: f }),
      { initialProps: { f: { entityType: 'contact' } as GlobalAuditFilters } },
    );

    rerender({ f: { entityType: 'project' } });

    expect(mockSubscribeGlobal).toHaveBeenCalledTimes(2);
    expect(lastOptions().filters).toEqual({ entityType: 'project' });
  });

  it('ignores a callback that fires after unmount', () => {
    const { result, unmount } = render();
    const callback = lastCallback();

    unmount();
    act(() => callback([entry('a', '2026-01-01T00:00:00.000Z')], null));

    expect(result.current.entries).toEqual([]);
  });
});

describe('useGlobalAuditTrail — entries projection', () => {
  it('sorts newest first and drops duplicate ids', () => {
    const { result } = render();

    act(() =>
      lastCallback()(
        [
          entry('old', '2026-01-01T00:00:00.000Z'),
          entry('new', '2026-03-01T00:00:00.000Z'),
          entry('new', '2026-03-01T00:00:00.000Z'),
        ],
        null,
      ),
    );

    expect(result.current.entries.map((e) => e.id)).toEqual(['new', 'old']);
  });

  it('collapses the CDC dual-write pair (cdc wins)', () => {
    const { result } = render();

    act(() =>
      lastCallback()(
        [
          entry('svc', '2026-01-01T00:00:00.000Z', { source: 'service' }),
          entry('cdc', '2026-01-01T00:00:02.000Z', { source: 'cdc' }),
        ],
        null,
      ),
    );

    expect(result.current.entries.map((e) => e.id)).toEqual(['cdc']);
  });
});

describe('useGlobalAuditTrail — loadMore', () => {
  it('pages with offset = oldest loaded entry id and appends the result', async () => {
    mockGet.mockResolvedValue({
      entries: [entry('older', '2025-12-01T00:00:00.000Z')],
      hasMore: true,
      nextCursor: 'cursor-2',
    });

    const { result } = render(undefined, 30);
    act(() => lastCallback()([entry('a', '2026-01-01T00:00:00.000Z')], null));

    await act(async () => {
      result.current.loadMore();
    });

    expect(mockGet).toHaveBeenCalledWith(
      '/api/audit-trail/global?limit=30&offset=a',
    );
    await waitFor(() =>
      expect(result.current.entries.map((e) => e.id)).toEqual(['a', 'older']),
    );
    expect(result.current.hasMore).toBe(true);
  });

  it('forwards every filter to the pagination query string', async () => {
    mockGet.mockResolvedValue({ entries: [], hasMore: false });

    const filters: GlobalAuditFilters = {
      entityType: 'contact',
      performedBy: 'user-9',
      action: 'update',
      fromDate: '2026-01-01',
      toDate: '2026-02-01',
    };
    const { result } = render(filters, 30);
    act(() => lastCallback()([entry('a', '2026-01-01T00:00:00.000Z')], null));

    await act(async () => {
      result.current.loadMore();
    });

    expect(mockGet).toHaveBeenCalledWith(
      '/api/audit-trail/global?limit=30&offset=a&entityType=contact&performedBy=user-9&action=update&fromDate=2026-01-01&toDate=2026-02-01',
    );
  });

  it('uses nextCursor instead of the oldest id on the second page', async () => {
    mockGet.mockResolvedValue({
      entries: [entry('p1', '2025-12-01T00:00:00.000Z')],
      hasMore: true,
      nextCursor: 'cursor-2',
    });

    const { result } = render(undefined, 30);
    act(() => lastCallback()([entry('a', '2026-01-01T00:00:00.000Z')], null));

    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.entries).toHaveLength(2));

    mockGet.mockResolvedValue({ entries: [], hasMore: false });
    await act(async () => {
      result.current.loadMore();
    });

    expect(mockGet).toHaveBeenLastCalledWith(
      '/api/audit-trail/global?limit=30&offset=cursor-2',
    );
  });

  it('clears hasMore and does not fetch when there is no cursor at all', async () => {
    const { result } = render();
    act(() => lastCallback()([], null));

    await act(async () => {
      result.current.loadMore();
    });

    expect(mockGet).not.toHaveBeenCalled();
    expect(result.current.hasMore).toBe(false);
  });

  it('does not fetch without an authenticated user', async () => {
    currentUser = null;
    const { result } = render();

    await act(async () => {
      result.current.loadMore();
    });

    expect(mockGet).not.toHaveBeenCalled();
  });

  it('surfaces a fetch failure as an error and stops loading', async () => {
    mockGet.mockRejectedValue(new Error('network down'));

    const { result } = render();
    act(() => lastCallback()([entry('a', '2026-01-01T00:00:00.000Z')], null));

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.error).toBe('network down'));
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useGlobalAuditTrail — refetch', () => {
  it('clears the error without touching the subscription', () => {
    const { result } = render();
    act(() => lastCallback()([], new Error('boom')));
    expect(result.current.error).toBe('boom');

    act(() => result.current.refetch());

    expect(result.current.error).toBeNull();
    expect(mockSubscribeGlobal).toHaveBeenCalledTimes(1);
  });
});
