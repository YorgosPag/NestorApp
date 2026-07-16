/**
 * 🧪 useAuditFeed — the shared audit-feed plumbing (ADR-584 / ADR-195 Phase 12)
 *
 * Complements the characterization tests of the two public hooks
 * (`useEntityAudit`, `useGlobalAuditTrail`), which prove the wrappers still
 * behave as before. This suite covers the contract of the plumbing itself —
 * most importantly the two things the wrappers cannot express: that
 * `subscriptionKey` (not closure identity) drives re-subscription, and that a
 * feed that becomes disabled empties itself.
 */

import { renderHook, act, waitFor } from '@testing-library/react';

import { useAuditFeed, type AuditFeedPage } from '../useAuditFeed';
import type { AuditSubscriptionCallback } from '@/services/entity-audit-client.service';
import type { EntityAuditEntry } from '@/types/audit-trail';

// The service is only referenced for `dedupDualWrite`; keep the Firebase client
// SDK out of the test environment.
jest.mock('@/services/entity-audit-client.service', () => ({
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

const unsubscribe = jest.fn();
const subscribe = jest.fn<() => void, [AuditSubscriptionCallback]>();
const fetchPage = jest.fn<Promise<AuditFeedPage>, [string]>();

function callback(): AuditSubscriptionCallback {
  return subscribe.mock.calls.at(-1)![0];
}

interface Props {
  enabled?: boolean;
  pageSize?: number;
  subscriptionKey?: string;
}

function render(props: Props = {}) {
  return renderHook(
    ({ enabled = true, pageSize = 2, subscriptionKey = 'k1' }: Props) =>
      useAuditFeed({
        enabled,
        pageSize,
        subscriptionKey,
        subscribe,
        fetchPage,
        subscribeErrorFallback: 'fallback message',
      }),
    { initialProps: props },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  subscribe.mockReturnValue(unsubscribe);
  fetchPage.mockResolvedValue({ entries: [], hasMore: false });
});

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

describe('useAuditFeed — subscription identity', () => {
  it('re-subscribes when subscriptionKey changes', () => {
    const { rerender } = render({ subscriptionKey: 'k1' });
    rerender({ subscriptionKey: 'k2' });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(2);
  });

  it('does NOT re-subscribe when only the subscribe closure identity changes', () => {
    // A caller passing an inline arrow gets a fresh closure every render — that
    // must not churn the Firestore listener.
    const { rerender } = renderHook(
      ({ tag }: { tag: string }) =>
        useAuditFeed({
          enabled: true,
          pageSize: 2,
          subscriptionKey: 'stable',
          subscribe: (cb) => subscribe(cb),
          fetchPage: async () => {
            void tag;
            return { entries: [], hasMore: false };
          },
          subscribeErrorFallback: 'fallback message',
        }),
      { initialProps: { tag: 'a' } },
    );

    rerender({ tag: 'b' });
    rerender({ tag: 'c' });

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('calls the LATEST subscribe closure, not the one captured at mount', () => {
    const seen: string[] = [];
    const { rerender } = renderHook(
      ({ tag }: { tag: string }) =>
        useAuditFeed({
          enabled: true,
          pageSize: 2,
          subscriptionKey: tag, // key changes → re-subscribe with latest closure
          subscribe: () => {
            seen.push(tag);
            return unsubscribe;
          },
          fetchPage,
          subscribeErrorFallback: 'fallback message',
        }),
      { initialProps: { tag: 'a' } },
    );

    rerender({ tag: 'b' });

    expect(seen).toEqual(['a', 'b']);
  });

  it('unsubscribes on unmount', () => {
    render().unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('useAuditFeed — enabled gate', () => {
  it('never subscribes while disabled', () => {
    const { result } = render({ enabled: false });

    expect(subscribe).not.toHaveBeenCalled();
    expect(result.current.entries).toEqual([]);
  });

  it('empties the feed when it becomes disabled', () => {
    // ADR-584: previously `useGlobalAuditTrail` kept its rows after logout
    // while `useEntityAudit` cleared them. The shared plumbing clears — stale
    // tenant rows must not survive the gate closing.
    const { result, rerender } = render({ enabled: true });
    act(() => callback()([entry('a', '2026-01-01T00:00:00.000Z')], null));
    expect(result.current.entries).toHaveLength(1);

    rerender({ enabled: false });

    expect(result.current.entries).toEqual([]);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('subscribes once the gate opens', () => {
    const { rerender } = render({ enabled: false });
    rerender({ enabled: true });
    expect(subscribe).toHaveBeenCalledTimes(1);
  });
});

describe('useAuditFeed — live window', () => {
  it('publishes entries newest-first and stops loading', () => {
    const { result } = render();

    act(() =>
      callback()(
        [
          entry('old', '2026-01-01T00:00:00.000Z'),
          entry('new', '2026-02-01T00:00:00.000Z'),
        ],
        null,
      ),
    );

    expect(result.current.entries.map((e) => e.id)).toEqual(['new', 'old']);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasMore).toBe(true); // window full (pageSize 2)
  });

  it('uses the fallback message when the subscription error carries none', () => {
    const { result } = render();

    // A rejection that is not an Error and exposes no `message` — the only
    // shape for which `getErrorMessage` reaches its fallback.
    act(() => callback()([], {} as Error));

    expect(result.current.error).toBe('fallback message');
  });

  it('ignores callbacks that fire after unmount', () => {
    const { result, unmount } = render();
    const cb = callback();

    unmount();
    act(() => cb([entry('a', '2026-01-01T00:00:00.000Z')], null));

    expect(result.current.entries).toEqual([]);
  });

  it('drops the historical tail when the subscription identity changes', async () => {
    fetchPage.mockResolvedValue({
      entries: [entry('older', '2025-01-01T00:00:00.000Z')],
      hasMore: true,
      nextCursor: 'c2',
    });

    const { result, rerender } = render({ subscriptionKey: 'k1' });
    act(() => callback()([entry('a', '2026-01-01T00:00:00.000Z')], null));
    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.entries).toHaveLength(2));

    rerender({ subscriptionKey: 'k2' });
    act(() => callback()([entry('z', '2026-05-01T00:00:00.000Z')], null));

    expect(result.current.entries.map((e) => e.id)).toEqual(['z']);
  });
});

describe('useAuditFeed — loadMore', () => {
  it('pages with the oldest loaded id, then with nextCursor', async () => {
    fetchPage.mockResolvedValue({
      entries: [entry('older', '2025-01-01T00:00:00.000Z')],
      hasMore: true,
      nextCursor: 'c2',
    });

    const { result } = render();
    act(() => callback()([entry('a', '2026-01-01T00:00:00.000Z')], null));

    await act(async () => {
      result.current.loadMore();
    });
    expect(fetchPage).toHaveBeenLastCalledWith('a');
    await waitFor(() =>
      expect(result.current.entries.map((e) => e.id)).toEqual(['a', 'older']),
    );

    await act(async () => {
      result.current.loadMore();
    });
    expect(fetchPage).toHaveBeenLastCalledWith('c2');
  });

  it('does not fetch while disabled', async () => {
    const { result } = render({ enabled: false });

    await act(async () => {
      result.current.loadMore();
    });

    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('clears hasMore and does not fetch with an empty feed', async () => {
    const { result } = render();
    act(() => callback()([], null));

    await act(async () => {
      result.current.loadMore();
    });

    expect(fetchPage).not.toHaveBeenCalled();
    expect(result.current.hasMore).toBe(false);
  });

  it('surfaces a page failure and recovers isLoading', async () => {
    fetchPage.mockRejectedValue(new Error('network down'));

    const { result } = render();
    act(() => callback()([entry('a', '2026-01-01T00:00:00.000Z')], null));

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.error).toBe('network down'));
    expect(result.current.isLoading).toBe(false);
  });

  it('falls back to a generic message when the page error carries none', async () => {
    fetchPage.mockRejectedValue({});

    const { result } = render();
    act(() => callback()([entry('a', '2026-01-01T00:00:00.000Z')], null));

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() =>
      expect(result.current.error).toBe('Failed to load more audit entries'),
    );
  });
});

describe('useAuditFeed — refetch', () => {
  it('clears the error without reopening the subscription', () => {
    const { result } = render();
    act(() => callback()([], new Error('boom')));

    act(() => result.current.refetch());

    expect(result.current.error).toBeNull();
    expect(subscribe).toHaveBeenCalledTimes(1);
  });
});
