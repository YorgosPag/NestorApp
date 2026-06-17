/**
 * ADR-441 Slice 1 — `useGridGuidePersistence` flush-on-ready tests.
 *
 * Καλύπτει το race που έχανε το ΠΡΩΤΟ batch οδηγών: όταν το floor scope
 * (`floorplanId` = `levelManager.fileRecordId`) ετοιμάζεται **αργά**, το service
 * ήταν `null` τη στιγμή του debounced save → silent no-op → χάσιμο στο reload.
 *
 * Το fix: `serviceReady` state (re-runs subscribe effect όταν δέσει το scope) +
 * flush-on-ready (restore pending store guides όταν το remote doc είναι κενό →
 * ο debounced save τα persistάρει). Εδώ δοκιμάζεται η React/timer ορχήστρωση με
 * mocked store + service· τα `guidesToSnapshots`/`snapshotToGuide` είναι ΠΡΑΓΜΑΤΙΚΑ
 * (true round-trip).
 */

import { renderHook, act } from '@testing-library/react';

import { useGridGuidePersistence, type UseGridGuidePersistenceParams } from '../useGridGuidePersistence';
import { guidesToSnapshots } from '../../../systems/guides/guide-persistence-types';
import type { GridGuideDoc } from '../../../systems/guides/guide-persistence-types';
import type { GridGuideSaveInput } from '../../../systems/guides/guide-firestore-service';
import type { Guide } from '../../../systems/guides/guide-types';

// `mock`-prefixed vars are allowed inside jest.mock factories (hoisting rule).
let mockGuideStore: ReturnType<typeof makeStore>;
let mockService: ReturnType<typeof makeService>;

jest.mock('../../../systems/guides/guide-store', () => ({
  getGlobalGuideStore: () => mockGuideStore,
}));

jest.mock('../../../systems/guides/guide-firestore-service', () => ({
  createGridGuideFirestoreService: jest.fn(() => mockService),
  GridGuideFirestoreService: class {},
}));

// ============================================================================
// FIXTURES / FAKES
// ============================================================================

const guide = (id: string, axis: Guide['axis'], offset: number): Guide => ({
  id,
  axis,
  offset,
  label: null,
  style: null,
  visible: true,
  locked: false,
  createdAt: '2026-06-13T00:00:00.000Z',
  parentId: null,
  groupId: null,
});

/** Minimal stateful fake of the ADR-189 global guide store. */
function makeStore() {
  let guides: Guide[] = [];
  let groups: unknown[] = [];
  const listeners = new Set<() => void>();
  const emit = () => { for (const l of [...listeners]) l(); };
  return {
    getGuides: () => guides,
    getGroups: () => groups,
    clear: jest.fn(() => { guides = []; groups = []; }),
    restoreGuide: jest.fn((g: Guide) => { guides = [...guides, g]; emit(); }),
    restoreGroup: jest.fn((g: unknown) => { groups = [...groups, g]; }),
    subscribe: (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    /** Test helper — simulate the user placing guides on the canvas. */
    __place: (gs: Guide[]) => { guides = [...guides, ...gs]; emit(); },
  };
}

/** Fake GridGuideFirestoreService. `subscribeGrid` fires the initial snapshot synchronously. */
function makeService(remoteDocs: readonly GridGuideDoc[] = []) {
  return {
    subscribeGrid: jest.fn((onChange: (docs: readonly GridGuideDoc[]) => void) => {
      onChange(remoteDocs);
      return () => {};
    }),
    createGrid: jest.fn(async (_input: GridGuideSaveInput) => 'grd_test_created'),
    updateGrid: jest.fn(async () => {}),
    deleteGrid: jest.fn(async () => {}),
  };
}

const remoteDoc = (id: string, guides: readonly Guide[]): GridGuideDoc => ({
  id,
  companyId: 'comp_x',
  projectId: 'proj_x',
  floorplanId: 'file_x',
  floorId: 'flr_x',
  guides: guidesToSnapshots(guides),
  groups: [],
  version: 1,
  createdAt: {} as GridGuideDoc['createdAt'],
  createdBy: 'u',
  updatedAt: {} as GridGuideDoc['updatedAt'],
  updatedBy: 'u',
});

const FULL = { companyId: 'comp_x', projectId: 'proj_x', floorplanId: 'file_x', floorId: 'flr_x', userId: 'u' };
// ADR-420 (2026-06-16) — "not ready" now means NO scope key at all. A floor with a
// durable `floorId` but no `floorplanId` IS a valid scope (the resilience fix:
// resolveBimPersistenceScope), so null-ing only floorplanId no longer blocks the
// service. Withhold both scope keys to genuinely simulate an unbound canvas.
const NO_SCOPE = { ...FULL, floorplanId: null, floorId: null };

const flushTimers = async () => {
  await act(async () => {
    jest.advanceTimersByTime(1100);
    await Promise.resolve();
  });
};

// ============================================================================
// TESTS
// ============================================================================

beforeEach(() => {
  jest.useFakeTimers();
  mockGuideStore = makeStore();
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('useGridGuidePersistence — flush-on-ready', () => {
  it('οδηγοί πριν ετοιμαστεί το scope persistάρονται μόλις δέσει (empty remote → flush → create)', async () => {
    mockService = makeService([]); // καμία remote εγγραφή

    const { rerender } = renderHook<ReturnType<typeof useGridGuidePersistence>, UseGridGuidePersistenceParams>(
      (p) => useGridGuidePersistence(p),
      { initialProps: NO_SCOPE },
    );

    // Τοποθέτηση 4 οδηγών ΟΣΟ το scope είναι ελλιπές → service null → debounced save no-op.
    act(() => {
      mockGuideStore.__place([guide('gx1', 'X', 10), guide('gx2', 'X', 20), guide('gy1', 'Y', 5), guide('gy2', 'Y', 15)]);
    });
    await flushTimers();
    expect(mockService.createGrid).not.toHaveBeenCalled();

    // Το scope γίνεται έτοιμο → flush-on-ready persistάρει το pending batch.
    rerender(FULL);
    await flushTimers();

    expect(mockService.createGrid).toHaveBeenCalledTimes(1);
    const firstCreateCall = mockService.createGrid.mock.calls[0];
    expect(firstCreateCall).toBeDefined();
    expect(firstCreateCall![0].guides).toHaveLength(4);
  });

  it('remote-wins: αν υπάρχει remote doc, τα pending απορρίπτονται (no create, hydrate από remote)', async () => {
    mockService = makeService([remoteDoc('grd_remote', [guide('r1', 'X', 100), guide('r2', 'Y', 200)])]);

    const { rerender } = renderHook<ReturnType<typeof useGridGuidePersistence>, UseGridGuidePersistenceParams>(
      (p) => useGridGuidePersistence(p),
      { initialProps: NO_SCOPE },
    );
    act(() => { mockGuideStore.__place([guide('gx1', 'X', 10)]); });
    await flushTimers();

    rerender(FULL);
    await flushTimers();

    expect(mockService.createGrid).not.toHaveBeenCalled();
    expect(mockService.updateGrid).not.toHaveBeenCalled();
    expect(mockGuideStore.getGuides()).toHaveLength(2); // hydrated από το remote, pending dropped
  });

  it('δεν δημιουργεί κενό doc όταν δεν υπάρχουν οδηγοί', async () => {
    mockService = makeService([]);
    renderHook((p) => useGridGuidePersistence(p), { initialProps: FULL });
    await flushTimers();
    expect(mockService.createGrid).not.toHaveBeenCalled();
  });

  it('happy path: οδηγός με ΗΔΗ έτοιμο scope → κανονικό save (zero-regression)', async () => {
    mockService = makeService([]);
    renderHook((p) => useGridGuidePersistence(p), { initialProps: FULL });
    act(() => { mockGuideStore.__place([guide('gx1', 'X', 10)]); });
    await flushTimers();

    expect(mockService.createGrid).toHaveBeenCalledTimes(1);
    const happyPathCall = mockService.createGrid.mock.calls[0];
    expect(happyPathCall).toBeDefined();
    expect(happyPathCall![0].guides).toHaveLength(1);
  });

  it('ADR-420 resilience: durable floorId χωρίς floorplanId ΕΙΝΑΙ έγκυρο scope → service ready + persist', async () => {
    mockService = makeService([]);
    // File-less floor (cross-floor guard nulled fileRecordId) — used to block persistence.
    renderHook((p) => useGridGuidePersistence(p), { initialProps: { ...FULL, floorplanId: null } });
    act(() => { mockGuideStore.__place([guide('gx1', 'X', 10)]); });
    await flushTimers();

    expect(mockService.createGrid).toHaveBeenCalledTimes(1);
  });
});
