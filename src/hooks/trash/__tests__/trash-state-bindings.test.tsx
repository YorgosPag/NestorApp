/**
 * Characterization + wiring lock for the four entity trash-state bindings
 * (ADR-281 / ADR-584).
 *
 * Written against the PRE-merge hooks and kept byte-identical across the merge
 * onto `useEntityTrashState`. That is the whole point: if these still pass
 * afterwards, behaviour did not change — a claim that would otherwise be
 * unfalsifiable, since none of the four hooks had a single test.
 *
 * What a copy-paste merge gets silently wrong is the binding, not the engine:
 * a hook pointed at the wrong trash route still compiles and still renders, it
 * just shows another entity's bin. So route, entity kind and the public return
 * key are asserted per hook, by name.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { TrashService } from '@/services/trash.service';
import { API_ROUTES } from '@/config/domain-constants';
import { useBuildingsTrashState } from '../../useBuildingsTrashState';
import { useParkingTrashState } from '../../useParkingTrashState';
import { useProjectsTrashState } from '../../useProjectsTrashState';
import { useStoragesTrashState } from '../../useStoragesTrashState';

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

jest.mock('@/services/trash.service', () => ({
  TrashService: { bulkRestore: jest.fn(), bulkPermanentDelete: jest.fn() },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

// Stable identities: the real useAuth serves these from context, so it must not
// hand back a fresh object per render — that would retrigger the mount fetch
// effect forever and the loop would look like a product bug.
const mockAuthValue = { user: { uid: 'u_1' }, loading: false } as const;
jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => mockAuthValue,
}));

const mockShowSuccess = jest.fn();
const mockNotifications = { success: mockShowSuccess, notify: jest.fn() };
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => mockNotifications,
}));

const mockTranslation = { t: (key: string) => key };
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => mockTranslation,
}));

const mockProjectRestored = jest.fn();
const mockProjectPermanentlyDeleted = jest.fn();
const mockProjectNotifications = {
  restored: mockProjectRestored,
  permanentlyDeleted: mockProjectPermanentlyDeleted,
};
jest.mock('@/hooks/notifications/useProjectNotifications', () => ({
  useProjectNotifications: () => mockProjectNotifications,
}));

const mockRealtimeUnsub = jest.fn();
jest.mock('@/services/realtime', () => ({
  RealtimeService: { subscribe: jest.fn(() => mockRealtimeUnsub) },
}));

const mockedGet = apiClient.get as jest.Mock;
const mockedBulkRestore = TrashService.bulkRestore as jest.Mock;
const mockedBulkPermanentDelete = TrashService.bulkPermanentDelete as jest.Mock;

/**
 * Each binding described by what actually differs between the four hooks: the
 * route it reads, the entity kind it sends to TrashService, the response key it
 * unwraps, and the name it exposes the list under.
 */
interface TrashBindingCase {
  name: string;
  route: string;
  entityKind: string;
  responseKey: string;
  listKey: string;
  restoreKey: string;
  permanentDeleteKey: string;
  render: (forceDataRefresh: () => void) => ReturnType<typeof renderHook>;
}

const CASES: TrashBindingCase[] = [
  {
    name: 'useBuildingsTrashState',
    route: API_ROUTES.BUILDINGS.TRASH,
    entityKind: 'building',
    responseKey: 'buildings',
    listKey: 'trashedBuildings',
    restoreKey: 'handleRestoreBuildings',
    permanentDeleteKey: 'handlePermanentDeleteBuildings',
    render: (forceDataRefresh) =>
      renderHook(() => useBuildingsTrashState({ forceDataRefresh })),
  },
  {
    name: 'useParkingTrashState',
    route: API_ROUTES.PARKING.TRASH,
    entityKind: 'parking',
    responseKey: 'parkingSpots',
    listKey: 'trashedParkingSpots',
    restoreKey: 'handleRestoreParkingSpots',
    permanentDeleteKey: 'handlePermanentDeleteParkingSpots',
    render: (forceDataRefresh) =>
      renderHook(() => useParkingTrashState({ forceDataRefresh })),
  },
  {
    name: 'useProjectsTrashState',
    route: API_ROUTES.PROJECTS.TRASH,
    entityKind: 'project',
    responseKey: 'projects',
    listKey: 'trashedProjects',
    restoreKey: 'handleRestoreProjects',
    permanentDeleteKey: 'handlePermanentDeleteProjects',
    render: (forceDataRefresh) =>
      renderHook(() => useProjectsTrashState({ forceDataRefresh })),
  },
  {
    name: 'useStoragesTrashState',
    route: API_ROUTES.STORAGES.TRASH,
    entityKind: 'storage',
    responseKey: 'storages',
    listKey: 'trashedStorages',
    restoreKey: 'handleRestoreStorages',
    permanentDeleteKey: 'handlePermanentDeleteStorages',
    render: (forceDataRefresh) =>
      renderHook(() => useStoragesTrashState({ forceDataRefresh })),
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockResolvedValue({ success: true, count: 0 });
  mockedBulkRestore.mockResolvedValue(undefined);
  mockedBulkPermanentDelete.mockResolvedValue(undefined);
});

describe.each(CASES)('$name — binding', (testCase) => {
  const { route, entityKind, responseKey, listKey, restoreKey, permanentDeleteKey, render } = testCase;

  type TrashHookResult = Record<string, unknown>;
  const resultOf = (r: { current: unknown }) => r.current as TrashHookResult;

  it('fetches its own trash route on mount once authenticated', async () => {
    render(jest.fn());
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith(route));
  });

  it('unwraps its own response key into the list it exposes', async () => {
    const item = { id: `${entityKind}_1` };
    mockedGet.mockResolvedValue({ success: true, [responseKey]: [item], count: 1 });

    const { result } = render(jest.fn());

    await waitFor(() => expect(resultOf(result)[listKey]).toEqual([item]));
    expect(resultOf(result).trashCount).toBe(1);
  });

  it('falls back to an empty list when the response omits its key', async () => {
    mockedGet.mockResolvedValue({ success: true, count: 0 });
    const { result } = render(jest.fn());
    await waitFor(() => expect(resultOf(result).loadingTrash).toBe(false));
    expect(resultOf(result)[listKey]).toEqual([]);
    expect(resultOf(result).trashCount).toBe(0);
  });

  it('swallows a fetch failure and empties the list rather than throwing', async () => {
    mockedGet.mockRejectedValue(new Error('network down'));
    const { result } = render(jest.fn());
    await waitFor(() => expect(resultOf(result).loadingTrash).toBe(false));
    expect(resultOf(result)[listKey]).toEqual([]);
  });

  it('restores through TrashService under its own entity kind', async () => {
    const { result } = render(jest.fn());
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    await act(async () => {
      await (resultOf(result)[restoreKey] as (ids: string[]) => Promise<void>)(['a', 'b']);
    });

    expect(mockedBulkRestore).toHaveBeenCalledWith(entityKind, ['a', 'b']);
  });

  it('ignores a restore with no ids — no service call', async () => {
    const { result } = render(jest.fn());
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    await act(async () => {
      await (resultOf(result)[restoreKey] as (ids: string[]) => Promise<void>)([]);
    });

    expect(mockedBulkRestore).not.toHaveBeenCalled();
  });

  it('stages ids and opens the confirm dialog instead of deleting immediately', async () => {
    const { result } = render(jest.fn());
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    act(() => {
      (resultOf(result)[permanentDeleteKey] as (ids: string[]) => void)(['x']);
    });

    expect(resultOf(result).showPermanentDeleteDialog).toBe(true);
    expect(resultOf(result).pendingPermanentDeleteIds).toEqual(['x']);
    expect(mockedBulkPermanentDelete).not.toHaveBeenCalled();
  });

  it('permanently deletes the staged ids under its own entity kind, then closes', async () => {
    const { result } = render(jest.fn());
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    act(() => {
      (resultOf(result)[permanentDeleteKey] as (ids: string[]) => void)(['x', 'y']);
    });
    await act(async () => {
      await (resultOf(result).handleConfirmPermanentDelete as () => Promise<void>)();
    });

    expect(mockedBulkPermanentDelete).toHaveBeenCalledWith(entityKind, ['x', 'y']);
    expect(resultOf(result).showPermanentDeleteDialog).toBe(false);
    expect(resultOf(result).pendingPermanentDeleteIds).toEqual([]);
  });

  it('closes the dialog and clears staged ids when the delete fails', async () => {
    mockedBulkPermanentDelete.mockRejectedValue(new Error('server said no'));
    const { result } = render(jest.fn());
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    act(() => {
      (resultOf(result)[permanentDeleteKey] as (ids: string[]) => void)(['x']);
    });
    await act(async () => {
      await (resultOf(result).handleConfirmPermanentDelete as () => Promise<void>)();
    });

    expect(resultOf(result).showPermanentDeleteDialog).toBe(false);
    expect(resultOf(result).pendingPermanentDeleteIds).toEqual([]);
  });

  it('cancelling discards the staged ids without calling the service', async () => {
    const { result } = render(jest.fn());
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    act(() => {
      (resultOf(result)[permanentDeleteKey] as (ids: string[]) => void)(['x']);
    });
    act(() => {
      (resultOf(result).handleCancelPermanentDelete as () => void)();
    });

    expect(resultOf(result).showPermanentDeleteDialog).toBe(false);
    expect(resultOf(result).pendingPermanentDeleteIds).toEqual([]);
    expect(mockedBulkPermanentDelete).not.toHaveBeenCalled();
  });

  it('toggling into the trash view refetches; toggling back out does not', async () => {
    const { result } = render(jest.fn());
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1));

    await act(async () => {
      await (resultOf(result).handleToggleTrash as () => Promise<void>)();
    });
    expect(resultOf(result).showTrash).toBe(true);
    expect(mockedGet).toHaveBeenCalledTimes(2);

    await act(async () => {
      await (resultOf(result).handleToggleTrash as () => Promise<void>)();
    });
    expect(resultOf(result).showTrash).toBe(false);
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });

  it('a completed trash action refreshes both the active list and the bin', async () => {
    const forceDataRefresh = jest.fn();
    const { result } = render(forceDataRefresh);
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1));

    await act(async () => {
      (resultOf(result).handleTrashActionComplete as () => void)();
    });

    expect(forceDataRefresh).toHaveBeenCalledTimes(1);
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });
});

describe('per-entity divergences the merge must not flatten', () => {
  beforeEach(() => {
    mockedGet.mockResolvedValue({ success: true, count: 0 });
  });

  it('projects notify through the project notification SSoT, not the generic trash toast', async () => {
    const { result } = renderHook(() => useProjectsTrashState({ forceDataRefresh: jest.fn() }));
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleRestoreProjects(['p1']);
    });

    expect(mockProjectRestored).toHaveBeenCalledTimes(1);
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });

  it('projects clear the selection on view switch and after an action', async () => {
    const clearSelection = jest.fn();
    const { result } = renderHook(() =>
      useProjectsTrashState({ forceDataRefresh: jest.fn(), clearSelection }),
    );
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleToggleTrash();
    });
    expect(clearSelection).toHaveBeenCalledTimes(1);

    clearSelection.mockClear();
    act(() => {
      result.current.handleTrashActionComplete();
    });
    expect(clearSelection).toHaveBeenCalledTimes(1);
  });

  it('buildings track an entity moved to the bin without a refetch, and de-duplicate it', async () => {
    const { result } = renderHook(() => useBuildingsTrashState({ forceDataRefresh: jest.fn() }));
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    const building = { id: 'bld_1' } as never;
    act(() => {
      result.current.onBuildingMovedToTrash(building);
    });
    expect(result.current.trashedBuildings).toEqual([building]);

    act(() => {
      result.current.onBuildingMovedToTrash(building);
    });
    expect(result.current.trashedBuildings).toEqual([building]);
    expect(result.current.trashCount).toBe(1);
  });

  it('storages refresh the bin when a storage is soft-deleted elsewhere (realtime)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RealtimeService } = require('@/services/realtime');
    renderHook(() => useStoragesTrashState({ forceDataRefresh: jest.fn() }));
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    expect(RealtimeService.subscribe).toHaveBeenCalledWith('STORAGE_DELETED', expect.any(Function));

    const handler = (RealtimeService.subscribe as jest.Mock).mock.calls[0][1] as () => void;
    await act(async () => {
      handler();
    });
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });

  it('storages notify on restore through the generic trash toast', async () => {
    const { result } = renderHook(() => useStoragesTrashState({ forceDataRefresh: jest.fn() }));
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleRestoreStorages(['s1']);
    });

    expect(mockShowSuccess).toHaveBeenCalledWith('restoreSuccess_one');
  });

  it('buildings notify on restore and pluralise by count', async () => {
    const { result } = renderHook(() => useBuildingsTrashState({ forceDataRefresh: jest.fn() }));
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleRestoreBuildings(['b1', 'b2']);
    });

    expect(mockShowSuccess).toHaveBeenCalledWith('restoreSuccess');
  });

  it('parking stays silent on restore — no toast channel bound', async () => {
    const { result } = renderHook(() => useParkingTrashState({ forceDataRefresh: jest.fn() }));
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleRestoreParkingSpots(['pk1']);
    });

    expect(mockShowSuccess).not.toHaveBeenCalled();
  });
});
