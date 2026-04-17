/**
 * Unit tests — useEntityFiles FILE_UPDATED subscriber contract (Batch 30.1)
 *
 * Verifies that when RealtimeService.dispatch('FILE_UPDATED', {...}) fires
 * (e.g. from propagateEntityLabelRenameWithPolicy), the hook patches the
 * matching file in local state without triggering a refetch.
 *
 * Boundaries mocked:
 *  - `@/services/realtime` — subscribe captures callbacks per event key
 *  - `@/services/file-record.service` — initial fetch returns fixtures
 *  - `@/services/firestore` — realtime listener disabled (realtime=false)
 *  - `@/services/filesystem/file-mutation-gateway` — mutation ops stubbed
 *  - `firebase/firestore` — `where` stubbed for import-time safety
 *  - `./useEntityFiles-purpose-filter` — pass-through (no purpose filter)
 */

jest.mock('firebase/firestore', () => ({
  where: jest.fn((...args: unknown[]) => ({ __where: args })),
}));

jest.mock('@/services/firestore', () => ({
  firestoreQueryService: {
    subscribe: jest.fn(() => jest.fn()),
  },
}));

jest.mock('@/services/filesystem/file-mutation-gateway', () => ({
  moveFileToTrashWithPolicy: jest.fn(),
  renameFileWithPolicy: jest.fn(),
  updateFileDescriptionWithPolicy: jest.fn(),
}));

jest.mock('@/services/file-record.service', () => ({
  FileRecordService: {
    getFilesByEntity: jest.fn(),
    getLinkedFiles: jest.fn().mockResolvedValue([]),
    isVisibleInActiveLists: () => true,
  },
}));

jest.mock('../useEntityFiles-purpose-filter', () => ({
  buildPurposeFilter: () => () => true,
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

// Subscribe: capture the callback for each event key so tests can dispatch
// manually. Record unsubscribe spies to assert cleanup.
type RealtimeCallback = (payload: unknown) => void;
const subscribers = new Map<string, RealtimeCallback>();
const unsubSpies = new Map<string, jest.Mock>();

jest.mock('@/services/realtime', () => ({
  RealtimeService: {
    dispatch: jest.fn(),
    subscribe: jest.fn((event: string, cb: RealtimeCallback) => {
      subscribers.set(event, cb);
      const spy = jest.fn();
      unsubSpies.set(event, spy);
      return spy;
    }),
  },
}));

import { renderHook, act, waitFor } from '@testing-library/react';
import { useEntityFiles } from '../useEntityFiles';
import { FileRecordService } from '@/services/file-record.service';
import type { FileRecord } from '@/types/file-record';

const mockedGetFilesByEntity = FileRecordService.getFilesByEntity as jest.MockedFunction<
  typeof FileRecordService.getFilesByEntity
>;

function makeFile(id: string, overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    id,
    companyId: 'comp_1',
    entityType: 'property',
    entityId: 'prop_1',
    displayName: `Display ${id}`,
    status: 'ready',
    lifecycleState: 'active',
    isDeleted: false,
    ...overrides,
  } as FileRecord;
}

beforeEach(() => {
  subscribers.clear();
  unsubSpies.clear();
  mockedGetFilesByEntity.mockReset();
});

describe('useEntityFiles — FILE_UPDATED subscriber', () => {
  test('patches displayName of matching file, leaves others untouched', async () => {
    mockedGetFilesByEntity.mockResolvedValue([
      makeFile('f1', { displayName: 'Θέα - Studio 35 m²' }),
      makeFile('f2', { displayName: 'Κάτοψη - Studio 35 m²' }),
      makeFile('f3', { displayName: 'unrelated' }),
    ]);

    const { result } = renderHook(() =>
      useEntityFiles({ entityType: 'property', entityId: 'prop_1', companyId: 'comp_1' }),
    );

    await waitFor(() => expect(result.current.files).toHaveLength(3));

    const handler = subscribers.get('FILE_UPDATED');
    expect(handler).toBeDefined();

    act(() => {
      handler!({
        fileId: 'f1',
        updates: { displayName: 'Θέα - Studio 40 m²' },
        timestamp: Date.now(),
      });
    });

    expect(result.current.files.find(f => f.id === 'f1')?.displayName).toBe('Θέα - Studio 40 m²');
    expect(result.current.files.find(f => f.id === 'f2')?.displayName).toBe('Κάτοψη - Studio 35 m²');
    expect(result.current.files.find(f => f.id === 'f3')?.displayName).toBe('unrelated');
  });

  test('no-op when fileId not in state', async () => {
    mockedGetFilesByEntity.mockResolvedValue([makeFile('f1', { displayName: 'keep' })]);

    const { result } = renderHook(() =>
      useEntityFiles({ entityType: 'property', entityId: 'prop_1', companyId: 'comp_1' }),
    );

    await waitFor(() => expect(result.current.files).toHaveLength(1));

    const handler = subscribers.get('FILE_UPDATED');

    act(() => {
      handler!({
        fileId: 'ghost_id',
        updates: { displayName: 'should be ignored' },
        timestamp: Date.now(),
      });
    });

    expect(result.current.files[0].displayName).toBe('keep');
  });

  test('narrows status string → typed FileRecord status on patch', async () => {
    mockedGetFilesByEntity.mockResolvedValue([
      makeFile('f1', { status: 'ready', displayName: 'old' }),
    ]);

    const { result } = renderHook(() =>
      useEntityFiles({ entityType: 'property', entityId: 'prop_1', companyId: 'comp_1' }),
    );

    await waitFor(() => expect(result.current.files).toHaveLength(1));

    const handler = subscribers.get('FILE_UPDATED');

    act(() => {
      handler!({
        fileId: 'f1',
        updates: { displayName: 'new', status: 'processing' },
        timestamp: Date.now(),
      });
    });

    const patched = result.current.files[0];
    expect(patched.displayName).toBe('new');
    expect(patched.status).toBe('processing');
  });

  test('unmount unsubscribes from FILE_UPDATED (no leak)', async () => {
    mockedGetFilesByEntity.mockResolvedValue([makeFile('f1')]);

    const { unmount, result } = renderHook(() =>
      useEntityFiles({ entityType: 'property', entityId: 'prop_1', companyId: 'comp_1' }),
    );

    await waitFor(() => expect(result.current.files).toHaveLength(1));

    const spy = unsubSpies.get('FILE_UPDATED');
    expect(spy).toBeDefined();
    expect(spy!).not.toHaveBeenCalled();

    unmount();

    expect(spy!).toHaveBeenCalledTimes(1);
  });
});
