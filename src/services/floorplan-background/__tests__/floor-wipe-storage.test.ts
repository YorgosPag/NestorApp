/**
 * ADR-895 Φ0 · ADR-899 §2.2.1 — άγκυρες του διχτυού ορφανών ενός ορόφου: η σάρωση προθέματος περνά **κάθε** κάδο του
 * καταλόγου που υπάρχει, και σβήνει **μόνο** ό,τι δεν ανήκει σε καμία εγγραφή — ποτέ πρωτότυπο ή συνοδευτικό εγγραφής
 * (κρατημένης, ή στην ουρά του purge: εκείνα τα σβήνει ο ΕΝΑΣ γραφέας, με κριτή δέσμευσης).
 *
 * Μεταλλάξεις που πρέπει να πιάσει: σάρωση μόνο του κανονικού κάδου · σάρωση που αγνοεί τον φρουρό · φρουρός που
 * ξεχνά τα συνοδευτικά (μόνο `=== storagePath`) · μη-προβλεπόμενος κάδος ΕΕ ⇒ αποτυχία.
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

import { claimedByFileRows, sweepFloorCategoryPath } from '../floor-wipe-storage';
import type { FileRow } from '../floor-wipe-queries';

const PREFIX = 'companies/c1/entities/floor/f1/domains/construction/categories/floorplans/';
const DIR = `${PREFIX}files/`;
const HELD_ID = 'file_held';
const HELD = `${DIR}${HELD_ID}.dxf`;
/** Τα συνοδευτικά του κρατημένου — ένα με όνομα **ολόκληρου** του πρωτοτύπου, ένα με **στέλεχος** (`{id}_…`). */
const HELD_COMPANIONS = [`${HELD}.thumbnail.png`, `${DIR}${HELD_ID}_thumb.webp`, `${DIR}${HELD_ID}.scene.json`];
const ORPHANS = [`${DIR}file_gone.dxf`, `${DIR}file_gone.dxf.processed.json`];

const rowOf = (id: string, storagePath: unknown): FileRow =>
  ({ ref: { id } as FileRow['ref'], data: { storagePath } });
const NOTHING_CLAIMED = claimedByFileRows([]);

beforeEach(() => {
  legacy = { exists: true, objects: new Set([HELD, ...HELD_COMPANIONS, ORPHANS[0]]) };
  eu = { exists: true, objects: new Set([HELD, ORPHANS[1]]) };
});

describe('claimedByFileRows — τι ανήκει σε εγγραφή', () => {
  const claim = claimedByFileRows([rowOf(HELD_ID, HELD), rowOf('file_no_bytes', null)]);

  test('🔴 Φ1 το πρωτότυπο ΚΑΙ κάθε συνοδευτικό του (ο ίδιος φρουρός με τον γραφέα του purge)', () => {
    expect([HELD, ...HELD_COMPANIONS].every(claim)).toBe(true);
  });

  test('Φ2 ό,τι δεν είναι κανενός ⇒ ορφανό', () => {
    expect(ORPHANS.some(claim)).toBe(false);
  });

  test('Φ3 όμοιο όνομα **άλλου** αρχείου ή άλλου φακέλου ⇒ όχι', () => {
    expect(claim(`${DIR}file_held2_thumb.webp`)).toBe(false);
    expect(claim(`${PREFIX}other/${HELD_ID}.dxf`)).toBe(false);
  });
});

describe('sweepFloorCategoryPath — σε κάθε κάδο του καταλόγου, μόνο ορφανά', () => {
  test('🔴 Σ1 σαρώνει και τους δύο κάδους', async () => {
    await expect(sweepFloorCategoryPath(PREFIX, NOTHING_CLAIMED)).resolves.toEqual({ deleted: 7, failed: 0, spared: 0 });
    expect(legacy.objects.size + eu.objects.size).toBe(0);
  });

  test('🔴 Σ2 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: τα bytes κρατημένης εγγραφής ΜΕΝΟΥΝ σε κάθε κάδο — σβήνονται μόνο τα ορφανά', async () => {
    const claim = claimedByFileRows([rowOf(HELD_ID, HELD)]);
    await expect(sweepFloorCategoryPath(PREFIX, claim)).resolves.toEqual({ deleted: 2, failed: 0, spared: 5 });
    expect([...legacy.objects].sort()).toEqual([HELD, ...HELD_COMPANIONS].sort());
    expect([...eu.objects]).toEqual([HELD]);
  });

  test('Σ3 ο κάδος ΕΕ πριν την προμήθεια ⇒ παραλείπεται, ΔΕΝ είναι αποτυχία', async () => {
    eu.exists = false;
    await expect(sweepFloorCategoryPath(PREFIX, NOTHING_CLAIMED)).resolves.toEqual({ deleted: 5, failed: 0, spared: 0 });
  });
});
