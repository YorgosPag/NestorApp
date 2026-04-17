/**
 * Unit tests — propagateEntityLabelRenameWithPolicy (Batch 30.1)
 *
 * Covers the real-time dispatch contract of the gateway wrapper:
 *  - API success with updatedFiles → RealtimeService.dispatch once per file
 *  - API success with empty / undefined updatedFiles → no dispatch
 *  - API failure (success:false) → no dispatch
 *  - apiClient throws → wrapper rethrows, no dispatch
 *
 * Boundaries mocked:
 *  - `@/lib/api/enterprise-api-client` (apiClient.request) — the JSON HTTP call
 *  - `@/services/realtime` (RealtimeService.dispatch) — the side effect under test
 *  - `@/lib/telemetry` (createModuleLogger) — silence logs
 *
 * NOTE: wrapper uses `await import('@/services/realtime')` (dynamic).
 * jest.mock replaces the module registry, so the dynamic import resolves
 * to the mock identically to a static import.
 */

// Break the transitive import chain — file-mutation-gateway re-exports many
// file-* services that transitively load firebase/auth (requires global.fetch).
// Only `propagateEntityLabelRenameWithPolicy` is under test; everything else
// gets a stub module so the file loads cleanly under jsdom.
jest.mock('@/services/file-folder.service', () => ({ FileFolderService: {} }));
jest.mock('@/services/document-template.service', () => ({ DocumentTemplateService: {} }));
jest.mock('@/services/file-comment.service', () => ({ FileCommentService: {} }));
jest.mock('@/services/file-approval.service', () => ({ FileApprovalService: {} }));
jest.mock('@/services/file-record.service', () => ({ FileRecordService: {} }));
jest.mock('@/services/file-share.service', () => ({ FileShareService: {} }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
  getAuth: jest.fn(() => ({ currentUser: null })),
}));

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

jest.mock('@/services/realtime', () => ({
  RealtimeService: {
    dispatch: jest.fn(),
    subscribe: jest.fn((_event: unknown, _cb: unknown) => jest.fn()),
  },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

import { propagateEntityLabelRenameWithPolicy } from '../file-mutation-gateway';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { RealtimeService } from '@/services/realtime';
import { API_ROUTES } from '@/config/domain-constants';

const apiRequestMock = apiClient.request as jest.Mock;
const dispatchMock = RealtimeService.dispatch as jest.Mock;

const baseInput = {
  entityType: 'property' as const,
  entityId: 'prop_1',
  newEntityLabel: 'Studio 40 m²',
};

describe('propagateEntityLabelRenameWithPolicy — RealtimeService dispatch contract', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    dispatchMock.mockReset();
  });

  test('dispatches FILE_UPDATED once per updatedFile on success', async () => {
    apiRequestMock.mockResolvedValue({
      success: true,
      updatedCount: 3,
      skippedCount: 0,
      updatedFiles: [
        { fileId: 'f1', newDisplayName: 'Θέα - Studio 40 m²' },
        { fileId: 'f2', newDisplayName: 'Κάτοψη - Studio 40 m²' },
        { fileId: 'f3', newDisplayName: 'Συμβόλαιο - Studio 40 m² - 01-01-2026' },
      ],
    });

    const result = await propagateEntityLabelRenameWithPolicy(baseInput);

    expect(result.success).toBe(true);
    expect(apiRequestMock).toHaveBeenCalledWith(
      API_ROUTES.FILES.PROPAGATE_ENTITY_RENAME,
      expect.objectContaining({
        method: 'POST',
        body: baseInput,
      }),
    );
    expect(dispatchMock).toHaveBeenCalledTimes(3);

    const calls = dispatchMock.mock.calls;
    for (const [eventKey, payload] of calls) {
      expect(eventKey).toBe('FILE_UPDATED');
      expect(payload).toMatchObject({
        fileId: expect.any(String),
        updates: { displayName: expect.any(String) },
        timestamp: expect.any(Number),
      });
    }

    const fileIds = calls.map(([, payload]) => payload.fileId).sort();
    expect(fileIds).toEqual(['f1', 'f2', 'f3']);
  });

  test('does NOT dispatch when updatedFiles is an empty array', async () => {
    apiRequestMock.mockResolvedValue({
      success: true,
      updatedCount: 0,
      skippedCount: 5,
      updatedFiles: [],
    });

    await propagateEntityLabelRenameWithPolicy(baseInput);

    expect(dispatchMock).not.toHaveBeenCalled();
  });

  test('does NOT dispatch when updatedFiles is undefined', async () => {
    apiRequestMock.mockResolvedValue({
      success: true,
      updatedCount: 0,
      skippedCount: 0,
    });

    await propagateEntityLabelRenameWithPolicy(baseInput);

    expect(dispatchMock).not.toHaveBeenCalled();
  });

  test('does NOT dispatch when response is success:false', async () => {
    apiRequestMock.mockResolvedValue({
      success: false,
      error: 'Forbidden',
      updatedFiles: [{ fileId: 'f1', newDisplayName: 'should-be-ignored' }],
    });

    const result = await propagateEntityLabelRenameWithPolicy(baseInput);

    expect(result.success).toBe(false);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  test('rethrows when apiClient.request throws, does NOT dispatch', async () => {
    apiRequestMock.mockRejectedValue(new Error('Network down'));

    await expect(propagateEntityLabelRenameWithPolicy(baseInput)).rejects.toThrow('Network down');
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});
