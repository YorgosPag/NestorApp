/**
 * ADR-895 Φ0 — άγκυρα: το πάγωμα αποδεικτικού διαβάζει την **πηγή** εκεί που λέει η εγγραφή της
 * (`storagePlacement`), ενώ το **αποδεικτικό** γράφεται πάντα στον κανονικό κάδο (Locked retention).
 *
 * Μεταλλάξεις που πρέπει να πιάσει: πηγή από τον κανονικό κάδο για εγγραφή ΕΕ · αποδεικτικό στον κάδο ΕΕ ·
 * άγνωστη θέση ⇒ σιωπηλό fallback αντί για `failed`.
 */

import { PassThrough, Readable, Writable } from 'stream';

class FakeObject {
  bytes: Buffer | null;
  constructor(bytes: Buffer | null) { this.bytes = bytes; }
}

class FakeBucket {
  readonly objects = new Map<string, FakeObject>();
  constructor(readonly name: string) {}
  put(path: string, bytes: Buffer): void { this.objects.set(path, new FakeObject(bytes)); }
  file(path: string) {
    const objects = this.objects;
    return {
      createReadStream(): Readable {
        const found = objects.get(path)?.bytes;
        if (!found) {
          const failing = new PassThrough();
          process.nextTick(() => failing.destroy(Object.assign(new Error('No such object'), { code: 404 })));
          return failing;
        }
        return Readable.from([found]);
      },
      createWriteStream(): Writable {
        const chunks: Buffer[] = [];
        return new Writable({
          write(chunk: Buffer, _enc, done) { chunks.push(chunk); done(); },
          final(done) { objects.set(path, new FakeObject(Buffer.concat(chunks))); done(); },
        });
      },
      async setMetadata(): Promise<void> { /* noop */ },
      async delete(): Promise<void> { objects.delete(path); },
    };
  }
  async getFiles(): Promise<[{ name: string }[]]> {
    return [[...this.objects.keys()].map((name) => ({ name }))];
  }
}

const legacyBucket = new FakeBucket('proj.firebasestorage.app');
const euBucket = new FakeBucket('proj-files-eu');

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminBucket: () => legacyBucket,
  getFilesEuBucket: () => euBucket,
}));

import { freezeAttestationEvidence } from '../attestation-evidence';

const SOURCE_PATH = 'companies/c1/entities/owner_property/ownp_a/domains/legal/files/file_1.pdf';
const CONTENT = Buffer.from('%PDF-1.7 consent');
const source = (storagePlacement?: unknown) =>
  ({ storagePath: SOURCE_PATH, contentType: 'application/pdf', fileName: 'x.pdf', storagePlacement });

beforeEach(() => {
  legacyBucket.objects.clear();
  euBucket.objects.clear();
});

describe('freezeAttestationEvidence — η πηγή από τον κάδο της εγγραφής (ADR-895)', () => {
  test('Π1 legacy εγγραφή ⇒ πηγή και αποδεικτικό στον κανονικό κάδο', async () => {
    legacyBucket.put(SOURCE_PATH, CONTENT);
    const frozen = await freezeAttestationEvidence(source(), 'ownp_a');
    expect(frozen.kind).toBe('frozen');
    if (frozen.kind !== 'frozen') return;
    expect(legacyBucket.objects.get(frozen.evidence.path)?.bytes).toEqual(CONTENT);
  });

  test('🔴 Π2 εγγραφή ΕΕ ⇒ η πηγή διαβάζεται από τον κάδο ΕΕ, το αποδεικτικό γράφεται στον κανονικό', async () => {
    euBucket.put(SOURCE_PATH, CONTENT);
    const frozen = await freezeAttestationEvidence(source('eu-originals'), 'ownp_a');
    expect(frozen.kind).toBe('frozen');
    if (frozen.kind !== 'frozen') return;
    expect(legacyBucket.objects.get(frozen.evidence.path)?.bytes).toEqual(CONTENT);
    expect(euBucket.objects.has(frozen.evidence.path)).toBe(false);
  });

  test('🔴 Π3 άγνωστη θέση ⇒ `failed`, κανένα αποδεικτικό πουθενά (ποτέ «κανονικός για ασφάλεια»)', async () => {
    legacyBucket.put(SOURCE_PATH, CONTENT);
    const frozen = await freezeAttestationEvidence(source('mars'), 'ownp_a');
    expect(frozen.kind).toBe('failed');
    expect([...legacyBucket.objects.keys()]).toEqual([SOURCE_PATH]);
    expect(euBucket.objects.size).toBe(0);
  });
});
