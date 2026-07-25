/**
 * =============================================================================
 * 🧪 TESTS: normalize-storage-paths migration operations (ADR-709)
 * =============================================================================
 *
 * @module api/admin/migrations/normalize-storage-paths/__tests__/storage-path-normalize-operations.test
 */

jest.mock('server-only', () => ({}));

import { rewriteDownloadUrl, moveRecordObjects, scanLegacyPaths, type LegacyPathRecord } from '../storage-path-normalize-operations';

const CANONICAL =
  'companies/c1/entities/project/proj_1/domains/construction/categories/floorplans/files/f1.pdf';
const LEGACY =
  'companies/c1/projects/proj_1/entities/project/proj_1/domains/construction/categories/floorplans/files/f1.pdf';

// ============================================================================
// SCAN
// ============================================================================

function fakeDb(docs: Array<{ id: string; storagePath?: string; downloadUrl?: string }>) {
  return {
    collection: () => ({
      get: async () => ({
        size: docs.length,
        docs: docs.map((d) => ({ id: d.id, data: () => ({ storagePath: d.storagePath, downloadUrl: d.downloadUrl }) })),
      }),
    }),
  } as never;
}

describe('scanLegacyPaths', () => {
  it('classifies legacy, canonical and unparseable records', async () => {
    const result = await scanLegacyPaths(
      fakeDb([
        { id: 'a', storagePath: LEGACY },
        { id: 'b', storagePath: CANONICAL },
        { id: 'c', storagePath: 'garbage/path' },
        { id: 'd' }, // storagePath missing entirely
      ])
    );

    expect(result.legacy).toHaveLength(1);
    expect(result.legacy[0].fileRecordId).toBe('a');
    expect(result.legacy[0].legacyProjectId).toBe('proj_1');
    expect(result.legacy[0].canonicalPath).toBe(CANONICAL);
    expect(result.alreadyCanonical).toBe(1);
    expect(result.unparseable.map((u) => u.fileRecordId)).toEqual(['c', 'd']);
  });

  it('ANCHOR: classification uses the SSoT parser, not a substring match', async () => {
    // A company literally named `projects` must NOT be mistaken for the legacy
    // tree — `storagePath.includes('/projects/')` would misfire here and move a
    // perfectly canonical file to a wrong destination.
    const canonicalUnderOddCompany =
      'companies/projects/entities/project/p1/domains/admin/categories/photos/files/f1.jpg';

    const result = await scanLegacyPaths(fakeDb([{ id: 'x', storagePath: canonicalUnderOddCompany }]));

    expect(result.legacy).toHaveLength(0);
    expect(result.alreadyCanonical).toBe(1);
  });
});

// ============================================================================
// DOWNLOAD URL
// ============================================================================

describe('rewriteDownloadUrl', () => {
  const url = (p: string) =>
    `https://firebasestorage.googleapis.com/v0/b/bucket/o/${encodeURIComponent(p)}?alt=media&token=tok-123`;

  it('repoints the encoded path and keeps the download token', () => {
    const rewritten = rewriteDownloadUrl(url(LEGACY), LEGACY, CANONICAL);

    expect(rewritten).toBe(url(CANONICAL));
    expect(rewritten).toContain('token=tok-123');
  });

  it('returns undefined when there is no URL', () => {
    expect(rewriteDownloadUrl(undefined, LEGACY, CANONICAL)).toBeUndefined();
  });

  it('leaves unrelated URLs untouched', () => {
    const foreign = 'https://cdn.example.com/whatever.pdf';
    expect(rewriteDownloadUrl(foreign, LEGACY, CANONICAL)).toBe(foreign);
  });
});

// ============================================================================
// MOVE
// ============================================================================

const record: LegacyPathRecord = {
  fileRecordId: 'rec_1',
  companyId: 'c1',
  legacyProjectId: 'proj_1',
  legacyPath: LEGACY,
  canonicalPath: CANONICAL,
};

function fakeBucket(opts: {
  sourceNames: string[];
  copyThrows?: boolean;
  destinationExists?: boolean;
}) {
  const deleted: string[] = [];
  const copiedTo: string[] = [];

  const bucket = {
    getFiles: async () => [
      opts.sourceNames.map((name) => ({
        name,
        copy: async (dest: { name: string }) => {
          if (opts.copyThrows) throw new Error('copy failed');
          copiedTo.push(dest.name);
        },
        delete: async () => {
          deleted.push(name);
        },
      })),
    ],
    file: (name: string) => ({
      name,
      exists: async () => [opts.destinationExists ?? true],
    }),
  } as never;

  return { bucket, deleted, copiedTo };
}

describe('moveRecordObjects', () => {
  it('moves the file and every derivation sharing its prefix', async () => {
    const { bucket, deleted, copiedTo } = fakeBucket({
      sourceNames: [LEGACY, `${LEGACY}.thumbnail.png`, `${LEGACY}.processed.json`],
    });

    const result = await moveRecordObjects(bucket, record);

    expect(result.error).toBeUndefined();
    expect(result.movedObjects).toBe(3);
    expect(copiedTo).toEqual([
      CANONICAL,
      `${CANONICAL}.thumbnail.png`,
      `${CANONICAL}.processed.json`,
    ]);
    expect(deleted).toHaveLength(3);
  });

  it('ANCHOR: never deletes the source when the copy failed', async () => {
    const { bucket, deleted } = fakeBucket({ sourceNames: [LEGACY], copyThrows: true });

    const result = await moveRecordObjects(bucket, record);

    expect(result.error).toBeDefined();
    expect(result.movedObjects).toBe(0);
    expect(deleted).toHaveLength(0);
  });

  it('ANCHOR: never deletes the source when the destination cannot be verified', async () => {
    // The dangerous case: copy() resolves but the object is not actually there.
    // Deleting here would destroy the only remaining copy.
    const { bucket, deleted } = fakeBucket({ sourceNames: [LEGACY], destinationExists: false });

    const result = await moveRecordObjects(bucket, record);

    expect(result.error).toContain('Copy verification failed');
    expect(deleted).toHaveLength(0);
  });

  it('reports zero moves when nothing exists at the legacy prefix', async () => {
    const { bucket } = fakeBucket({ sourceNames: [] });

    const result = await moveRecordObjects(bucket, record);

    expect(result.movedObjects).toBe(0);
    expect(result.error).toBeUndefined();
  });
});
