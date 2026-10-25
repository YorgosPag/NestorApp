/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 Φ-Δ.7β — **το ΕΝΑ σημείο soft delete**: μέτρηση soft-deleted γενιάς · επαναφορά **μόνο** σε κενό
 *   όνομα · επαναδιαγραφή **μόνο** της γενιάς που δόθηκε. Πάνω στον ΕΝΑ ψεύτικο κάδο. Όλα τα δεδομένα συνθετικά.
 */

import type { Bucket } from '@google-cloud/storage';

import { deleteLiveGeneration, restoreIntoVacantName, statSoftDeleted } from '@/server/storage/soft-deleted-object.server';
import { fakeGcsBucket, type FakeGcsStore } from '@/test-utils/fake-gcs/fake-gcs-bucket';

jest.mock('server-only', () => ({}));

const PATH = 'companies/comp_alfa/files/f_plan.pdf';
const store: FakeGcsStore = new Map();
const fake = fakeGcsBucket(store, 'default');
const bucket = fake as unknown as Bucket;

beforeEach(async () => {
  store.clear();
  fake.softDeleted.clear();
  store.set(PATH, { crc32c: 'crc_plan', size: 10, generation: 5, bytes: Buffer.alloc(10, 'p') });
  await fake.file(PATH).delete();
});

describe('Φ-Δ.7β — soft-deleted γενιά: μόνο μεταδεδομένα, μόνο η ζητούμενη', () => {
  it('η σβησμένη γενιά βρίσκεται με crc32c + μέγεθος · άλλη γενιά ⇒ `null` (ποτέ «η πιο πρόσφατη»)', async () => {
    expect((await statSoftDeleted(bucket, PATH, '5'))?.metadata).toMatchObject({ crc32c: 'crc_plan', size: 10, generation: 5 });
    expect(await statSoftDeleted(bucket, PATH, '6')).toBeNull();
  });

  it('🔴 αλλοιωμένη γενιά ⇒ πετά (ποτέ αίτημα με `NaN` / 0)', async () => {
    await expect(statSoftDeleted(bucket, PATH, 'πέντε')).rejects.toThrow(/generation/);
    await expect(restoreIntoVacantName(bucket, PATH, '0')).rejects.toThrow(/generation/);
  });
});

describe('Φ-Δ.7β — επαναφορά μόνο σε κενό όνομα', () => {
  it('κενό όνομα ⇒ νέα ζωντανή γενιά με τα ίδια bytes · η γενιά από την ΑΠΑΝΤΗΣΗ (ποτέ από νέα ανάγνωση του ονόματος)', async () => {
    const outcome = await restoreIntoVacantName(bucket, PATH, '5');
    expect(store.get(PATH)).toMatchObject({ crc32c: 'crc_plan', size: 10 });
    expect(store.get(PATH)?.generation).not.toBe(5);
    expect(outcome).toEqual({ kind: 'restored', generation: String(store.get(PATH)?.generation) });
  });

  it('🔴 ζωντανό στο όνομα ⇒ `live-exists` και ΤΙΠΟΤΑ δεν γράφεται από πάνω', async () => {
    const live = { crc32c: 'crc_other', size: 3, generation: 9, bytes: Buffer.alloc(3, 'x') };
    store.set(PATH, live);
    expect(await restoreIntoVacantName(bucket, PATH, '5')).toEqual({ kind: 'live-exists' });
    expect(store.get(PATH)).toEqual(live);
  });

  it('ανύπαρκτη soft-deleted γενιά (έληξε) ⇒ `absent`', async () => {
    expect(await restoreIntoVacantName(bucket, PATH, '77')).toEqual({ kind: 'absent' });
  });
});

describe('Φ-Δ.7β — επαναδιαγραφή μόνο της δοσμένης γενιάς', () => {
  it('🔴 άλλη ζωντανή γενιά ⇒ `changed` και ΔΕΝ σβήνεται · ίδια ⇒ `deleted` · απούσα ⇒ `gone`', async () => {
    await restoreIntoVacantName(bucket, PATH, '5');
    const generation = String(store.get(PATH)?.generation);
    expect(await deleteLiveGeneration(bucket, PATH, '5')).toBe('changed');
    expect(store.has(PATH)).toBe(true);
    expect(await deleteLiveGeneration(bucket, PATH, generation)).toBe('deleted');
    expect(store.has(PATH)).toBe(false);
    expect(await deleteLiveGeneration(bucket, PATH, generation)).toBe('gone');
  });
});
