/**
 * 🧪 useEntityAudit — characterization tests (ADR-195 Phase 10)
 *
 * Written BEFORE the `useAuditFeed` extraction (ADR-584 / N.18 de-duplication)
 * so the refactor can be proven behaviour-preserving. Every assertion here
 * describes what the hook did on 2026-07-16, not what it "should" do.
 */

import { renderHook, act, waitFor } from '@testing-library/react';

import { useEntityAudit } from '../useEntityAudit';
import type {
  AuditSubscriptionCallback,
  EntitySubscriptionOptions,
} from '@/services/entity-audit-client.service';
import type { EntityAuditEntry } from '@/types/audit-trail';

// ---------------------------------------------------------------------------
// MOCKS
// ---------------------------------------------------------------------------

const mockUser = { uid: 'user-1' };
let currentUser: { uid: string } | null = mockUser;

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: currentUser }),
}));

const mockGet = jest.fn();
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
}));

const mockUnsubscribe = jest.fn();
const mockSubscribeEntity = jest.fn();

jest.mock('@/services/entity-audit-client.service', () => ({
  EntityAuditClientService: {
    subscribeEntity: (...args: unknown[]) => mockSubscribeEntity(...args),
  },
  // Real pure implementation — the dedup semantics are part of the contract.
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

/** Hand the subscription callback back to the test. */
function lastCallback(): AuditSubscriptionCallback {
  const call = mockSubscribeEntity.mock.calls.at(-1);
  return call![1] as AuditSubscriptionCallback;
}

function lastOptions(): EntitySubscriptionOptions {
  const call = mockSubscribeEntity.mock.calls.at(-1);
  return call![0] as EntitySubscriptionOptions;
}

function render(entityId: string = 'e-1', pageSize?: number) {
  return renderHook(() =>
    useEntityAudit({ entityType: 'contact', entityId, pageSize }),
  );
}

beforeEach(() => {
  currentUser = mockUser;
  jest.clearAllMocks();
  mockSubscribeEntity.mockReturnValue(mockUnsubscribe);
});

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

describe('useEntityAudit — gating', () => {
  it('does not subscribe when there is no authenticated user', () => {
    currentUser = null;
    const { result } = render();

    expect(mockSubscribeEntity).not.toHaveBeenCalled();
    expect(result.current.entries).toEqual([]);
  });

  it('does not subscribe when entityId is undefined', () => {
    const { result } = renderHook(() =>
      useEntityAudit({ entityType: 'contact', entityId: undefined }),
    );

    expect(mockSubscribeEntity).not.toHaveBeenCalled();
    expect(result.current.entries).toEqual([]);
  });

  it('clears entries when entityId becomes undefined after having data', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | undefined }) =>
        useEntityAudit({ entityType: 'contact', entityId: id }),
      { initialProps: { id: 'e-1' as string | undefined } },
    );

    act(() => lastCallback()([entry('a', '2026-01-01T00:00:00.000Z')], null));
    expect(result.current.entries).toHaveLength(1);

    rerender({ id: undefined });
    expect(result.current.entries).toEqual([]);
  });
});

describe('useEntityAudit — subscription', () => {
  it('subscribes with entityType, entityId and pageSize as the limit', () => {
    render('e-1', 5);

    expect(lastOptions()).toEqual({
      entityType: 'contact',
      entityId: 'e-1',
      limit: 5,
    });
  });

  it('defaults the page size to 20', () => {
    render('e-1');
    expect(lastOptions().limit).toBe(20);
  });

  it('publishes entries and stops loading on the first callback', () => {
    const { result } = render();

    act(() => lastCallback()([entry('a', '2026-01-01T00:00:00.000Z')], null));

    expect(result.current.entries.map((e) => e.id)).toEqual(['a']);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets hasMore when the live window comes back full', () => {
    const { result } = render('e-1', 2);

    act(() =>
      lastCallback()(
        [entry('a', '2026-01-02T00:00:00.000Z'), entry('b', '2026-01-01T00:00:00.000Z')],
        null,
      ),
    );

    expect(result.current.hasMore).toBe(true);
  });

  it('leaves hasMore false when the live window is not full', () => {
    const { result } = render('e-1', 2);

    act(() => lastCallback()([entry('a', '2026-01-01T00:00:00.000Z')], null));

    expect(result.current.hasMore).toBe(false);
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

  it('resubscribes when entityId changes', () => {
    const { rerender } = renderHook(
      ({ id }: { id: string }) =>
        useEntityAudit({ entityType: 'contact', entityId: id }),
      { initialProps: { id: 'e-1' } },
    );

    rerender({ id: 'e-2' });

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribeEntity).toHaveBeenCalledTimes(2);
    expect(lastOptions().entityId).toBe('e-2');
  });

  it('ignores a callback that fires after unmount', () => {
    const { result, unmount } = render();
    const callback = lastCallback();

    unmount();
    act(() => callback([entry('a', '2026-01-01T00:00:00.000Z')], null));

    expect(result.current.entries).toEqual([]);
  });
});

describe('useEntityAudit — entries projection', () => {
  it('sorts newest first regardless of arrival order', () => {
    const { result } = render();

    act(() =>
      lastCallback()(
        [
          entry('old', '2026-01-01T00:00:00.000Z'),
          entry('new', '2026-03-01T00:00:00.000Z'),
          entry('mid', '2026-02-01T00:00:00.000Z'),
        ],
        null,
      ),
    );

    expect(result.current.entries.map((e) => e.id)).toEqual([
      'new',
      'mid',
      'old',
    ]);
  });

  it('drops duplicate ids and entries without an id', () => {
    const { result } = render();

    act(() =>
      lastCallback()(
        [
          entry('a', '2026-01-02T00:00:00.000Z'),
          entry('a', '2026-01-02T00:00:00.000Z'),
          entry('', '2026-01-01T00:00:00.000Z'),
        ],
        null,
      ),
    );

    expect(result.current.entries.map((e) => e.id)).toEqual(['a']);
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

describe('useEntityAudit — loadMore', () => {
  it('pages with startAfter = oldest loaded entry id and appends the result', async () => {
    mockGet.mockResolvedValue({
      entries: [entry('older', '2025-12-01T00:00:00.000Z')],
      hasMore: true,
      nextCursor: 'cursor-2',
    });

    const { result } = render('e-1', 20);
    act(() => lastCallback()([entry('a', '2026-01-01T00:00:00.000Z')], null));

    await act(async () => {
      result.current.loadMore();
    });

    expect(mockGet).toHaveBeenCalledWith(
      '/api/audit-trail/contact/e-1?limit=20&startAfter=a',
    );
    await waitFor(() =>
      expect(result.current.entries.map((e) => e.id)).toEqual(['a', 'older']),
    );
    expect(result.current.hasMore).toBe(true);
  });

  it('uses nextCursor instead of the oldest id on the second page', async () => {
    mockGet.mockResolvedValue({
      entries: [entry('p1', '2025-12-01T00:00:00.000Z')],
      hasMore: true,
      nextCursor: 'cursor-2',
    });

    const { result } = render('e-1', 20);
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
      '/api/audit-trail/contact/e-1?limit=20&startAfter=cursor-2',
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

describe('useEntityAudit — refetch', () => {
  it('clears the error without touching the subscription', () => {
    const { result } = render();
    act(() => lastCallback()([], new Error('boom')));
    expect(result.current.error).toBe('boom');

    act(() => result.current.refetch());

    expect(result.current.error).toBeNull();
    expect(mockSubscribeEntity).toHaveBeenCalledTimes(1);
  });
});
