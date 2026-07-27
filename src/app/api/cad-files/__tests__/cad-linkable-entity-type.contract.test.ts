/**
 * Contract tests — the CAD-linkable entity-type set is ONE list (ADR-288).
 *
 * Incident 2026-07-27: `FilesContextSchema.entityType` held its own inline copy of
 * the union and that copy omitted `'project'`. Every project-scoped scene save hit
 * `POST /api/cad-files` → zod reject → 400 "Validation failed", while the Storage
 * upload had already succeeded — so the scene survived a reload but its version,
 * checksum and audit trail silently stopped advancing. A test asserting only
 * `'project'` would close the sample and leave the class open: the next member
 * added to the types and forgotten in the validator fails exactly the same way.
 *
 * These tests are therefore parametric over CAD_LINKABLE_ENTITY_TYPES — every
 * member must survive the validator AND resolve an entityId in the writer.
 */

interface CapturedSet {
  payload: Record<string, unknown>;
}

const captured: CapturedSet[] = [];

jest.mock('server-only', () => ({}));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({
      doc: () => ({
        set: (payload: Record<string, unknown>) => {
          captured.push({ payload });
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

import {
  CAD_LINKABLE_ENTITY_TYPES,
  ENTITY_TYPES,
  isCadLinkableEntityType,
  type CadLinkableEntityType,
} from '@/config/domain-constants';
import { UpsertCadFileSchema } from '../cad-files.schemas';
import { writeToFilesCollection } from '../dual-write-to-files';

/** Ids the writer resolves from, keyed by the field each entity type reads. */
const CONTEXT_IDS = {
  projectId: 'proj_1',
  buildingId: 'bld_1',
  floorId: 'flr_1',
} as const;

function buildPayload(entityType: CadLinkableEntityType) {
  return {
    fileId: 'file_1',
    fileName: 'plan.dxf',
    storageUrl: 'https://example/plan.dxf',
    storagePath: 'companies/comp_1/plan.dxf',
    sizeBytes: 100,
    entityCount: 5,
    checksum: 'a1b2c3d4e5f60718',
    context: {
      ...CONTEXT_IDS,
      entityType,
      filesCategory: 'floorplans' as const,
      canonicalScenePath: 'companies/comp_1/plan.scene.json',
    },
  };
}

describe('CAD-linkable entity types — one list, every member honoured', () => {
  it('is a subset of ENTITY_TYPES (no orphan string ever enters the set)', () => {
    const all: readonly string[] = Object.values(ENTITY_TYPES);
    for (const t of CAD_LINKABLE_ENTITY_TYPES) {
      expect(all).toContain(t);
    }
  });

  it.each(CAD_LINKABLE_ENTITY_TYPES)(
    'the API validator accepts context.entityType="%s"',
    (entityType) => {
      const parsed = UpsertCadFileSchema.safeParse(buildPayload(entityType));
      expect(parsed.success).toBe(true);
    }
  );

  it.each(CAD_LINKABLE_ENTITY_TYPES)(
    'the FileRecord writer resolves a real entityId for "%s" (never "standalone")',
    async (entityType) => {
      captured.length = 0;
      await writeToFilesCollection({
        fileId: 'file_1',
        fileName: 'plan.dxf',
        downloadUrl: 'https://example/scene.json',
        sizeBytes: 100,
        entityCount: 5,
        version: 1,
        companyId: 'comp_1',
        createdBy: 'user_1',
        isCreate: true,
        context: {
          ...CONTEXT_IDS,
          entityType,
          filesCategory: 'floorplans',
          canonicalScenePath: 'companies/comp_1/plan.scene.json',
        },
      });

      expect(captured).toHaveLength(1);
      const payload = captured[0].payload;
      expect(payload.entityType).toBe(entityType);
      expect(payload.entityId).not.toBe('standalone');
      expect(typeof payload.entityId).toBe('string');
      expect(payload.entityId as string).not.toHaveLength(0);
    }
  );

  it('rejects entity types the CAD pipeline cannot link', () => {
    const notLinkable = (Object.values(ENTITY_TYPES) as string[]).filter(
      (t) => !(CAD_LINKABLE_ENTITY_TYPES as readonly string[]).includes(t)
    );
    // Guard the guard: if the sets ever coincide this test would vacuously pass.
    expect(notLinkable.length).toBeGreaterThan(0);

    for (const entityType of notLinkable) {
      const parsed = UpsertCadFileSchema.safeParse(
        buildPayload(entityType as CadLinkableEntityType)
      );
      expect(parsed.success).toBe(false);
      expect(isCadLinkableEntityType(entityType)).toBe(false);
    }
  });

  it.each(CAD_LINKABLE_ENTITY_TYPES)('isCadLinkableEntityType("%s") is true', (t) => {
    expect(isCadLinkableEntityType(t)).toBe(true);
  });

  it.each([undefined, null, '', 'PROJECT', 42, {}])(
    'isCadLinkableEntityType rejects non-member %p',
    (value) => {
      expect(isCadLinkableEntityType(value)).toBe(false);
    }
  );

  it('context.entityType stays optional (auto-save omits it and must still validate)', () => {
    const payload = buildPayload('project');
    const { entityType: _omitted, ...contextWithoutType } = payload.context;
    const parsed = UpsertCadFileSchema.safeParse({ ...payload, context: contextWithoutType });
    expect(parsed.success).toBe(true);
  });
});
