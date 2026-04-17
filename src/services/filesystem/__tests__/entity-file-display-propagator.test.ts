/**
 * Unit tests — EntityFileDisplayPropagator (Batch 30)
 *
 * Mocks firebaseAdmin + EntityAuditService to verify:
 *  - displayName string-replacement algorithm
 *  - skip path for already-renamed / mismatched / empty labels
 *  - writeBatch chunking at 500-doc Firestore limit
 *  - audit entry written exactly once on success
 */

jest.mock('@/lib/firebaseAdmin', () => {
  const batchCommitSpy = jest.fn().mockResolvedValue(undefined);
  const batchUpdateSpy = jest.fn();
  const commitSpy = batchCommitSpy;
  const updateSpy = batchUpdateSpy;

  const docFactory = (id: string) => ({ id, __isRef: true });
  const snapshotDocs: Array<{
    id: string;
    data: () => Record<string, unknown>;
  }> = [];

  const collectionMock = {
    where: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({
      get empty() { return snapshotDocs.length === 0; },
      docs: snapshotDocs,
    }),
    doc: jest.fn((id: string) => docFactory(id)),
  };

  const dbMock = {
    collection: jest.fn().mockReturnValue(collectionMock),
    batch: jest.fn(() => ({
      update: updateSpy,
      commit: commitSpy,
    })),
  };

  return {
    getAdminFirestore: jest.fn(() => dbMock),
    FieldValue: { serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP_SENTINEL') },
    __testControls: {
      setSnapshotDocs: (docs: Array<{ id: string; data: Record<string, unknown> }>) => {
        snapshotDocs.length = 0;
        for (const d of docs) {
          snapshotDocs.push({ id: d.id, data: () => d.data });
        }
      },
      batchUpdateSpy,
      batchCommitSpy,
      resetSpies: () => {
        batchUpdateSpy.mockClear();
        batchCommitSpy.mockClear();
      },
    },
  };
});

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: {
    recordChange: jest.fn().mockResolvedValue('audit_1'),
  },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

import { EntityFileDisplayPropagator } from '../entity-file-display-propagator.service';
import { EntityAuditService } from '@/services/entity-audit.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const firebaseAdminMock = require('@/lib/firebaseAdmin') as {
  __testControls: {
    setSnapshotDocs: (docs: Array<{ id: string; data: Record<string, unknown> }>) => void;
    batchUpdateSpy: jest.Mock;
    batchCommitSpy: jest.Mock;
    resetSpies: () => void;
  };
};

function fileDoc(overrides: Partial<Record<string, unknown>> & { id: string }) {
  return {
    id: overrides.id,
    data: {
      companyId: 'company_1',
      entityType: 'property',
      entityId: 'prop_1',
      status: 'ready',
      lifecycleState: 'active',
      isDeleted: false,
      ...overrides,
    },
  };
}

const baseParams = {
  entityType: 'property' as const,
  entityId: 'prop_1',
  companyId: 'company_1',
  performedBy: 'user_1',
  performedByName: 'user@example.com',
};

describe('EntityFileDisplayPropagator.propagate', () => {
  beforeEach(() => {
    firebaseAdminMock.__testControls.resetSpies();
    (EntityAuditService.recordChange as jest.Mock).mockClear();
  });

  test('renames three files that all share the old entity label', async () => {
    firebaseAdminMock.__testControls.setSnapshotDocs([
      fileDoc({ id: 'f1', displayName: 'Θέα - Studio 35 m²', entityLabel: 'Studio 35 m²' }),
      fileDoc({ id: 'f2', displayName: 'Κάτοψη - Studio 35 m²', entityLabel: 'Studio 35 m²' }),
      fileDoc({ id: 'f3', displayName: 'Συμβόλαιο - Studio 35 m² - 01-01-2026', entityLabel: 'Studio 35 m²' }),
    ]);

    const result = await EntityFileDisplayPropagator.propagate({
      ...baseParams,
      newEntityLabel: 'Appartamento deluxe',
    });

    expect(result.updatedCount).toBe(3);
    expect(result.skippedCount).toBe(0);
    expect(result.oldEntityLabel).toBe('Studio 35 m²');
    expect(result.updatedFiles).toEqual([
      { fileId: 'f1', newDisplayName: 'Θέα - Appartamento deluxe' },
      { fileId: 'f2', newDisplayName: 'Κάτοψη - Appartamento deluxe' },
      { fileId: 'f3', newDisplayName: 'Συμβόλαιο - Appartamento deluxe - 01-01-2026' },
    ]);
    expect(firebaseAdminMock.__testControls.batchUpdateSpy).toHaveBeenCalledTimes(3);
    expect(firebaseAdminMock.__testControls.batchCommitSpy).toHaveBeenCalledTimes(1);

    const firstUpdate = firebaseAdminMock.__testControls.batchUpdateSpy.mock.calls[0];
    expect(firstUpdate[1]).toEqual(expect.objectContaining({
      displayName: 'Θέα - Appartamento deluxe',
      entityLabel: 'Appartamento deluxe',
    }));

    expect(EntityAuditService.recordChange).toHaveBeenCalledTimes(1);
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'property',
        entityId: 'prop_1',
        action: 'updated',
        changes: [expect.objectContaining({
          field: 'files_cascade_rename',
          oldValue: 'Studio 35 m²',
          newValue: 'Appartamento deluxe',
        })],
      }),
    );
  });

  test('skips files whose entityLabel already matches the new label', async () => {
    firebaseAdminMock.__testControls.setSnapshotDocs([
      fileDoc({ id: 'f1', displayName: 'Θέα - Appartamento', entityLabel: 'Appartamento' }),
    ]);

    const result = await EntityFileDisplayPropagator.propagate({
      ...baseParams,
      newEntityLabel: 'Appartamento',
    });

    expect(result.updatedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(firebaseAdminMock.__testControls.batchCommitSpy).not.toHaveBeenCalled();
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });

  test('chunks writes to 500-doc batches for large datasets (600 docs → 2 batches)', async () => {
    const docs = Array.from({ length: 600 }, (_, i) => fileDoc({
      id: `f_${i}`,
      displayName: `Θέα - Old - ${i}`,
      entityLabel: 'Old',
    }));
    firebaseAdminMock.__testControls.setSnapshotDocs(docs);

    const result = await EntityFileDisplayPropagator.propagate({
      ...baseParams,
      newEntityLabel: 'New',
    });

    expect(result.updatedCount).toBe(600);
    expect(result.skippedCount).toBe(0);
    expect(result.updatedFiles).toHaveLength(600);
    expect(result.updatedFiles[0]).toEqual({ fileId: 'f_0', newDisplayName: 'Θέα - New - 0' });
    expect(firebaseAdminMock.__testControls.batchCommitSpy).toHaveBeenCalledTimes(2);
    expect(firebaseAdminMock.__testControls.batchUpdateSpy).toHaveBeenCalledTimes(600);
  });

  test('no-op when no FileRecord found — no audit entry written', async () => {
    firebaseAdminMock.__testControls.setSnapshotDocs([]);

    const result = await EntityFileDisplayPropagator.propagate({
      ...baseParams,
      newEntityLabel: 'New label',
    });

    expect(result.updatedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.oldEntityLabel).toBeNull();
    expect(result.updatedFiles).toEqual([]);
    expect(firebaseAdminMock.__testControls.batchCommitSpy).not.toHaveBeenCalled();
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });

  test('skips file whose displayName does not contain the stored entityLabel', async () => {
    firebaseAdminMock.__testControls.setSnapshotDocs([
      fileDoc({ id: 'f1', displayName: 'totally unrelated text', entityLabel: 'Old' }),
      fileDoc({ id: 'f2', displayName: 'Θέα - Old', entityLabel: 'Old' }),
    ]);

    const result = await EntityFileDisplayPropagator.propagate({
      ...baseParams,
      newEntityLabel: 'New',
    });

    expect(result.updatedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(firebaseAdminMock.__testControls.batchUpdateSpy).toHaveBeenCalledTimes(1);
    expect(EntityAuditService.recordChange).toHaveBeenCalledTimes(1);
  });

  test('throws when newEntityLabel is empty', async () => {
    await expect(
      EntityFileDisplayPropagator.propagate({
        ...baseParams,
        newEntityLabel: '   ',
      }),
    ).rejects.toThrow('newEntityLabel cannot be empty');
  });
});
