/**
 * Unit tests — writeToFilesCollection write-once identity (ADR-420 / ADR-399).
 *
 * Incident 2026-06-16: a floor file's `entityId` was re-derived from the volatile
 * per-save `context.floorId` on EVERY merge-update, so a stale `saveContext.floorId`
 * drifted it to ANOTHER floor (storagePath stayed correct) → cross-floor guard
 * false-positive → BIM never persisted. The fix: write the entity-linking identity
 * (`entityType`/`entityId`/`projectId`) ONLY on the create write (`isCreate`).
 */

interface CapturedSet {
  payload: Record<string, unknown>;
  options: unknown;
}

const captured: CapturedSet[] = [];

jest.mock('server-only', () => ({}));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({
      doc: () => ({
        set: (payload: Record<string, unknown>, options: unknown) => {
          captured.push({ payload, options });
          return Promise.resolve();
        },
      }),
    }),
  }),
  FieldValue: { serverTimestamp: () => '__TS__' },
}));

jest.mock('@/config/firestore-collections', () => ({ COLLECTIONS: { FILES: 'files' } }));

jest.mock('@/services/upload/utils/file-display-name', () => ({
  buildFileDisplayName: () => ({ displayName: 'display' }),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

jest.mock('@/lib/error-utils', () => ({ getErrorMessage: (e: unknown) => String(e) }));

import { writeToFilesCollection } from '../dual-write-to-files';

const baseParams = {
  fileId: 'file_1',
  fileName: 'plan.dxf',
  downloadUrl: 'https://example/scene.json',
  sizeBytes: 100,
  entityCount: 5,
  version: 1,
  companyId: 'comp_1',
  createdBy: 'user_1',
  context: {
    projectId: 'proj_1',
    floorId: 'flr_correct',
    entityType: 'floor' as const,
    filesCategory: 'floorplans' as const,
    canonicalScenePath: 'companies/comp_1/.../file_1.scene.json',
  },
};

describe('writeToFilesCollection — write-once entity identity', () => {
  beforeEach(() => { captured.length = 0; });

  it('writes entityType/entityId/projectId on CREATE (isCreate=true)', async () => {
    await writeToFilesCollection({ ...baseParams, isCreate: true });
    expect(captured).toHaveLength(1);
    const { payload, options } = captured[0];
    expect(payload.entityType).toBe('floor');
    expect(payload.entityId).toBe('flr_correct');
    expect(payload.projectId).toBe('proj_1');
    expect(options).toEqual({ merge: true });
  });

  it('does NOT write entityType/entityId/projectId on UPDATE (isCreate=false) — preserves creation-time identity', async () => {
    // Simulate a later auto-save carrying a STALE floorId — it must NOT leak through.
    await writeToFilesCollection({
      ...baseParams,
      version: 7,
      isCreate: false,
      context: { ...baseParams.context, floorId: 'flr_STALE_other_floor' },
    });
    expect(captured).toHaveLength(1);
    const { payload } = captured[0];
    expect(payload.entityType).toBeUndefined();
    expect(payload.entityId).toBeUndefined();
    expect(payload.projectId).toBeUndefined();
    // Non-identity metadata still updates (e.g. revision).
    expect(payload.revision).toBe(7);
  });

  it('treats a missing isCreate flag as update (safe default — never drift identity)', async () => {
    await writeToFilesCollection({ ...baseParams });
    const { payload } = captured[0];
    expect(payload.entityId).toBeUndefined();
    expect(payload.entityType).toBeUndefined();
  });

  it('throws when canonicalScenePath is missing (ADR-293)', async () => {
    await expect(
      writeToFilesCollection({
        ...baseParams,
        isCreate: true,
        context: { ...baseParams.context, canonicalScenePath: undefined },
      }),
    ).rejects.toThrow(/canonicalScenePath/);
  });
});
