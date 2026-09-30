/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ ADR-895 Α6** — το restore γράφει κάθε entry στον κάδο ΠΟΥ ΛΕΕΙ το manifest.
 *
 * | Άγκυρα | Υπόσχεση |
 * |---|---|
 * | 🔴 entry `eu-originals` | επαναφέρεται στον κάδο ΕΕ, ΠΟΤΕ στον κανονικό |
 * | 🔴 παλιό manifest χωρίς `placement` | επαναφέρεται στον legacy κάδο (η ίδια σημασία με `FileRecord.storagePlacement`) |
 * | 🔴 άγνωστο `placement` | το entry αποτυγχάνει (fail-closed) — ΚΑΝΕΝΑΣ κάδος δεν γράφεται σιωπηλά |
 */

import { Readable, Writable } from 'stream';
import { createHash } from 'crypto';

import { StorageRestoreService } from '../storage-restore.service';
import type { BackupGcsService } from '../backup-gcs.service';
import type { StorageManifestEntry } from '../backup-manifest.types';

interface FakeStoredFile {
  exists: boolean;
  written: Buffer | null;
}

/** Πλαστός κάδος-στόχος: μιμείται `.file(path)` → `{exists, getMetadata, createWriteStream, delete}`. */
function fakeTargetBucket(store: Map<string, FakeStoredFile>) {
  return {
    file: (path: string) => ({
      exists: async () => [store.get(path)?.exists ?? false] as const,
      getMetadata: async () => [{ metadata: {} }],
      createWriteStream: () => {
        const chunks: Buffer[] = [];
        return new Writable({
          write(chunk: Buffer, _enc, cb) { chunks.push(chunk); cb(); },
          final(cb) {
            store.set(path, { exists: true, written: Buffer.concat(chunks) });
            cb();
          },
        });
      },
      delete: async () => { store.delete(path); },
    }),
  };
}

let legacyStore: Map<string, FakeStoredFile>;
let euStore: Map<string, FakeStoredFile>;

jest.mock('@/server/files/file-record-bucket', () => ({
  fileStorageBucket: (placement: 'legacy-default' | 'eu-originals') =>
    placement === 'eu-originals' ? fakeTargetBucket(euStore) : fakeTargetBucket(legacyStore),
}));

function fakeGcsService(content: string): BackupGcsService {
  return {
    createReadStream: () => Readable.from([Buffer.from(content)]),
  } as unknown as BackupGcsService;
}

beforeEach(() => {
  legacyStore = new Map();
  euStore = new Map();
});

function entry(overrides: Partial<StorageManifestEntry> & Pick<StorageManifestEntry, 'storagePath' | 'sha256'>): StorageManifestEntry {
  return { sizeBytes: 3, contentType: 'application/pdf', backupFile: `storage/${overrides.storagePath}`, ...overrides };
}

describe('🏆 ADR-895 Α6 — StorageRestoreService γράφει στον κάδο ΠΟΥ ΛΕΕΙ το manifest', () => {
  it('🔴 entry `eu-originals` ⇒ γράφεται στον κάδο ΕΕ, ΠΟΤΕ στον κανονικό', async () => {
    const service = new StorageRestoreService();
    const sha256 = createHash('sha256').update('abc').digest('hex');
    const entries = [entry({ storagePath: 'companies/c/eu1.pdf', sha256, placement: 'eu-originals', backupFile: 'storage/eu-originals/companies/c/eu1.pdf' })];

    const result = await service.restoreAllFiles('bkp1', entries, fakeGcsService('abc'));

    expect(result).toMatchObject({ restored: 1, failed: 0 });
    expect(euStore.get('companies/c/eu1.pdf')?.written?.toString()).toBe('abc');
    expect(legacyStore.has('companies/c/eu1.pdf')).toBe(false);
  });

  it('🔴 παλιό manifest χωρίς `placement` ⇒ γράφεται στον legacy κάδο', async () => {
    const service = new StorageRestoreService();
    const sha256 = createHash('sha256').update('leg').digest('hex');
    const entries = [entry({ storagePath: 'companies/c/legacy1.pdf', sha256, backupFile: 'storage/companies/c/legacy1.pdf' })];

    const result = await service.restoreAllFiles('bkp2', entries, fakeGcsService('leg'));

    expect(result).toMatchObject({ restored: 1, failed: 0 });
    expect(legacyStore.get('companies/c/legacy1.pdf')?.written?.toString()).toBe('leg');
    expect(euStore.size).toBe(0);
  });

  it('🔴 άγνωστο `placement` ⇒ το entry αποτυγχάνει, ΚΑΝΕΝΑΣ κάδος δεν γράφεται σιωπηλά', async () => {
    const service = new StorageRestoreService();
    const entries = [entry({ storagePath: 'companies/c/x.pdf', sha256: 'deadbeef', placement: 'mars-originals' as StorageManifestEntry['placement'] })];

    const result = await service.restoreAllFiles('bkp3', entries, fakeGcsService('x'));

    expect(result).toMatchObject({ restored: 0, failed: 1 });
    expect(legacyStore.size).toBe(0);
    expect(euStore.size).toBe(0);
  });
});
