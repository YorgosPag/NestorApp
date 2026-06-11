/**
 * PERF (2026-06-11) — useFirestoreBuildings shared-listener dedup contract.
 *
 * Pins the fix for root-cause #3 of the DXF-viewer freeze investigation: the
 * ~11 simultaneous call sites used to each open their own onSnapshot
 * (9× "Buildings updated" + 9× map/sort per change). The hook now backs a
 * single module-level, reference-counted Firestore subscription shared via
 * useSyncExternalStore.
 *
 * Contract pinned here:
 *   1. N concurrent consumers → exactly ONE firestoreQueryService.subscribe.
 *   2. A single store update fans out to every consumer.
 *   3. The Firestore listener closes only when the LAST consumer unmounts.
 *
 * NOTE: the hook backs a MODULE-LEVEL singleton, so each test must fully unmount
 * its consumers to return the shared reference count to zero before the next.
 */

import { act, renderHook } from '@testing-library/react';
import { useFirestoreBuildings } from '../useFirestoreBuildings';

const subscribeMock = jest.fn();
const unsubscribeMock = jest.fn();
let capturedOnNext: ((result: { documents: unknown[] }) => void) | undefined;

jest.mock('@/services/firestore', () => ({
  firestoreQueryService: {
    subscribe: (_collection: string, onNext: (r: { documents: unknown[] }) => void) => {
      subscribeMock();
      capturedOnNext = onNext;
      return unsubscribeMock;
    },
  },
}));

// In-memory stale-cache (the singleton's seed); shared across the suite.
jest.mock('@/lib/stale-cache', () => ({
  createStaleCache: () => {
    let data: unknown;
    let loaded = false;
    return {
      get: () => data,
      set: (v: unknown) => { data = v; loaded = true; },
      hasLoaded: () => loaded,
    };
  },
}));

beforeEach(() => {
  subscribeMock.mockClear();
  unsubscribeMock.mockClear();
  capturedOnNext = undefined;
});

describe('useFirestoreBuildings — shared-listener dedup', () => {
  it('opens exactly one Firestore subscription for many concurrent consumers', () => {
    const a = renderHook(() => useFirestoreBuildings());
    const b = renderHook(() => useFirestoreBuildings());
    const c = renderHook(() => useFirestoreBuildings());

    expect(subscribeMock).toHaveBeenCalledTimes(1);

    a.unmount(); b.unmount(); c.unmount();
  });

  it('fans a single update out to every consumer', () => {
    const a = renderHook(() => useFirestoreBuildings());
    const b = renderHook(() => useFirestoreBuildings());

    act(() => {
      capturedOnNext?.({
        documents: [
          { id: 'b1', status: 'active', createdAt: 2 },
          { id: 'b2', status: 'deleted', createdAt: 3 }, // soft-deleted → excluded
        ],
      });
    });

    expect(a.result.current.buildings).toHaveLength(1);
    expect(a.result.current.buildings[0].id).toBe('b1');
    expect(b.result.current.buildings).toHaveLength(1);
    expect(a.result.current.loading).toBe(false);

    a.unmount(); b.unmount();
  });

  it('closes the Firestore listener only when the last consumer unmounts', () => {
    const a = renderHook(() => useFirestoreBuildings());
    const b = renderHook(() => useFirestoreBuildings());
    const c = renderHook(() => useFirestoreBuildings());

    a.unmount();
    b.unmount();
    expect(unsubscribeMock).not.toHaveBeenCalled();

    c.unmount();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
