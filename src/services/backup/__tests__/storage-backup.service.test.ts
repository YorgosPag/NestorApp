/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ ADR-895 Α6** — το backup δεν έχει «τον κάδο», έχει έναν ΚΑΤΑΛΟΓΟ.
 *
 * | Άγκυρα | Υπόσχεση |
 * |---|---|
 * | 🔴 δύο προβλεπόμενοι κάδοι | ΚΑΘΕ αντικείμενο εξάγεται με το `placement` του δικού του κάδου, στο δικό του `storage/{placement}/…` |
 * | 🔴 μη-προβλεπόμενος κάδος ΕΕ | παραλείπεται με προειδοποίηση — η εξαγωγή ΔΕΝ σκάει (§2.3 Ρ4) |
 * | 🔴 ασυμφωνία θέσης | αντικείμενο σε κάδο Α με FileRecord που δηλώνει κάδο Β ⇒ **ορφανό**, όχι «γνωστό» |
 */

import { Readable, Writable } from 'stream';

import { StorageBackupService } from '../storage-backup.service';
import type { BackupGcsService } from '../backup-gcs.service';

interface FakeFileSpec {
  readonly name: string;
  readonly size: number;
  readonly content: string;
}

function fakeGcsFile(spec: FakeFileSpec) {
  return {
    name: spec.name,
    getMetadata: async () => [{ size: spec.size, contentType: 'application/pdf' }],
    createReadStream: () => Readable.from([Buffer.from(spec.content)]),
  };
}

function fakeBucket(exists: boolean, files: readonly FakeFileSpec[]) {
  return {
    exists: async () => [exists] as const,
    getFiles: async () => [files.map(fakeGcsFile)],
  };
}

interface FakeRecord {
  readonly id: string;
  readonly storagePath: string;
  readonly storagePlacement?: string;
}

let db: { readonly collection: () => unknown };

function useDb(records: readonly FakeRecord[]): void {
  db = {
    collection: () => ({
      select: () => ({
        get: async () => ({
          docs: records.map((r) => ({ id: r.id, data: () => ({ storagePath: r.storagePath, storagePlacement: r.storagePlacement }) })),
        }),
      }),
    }),
  };
}

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => db }));

function fakeGcsService(): BackupGcsService & { readonly written: Map<string, Buffer> } {
  const written = new Map<string, Buffer>();
  const service = {
    written,
    createWriteStream: (backupId: string, relativePath: string) => {
      const key = `${backupId}/${relativePath}`;
      const chunks: Buffer[] = [];
      return new Writable({
        write(chunk: Buffer, _enc, cb) { chunks.push(chunk); cb(); },
        final(cb) { written.set(key, Buffer.concat(chunks)); cb(); },
      });
    },
  };
  return service as unknown as BackupGcsService & { readonly written: Map<string, Buffer> };
}

const LEGACY_FILE: FakeFileSpec = { name: 'companies/c/legacy1.pdf', size: 3, content: 'leg' };
const EU_FILE: FakeFileSpec = { name: 'companies/c/eu1.pdf', size: 2, content: 'eu' };

describe('🏆 ADR-895 Α6 — StorageBackupService σαρώνει τον ΚΑΤΑΛΟΓΟ κάδων', () => {
  it('🔴 δύο προβλεπόμενοι κάδοι ⇒ κάθε entry με το ΔΙΚΟ του placement + backupFile με το τμήμα θέσης', async () => {
    useDb([
      { id: 'rec_legacy', storagePath: LEGACY_FILE.name },
      { id: 'rec_eu', storagePath: EU_FILE.name, storagePlacement: 'eu-originals' },
    ]);
    const catalogue = () => [
      { placement: 'legacy-default' as const, bucket: fakeBucket(true, [LEGACY_FILE]) as never },
      { placement: 'eu-originals' as const, bucket: fakeBucket(true, [EU_FILE]) as never },
    ];
    const service = new StorageBackupService(10, catalogue);
    const gcs = fakeGcsService();

    const result = await service.exportAllFiles('bkp1', gcs);

    expect(result.entries).toHaveLength(2);
    const legacyEntry = result.entries.find((e) => e.storagePath === LEGACY_FILE.name);
    const euEntry = result.entries.find((e) => e.storagePath === EU_FILE.name);
    expect(legacyEntry).toMatchObject({ placement: 'legacy-default', backupFile: 'storage/legacy-default/companies/c/legacy1.pdf', firestoreDocId: 'rec_legacy' });
    expect(euEntry).toMatchObject({ placement: 'eu-originals', backupFile: 'storage/eu-originals/companies/c/eu1.pdf', firestoreDocId: 'rec_eu' });
    expect(gcs.written.get('bkp1/storage/legacy-default/companies/c/legacy1.pdf')?.toString()).toBe('leg');
    expect(gcs.written.get('bkp1/storage/eu-originals/companies/c/eu1.pdf')?.toString()).toBe('eu');
  });

  it('🔴 κάδος ΕΕ μη-προβλεπόμενος ⇒ παραλείπεται με προειδοποίηση, ΔΕΝ σκάει η εξαγωγή (§2.3 Ρ4)', async () => {
    useDb([{ id: 'rec_legacy', storagePath: LEGACY_FILE.name }]);
    const catalogue = () => [
      { placement: 'legacy-default' as const, bucket: fakeBucket(true, [LEGACY_FILE]) as never },
      { placement: 'eu-originals' as const, bucket: fakeBucket(false, []) as never },
    ];
    const service = new StorageBackupService(10, catalogue);

    const result = await service.exportAllFiles('bkp2', fakeGcsService());

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.placement).toBe('legacy-default');
    expect(result.warnings.some((w) => w.includes('eu-originals') && w.includes('not provisioned'))).toBe(true);
  });

  it('🔴 αντικείμενο σε κάδο Α με FileRecord που δηλώνει κάδο Β ⇒ ορφανό (ΟΧΙ «γνωστό»)', async () => {
    // Το αρχείο ζει στον legacy κάδο, αλλά η εγγραφή στη βάση λέει `eu-originals` — δεν είναι δικό της.
    useDb([{ id: 'rec_mismatch', storagePath: LEGACY_FILE.name, storagePlacement: 'eu-originals' }]);
    const catalogue = () => [{ placement: 'legacy-default' as const, bucket: fakeBucket(true, [LEGACY_FILE]) as never }];
    const service = new StorageBackupService(10, catalogue);

    const result = await service.exportAllFiles('bkp3', fakeGcsService());

    expect(result.entries[0]?.firestoreDocId).toBeUndefined();
    expect(result.warnings.some((w) => w.includes('no matching FileRecord'))).toBe(true);
  });
});
