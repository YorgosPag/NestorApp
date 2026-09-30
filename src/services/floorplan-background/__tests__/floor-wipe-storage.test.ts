/**
 * ADR-895 Φ0 — άγκυρες: τα bytes ενός σβησμένου ορόφου σβήνονται **στον κάδο της εγγραφής τους**, και η σάρωση
 * προθέματος περνά **κάθε** κάδο του καταλόγου που υπάρχει.
 *
 * Μεταλλάξεις που πρέπει να πιάσει: διαγραφή στον κανονικό κάδο για εγγραφή ΕΕ · σάρωση μόνο του κανονικού ·
 * άγνωστη θέση ⇒ σιωπηλά «κανονικός» · μη-προβλεπόμενος κάδος ΕΕ ⇒ αποτυχία.
 */

interface FakeState { exists: boolean; objects: Set<string> }

function fakeBucket(state: FakeState) {
  return {
    exists: async () => [state.exists] as const,
    getFiles: async ({ prefix }: { prefix: string }) => [
      [...state.objects].filter((n) => n.startsWith(prefix)).map((name) => ({
        name,
        delete: async () => { state.objects.delete(name); },
      })),
    ] as const,
  };
}

let legacy: FakeState;
let eu: FakeState;

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminBucket: () => fakeBucket(legacy),
  getFilesEuBucket: () => fakeBucket(eu),
}));

import { deleteStorageObjects, sweepFloorCategoryPath } from '../floor-wipe-storage';
import type { FileRow } from '../floor-wipe-queries';

const PATH = 'companies/c1/entities/floor/f1/domains/construction/categories/floorplans/files/file_1.dxf';
const row = (storagePlacement?: unknown): FileRow =>
  ({ ref: {} as FileRow['ref'], storagePath: PATH, storagePlacement });

beforeEach(() => {
  legacy = { exists: true, objects: new Set([PATH, `${PATH}.processed.json`]) };
  eu = { exists: true, objects: new Set([PATH, `${PATH}.thumbnail.png`]) };
});

describe('deleteStorageObjects — στον κάδο της εγγραφής', () => {
  test('Δ1 legacy ⇒ σβήνει αρχείο + παράγωγα στον κανονικό, ο ΕΕ ανέπαφος', async () => {
    await expect(deleteStorageObjects([row()])).resolves.toEqual({ deleted: 2, failed: 0 });
    expect(legacy.objects.size).toBe(0);
    expect(eu.objects.size).toBe(2);
  });

  test('🔴 Δ2 εγγραφή ΕΕ ⇒ σβήνει στον ΕΕ, ΠΟΤΕ στον κανονικό', async () => {
    await expect(deleteStorageObjects([row('eu-originals')])).resolves.toEqual({ deleted: 2, failed: 0 });
    expect(eu.objects.size).toBe(0);
    expect(legacy.objects.size).toBe(2);
  });

  test('🔴 Δ3 άγνωστη θέση ⇒ μετριέται αποτυχία, τίποτα δεν σβήνεται πουθενά', async () => {
    await expect(deleteStorageObjects([row('mars')])).resolves.toEqual({ deleted: 0, failed: 1 });
    expect(legacy.objects.size + eu.objects.size).toBe(4);
  });
});

describe('sweepFloorCategoryPath — σε κάθε κάδο του καταλόγου', () => {
  const PREFIX = 'companies/c1/entities/floor/f1/domains/construction/categories/floorplans/';

  test('🔴 Σ1 σαρώνει και τους δύο κάδους', async () => {
    await expect(sweepFloorCategoryPath(PREFIX)).resolves.toEqual({ deleted: 4, failed: 0 });
    expect(legacy.objects.size + eu.objects.size).toBe(0);
  });

  test('Σ2 ο κάδος ΕΕ πριν την προμήθεια ⇒ παραλείπεται, ΔΕΝ είναι αποτυχία', async () => {
    eu.exists = false;
    await expect(sweepFloorCategoryPath(PREFIX)).resolves.toEqual({ deleted: 2, failed: 0 });
  });
});
