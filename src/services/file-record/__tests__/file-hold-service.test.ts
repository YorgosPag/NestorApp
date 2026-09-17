/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ Α44-Α46 του ADR-864 §21** — ο ΕΝΑΣ γραφέας δέσμευσης αρχείου.
 *
 * | Άγκυρα | Υπόσχεση |
 * |---|---|
 * | Α44 | η δέσμευση πιάνει **όλη** τη στοίβα εκδόσεων — βάση **και** bytes (GCS `temporaryHold`) |
 * | Α45 | **ποτέ** «δεσμευμένο στη βάση, ελεύθερο στο bucket»: αποτυχία bytes ⇒ τίποτα στη βάση · ταυτόχρονη νικήτρια ⇒ τα bytes της μένουν κλειδωμένα |
 * | Α46 | αποδέσμευση: βάση πρώτα, bytes μετά — και **ιδεμπότητη** επιδιόρθωση μισής αποτυχίας |
 *
 * ⚠️ Γνήσιοι: γραφέας, στοίβα εκδόσεων, συναλλαγή (πλαστός που **ξαναεκτελεί** σε σύγκρουση).
 * Πλαστά: Firestore στη μνήμη, bucket στη μνήμη, ίχνος.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { FakeEvidenceBucket } from '@/services/mandate/__tests__/fake-evidence-bucket';

let fake: FakeFirestore;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
  getAdminBucket: () => { throw new Error('the anchors inject their own bucket'); },
}));
jest.mock('@/services/file-audit-admin.service', () => ({
  recordFileAudit: jest.fn(async () => 'audit_test'),
}));

import { recordFileAudit } from '@/services/file-audit-admin.service';
import { placeFileHold, releaseFileHold, type HoldableBucket } from '../file-hold.service';

const COMPANY = 'c_alpha';
const actor = { uid: 'u_admin', companyId: COMPANY };
const pathOf = (id: string): string => `companies/${COMPANY}/files/${id}.pdf`;

function seed(id: string, extra: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.FILES, id, {
    id, companyId: COMPANY, createdBy: 'u_author', status: 'ready', lifecycleState: 'active',
    isDeleted: false, cdeReadReach: 'tenant', displayName: id, originalFilename: `${id}.pdf`, ext: 'pdf',
    contentType: 'application/pdf', sizeBytes: 100, entityType: 'contact', entityId: 'contact_1', domain: 'crm',
    category: 'documents', storagePath: pathOf(id), createdAt: '2026-09-01T10:00:00.000Z', ...extra,
  });
}

/** v1 (αντικαταστάθηκε από v2) → v2 (κεφαλή) — και τα bytes τους στο bucket. */
function world(): { bucket: FakeEvidenceBucket } {
  fake = new FakeFirestore();
  seed('file_v1', { lifecycleState: 'archived', supersededByFileId: 'file_v2' });
  seed('file_v2', { createdAt: '2026-09-10T10:00:00.000Z' });
  const bucket = new FakeEvidenceBucket();
  bucket.put(pathOf('file_v1'), 'v1');
  bucket.put(pathOf('file_v2'), 'v2');
  return { bucket };
}

async function holdOf(id: string): Promise<unknown> {
  const snapshot = await (fake as unknown as AdminFirestore).collection(COLLECTIONS.FILES).doc(id).get();
  return snapshot.data()?.hold;
}

const place = (bucket: HoldableBucket, fileId = 'file_v2') =>
  placeFileHold({ actor, fileId, holdType: 'legal', reason: 'αγωγή 123/2026' }, bucket);

beforeEach(() => jest.clearAllMocks());

describe('🏆 Α44 — όλη η στοίβα, βάση ΚΑΙ bytes', () => {
  it('🔴 δέσμευση στην κεφαλή ⇒ δεσμεύεται ΚΑΙ η προηγούμενη έκδοση, και η πλατφόρμα αρνείται διαγραφή', async () => {
    const { bucket } = world();

    const outcome = await place(bucket);

    expect(outcome).toEqual({ kind: 'placed', fileIds: expect.arrayContaining(['file_v1', 'file_v2']) });
    expect(await holdOf('file_v1')).toBe('legal');
    expect(await holdOf('file_v2')).toBe('legal');
    expect(bucket.objects.get(pathOf('file_v1'))?.hold).toBe(true);
    await expect(bucket.file(pathOf('file_v1')).delete({ ignoreNotFound: true })).rejects.toThrow(/hold/);
    expect(recordFileAudit).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'file_v1', action: 'hold_place', companyId: COMPANY }));
  });

  it('🔴 δεύτερη δέσμευση ⇒ `already-held`, ποτέ σιωπηλή αντικατάσταση', async () => {
    const { bucket } = world();
    await place(bucket);

    const second = await placeFileHold({ actor, fileId: 'file_v1', holdType: 'admin', reason: 'άλλο' }, bucket);

    expect(second).toEqual({ kind: 'already-held', holdType: 'legal' });
    expect(await holdOf('file_v2')).toBe('legal');
  });

  it('🔑 ξένος μισθωτής ⇒ `not-found`', async () => {
    const { bucket } = world();
    expect(await placeFileHold({ actor: { ...actor, companyId: 'c_beta' }, fileId: 'file_v2', holdType: 'legal', reason: 'x' }, bucket))
      .toEqual({ kind: 'not-found' });
  });
});

describe('🏆 Α45 — ποτέ «δεσμευμένο στη βάση, ελεύθερο στο bucket»', () => {
  it('🔴 η πλατφόρμα αρνείται το hold ⇒ τίποτα στη βάση, και όσα κλειδώθηκαν ξεκλειδώνονται', async () => {
    const { bucket } = world();
    const failing: HoldableBucket = {
      file: (path) => (path === pathOf('file_v1')
        ? { setMetadata: async (patch) => { if (patch.temporaryHold) throw new Error('403'); } }
        : bucket.file(path)),
    };

    expect(await place(failing)).toEqual({ kind: 'failed' });
    expect(await holdOf('file_v1')).toBeUndefined();
    expect(await holdOf('file_v2')).toBeUndefined();
    expect(bucket.objects.get(pathOf('file_v2'))?.hold).toBe(false);
  });

  it('🔴 ταυτόχρονη νικήτρια ⇒ η χαμένη ΔΕΝ ξεκλειδώνει τα bytes της νικήτριας', async () => {
    const { bucket } = world();
    fake.interfere = () => {
      fake.write(COLLECTIONS.FILES, 'file_v2', { ...JSON.parse(fake.snapshotOf(COLLECTIONS.FILES, 'file_v2')), hold: 'regulatory' });
    };

    expect(await place(bucket)).toEqual({ kind: 'already-held', holdType: 'regulatory' });
    expect(bucket.objects.get(pathOf('file_v1'))?.hold).toBe(true);
    expect(bucket.objects.get(pathOf('file_v2'))?.hold).toBe(true);
  });
});

describe('🏆 Α46 — αποδέσμευση', () => {
  it('🔴 βάση `none` + ίχνος + bytes ελεύθερα · δεύτερη φορά ⇒ `not-held`', async () => {
    const { bucket } = world();
    await place(bucket);

    const released = await releaseFileHold({ actor, fileId: 'file_v1' }, bucket);

    expect(released).toEqual({ kind: 'released', fileIds: expect.arrayContaining(['file_v1', 'file_v2']) });
    expect(await holdOf('file_v1')).toBe('none');
    expect(bucket.objects.get(pathOf('file_v1'))?.hold).toBe(false);
    expect(recordFileAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'hold_release' }));
    expect(await releaseFileHold({ actor, fileId: 'file_v1' }, bucket)).toEqual({ kind: 'not-held' });
  });

  it('🔴 μισή αποτυχία (βάση ελεύθερη, bytes κλειδωμένα) ⇒ η επανάληψη ξεκλειδώνει', async () => {
    const { bucket } = world();
    await bucket.file(pathOf('file_v1')).setMetadata({ temporaryHold: true });

    expect(await releaseFileHold({ actor, fileId: 'file_v2' }, bucket)).toEqual({ kind: 'not-held' });
    expect(bucket.objects.get(pathOf('file_v1'))?.hold).toBe(false);
  });
});
