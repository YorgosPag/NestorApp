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
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
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
import { placeFileHold, releaseFileHold, type HoldableBucket, type HoldBucketResolver } from '../file-hold.service';

const COMPANY = 'c_alpha';
const actor = { uid: 'u_admin', owner: { companyId: COMPANY } };
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

/** Ένα σταθερό ψεύτικο bucket για ΚΑΘΕ θέση — οι περισσότερες άγκυρες δεν διαφοροποιούν θέση. */
const oneBucket = (bucket: HoldableBucket): HoldBucketResolver => () => bucket;

const place = (bucketOf: HoldBucketResolver, fileId = 'file_v2') =>
  placeFileHold({ actor, fileId, holdType: 'legal', reason: 'αγωγή 123/2026' }, bucketOf);

beforeEach(() => jest.clearAllMocks());

describe('🏆 Α44 — όλη η στοίβα, βάση ΚΑΙ bytes', () => {
  it('🔴 δέσμευση στην κεφαλή ⇒ δεσμεύεται ΚΑΙ η προηγούμενη έκδοση, και η πλατφόρμα αρνείται διαγραφή', async () => {
    const { bucket } = world();

    const outcome = await place(oneBucket(bucket));

    expect(outcome).toEqual({ kind: 'placed', fileIds: expect.arrayContaining(['file_v1', 'file_v2']) });
    expect(await holdOf('file_v1')).toBe('legal');
    expect(await holdOf('file_v2')).toBe('legal');
    expect(bucket.objects.get(pathOf('file_v1'))?.hold).toBe(true);
    await expect(bucket.file(pathOf('file_v1')).delete({ ignoreNotFound: true })).rejects.toThrow(/hold/);
    expect(recordFileAudit).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'file_v1', action: 'hold_place', companyId: COMPANY }));
  });

  it('🔴 δεύτερη δέσμευση ⇒ `already-held`, ποτέ σιωπηλή αντικατάσταση', async () => {
    const { bucket } = world();
    await place(oneBucket(bucket));

    const second = await placeFileHold({ actor, fileId: 'file_v1', holdType: 'admin', reason: 'άλλο' }, oneBucket(bucket));

    expect(second).toEqual({ kind: 'already-held', holdType: 'legal' });
    expect(await holdOf('file_v2')).toBe('legal');
  });

  it('🔑 ξένος μισθωτής ⇒ `not-found`', async () => {
    const { bucket } = world();
    expect(await placeFileHold({ actor: { ...actor, owner: { companyId: 'c_beta' } }, fileId: 'file_v2', holdType: 'legal', reason: 'x' }, oneBucket(bucket)))
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

    expect(await place(oneBucket(failing))).toEqual({ kind: 'failed' });
    expect(await holdOf('file_v1')).toBeUndefined();
    expect(await holdOf('file_v2')).toBeUndefined();
    expect(bucket.objects.get(pathOf('file_v2'))?.hold).toBe(false);
  });

  it('🔴 ταυτόχρονη νικήτρια ⇒ η χαμένη ΔΕΝ ξεκλειδώνει τα bytes της νικήτριας', async () => {
    const { bucket } = world();
    fake.interfere = () => {
      fake.write(COLLECTIONS.FILES, 'file_v2', { ...JSON.parse(fake.snapshotOf(COLLECTIONS.FILES, 'file_v2')), hold: 'regulatory' });
    };

    expect(await place(oneBucket(bucket))).toEqual({ kind: 'already-held', holdType: 'regulatory' });
    expect(bucket.objects.get(pathOf('file_v1'))?.hold).toBe(true);
    expect(bucket.objects.get(pathOf('file_v2'))?.hold).toBe(true);
  });
});

describe('🏆 Α46 — αποδέσμευση', () => {
  it('🔴 βάση `none` + ίχνος + bytes ελεύθερα · δεύτερη φορά ⇒ `not-held`', async () => {
    const { bucket } = world();
    await place(oneBucket(bucket));

    const released = await releaseFileHold({ actor, fileId: 'file_v1' }, oneBucket(bucket));

    expect(released).toEqual({ kind: 'released', fileIds: expect.arrayContaining(['file_v1', 'file_v2']) });
    expect(await holdOf('file_v1')).toBe('none');
    expect(bucket.objects.get(pathOf('file_v1'))?.hold).toBe(false);
    expect(recordFileAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'hold_release' }));
    expect(await releaseFileHold({ actor, fileId: 'file_v1' }, oneBucket(bucket))).toEqual({ kind: 'not-held' });
  });

  it('🔴 μισή αποτυχία (βάση ελεύθερη, bytes κλειδωμένα) ⇒ η επανάληψη ξεκλειδώνει', async () => {
    const { bucket } = world();
    await bucket.file(pathOf('file_v1')).setMetadata({ temporaryHold: true });

    expect(await releaseFileHold({ actor, fileId: 'file_v2' }, oneBucket(bucket))).toEqual({ kind: 'not-held' });
    expect(bucket.objects.get(pathOf('file_v1'))?.hold).toBe(false);
  });
});

describe('🏆 ADR-895 — στοίβα με εκδόσεις σε ΔΙΑΦΟΡΕΤΙΚΟΥΣ κάδους (μετάβαση εν εξελίξει)', () => {
  it('🔴 δέσμευση σε στοίβα με v1=legacy-default + v2=eu-originals ⇒ ΚΑΘΕ έκδοση κλειδώνει στον ΔΙΚΟ της κάδο', async () => {
    fake = new FakeFirestore();
    seed('file_v1', { lifecycleState: 'archived', supersededByFileId: 'file_v2' });
    seed('file_v2', { createdAt: '2026-09-10T10:00:00.000Z', storagePlacement: 'eu-originals' });
    const legacyBucket = new FakeEvidenceBucket();
    const euBucket = new FakeEvidenceBucket();
    legacyBucket.put(pathOf('file_v1'), 'v1');
    euBucket.put(pathOf('file_v2'), 'v2');
    const bucketOf: HoldBucketResolver = (placement) => (placement === 'eu-originals' ? euBucket : legacyBucket);

    const outcome = await placeFileHold({ actor, fileId: 'file_v2', holdType: 'legal', reason: 'αγωγή' }, bucketOf);

    expect(outcome).toEqual({ kind: 'placed', fileIds: expect.arrayContaining(['file_v1', 'file_v2']) });
    expect(legacyBucket.objects.get(pathOf('file_v1'))?.hold).toBe(true);
    expect(euBucket.objects.get(pathOf('file_v2'))?.hold).toBe(true);
    // 🔒 Ποτέ διασταύρωση: το v1 ΔΕΝ υπάρχει στον κάδο ΕΕ, το v2 ΔΕΝ υπάρχει στον κάδο legacy.
    expect(euBucket.objects.has(pathOf('file_v1'))).toBe(false);
    expect(legacyBucket.objects.has(pathOf('file_v2'))).toBe(false);

    const released = await releaseFileHold({ actor, fileId: 'file_v1' }, bucketOf);
    expect(released).toEqual({ kind: 'released', fileIds: expect.arrayContaining(['file_v1', 'file_v2']) });
    expect(legacyBucket.objects.get(pathOf('file_v1'))?.hold).toBe(false);
    expect(euBucket.objects.get(pathOf('file_v2'))?.hold).toBe(false);
  });
});

describe('🏆 ADR-864 §21.9 · ADR-901 Φ4.4 (Α26) — δέσμευση στο ΠΡΟΣΩΠΙΚΟ διαμέρισμα (σταλμένη έκδοση transmittal)', () => {
  const AUTHOR = 'u_notary';
  const personalPath = (id: string): string => `people/${AUTHOR}/files/${id}.pdf`;
  const author = { uid: AUTHOR, owner: { userId: AUTHOR } };

  function personalWorld(): FakeEvidenceBucket {
    fake = new FakeFirestore();
    fake.seed(COLLECTIONS.FILES_PERSONAL, 'pfile_1', {
      id: 'pfile_1', userId: AUTHOR, createdBy: AUTHOR, status: 'ready', lifecycleState: 'active', isDeleted: false,
      displayName: 'draft', originalFilename: 'draft.pdf', ext: 'pdf', contentType: 'application/pdf', sizeBytes: 100,
      entityType: 'conveyance_case', entityId: 'cvc_1', domain: 'legal', category: 'contracts',
      storagePath: personalPath('pfile_1'), createdAt: '2026-10-01T10:00:00.000Z',
    });
    const bucket = new FakeEvidenceBucket();
    bucket.put(personalPath('pfile_1'), 'draft');
    return bucket;
  }

  async function personalHoldOf(id: string): Promise<unknown> {
    const snapshot = await (fake as unknown as AdminFirestore).collection(COLLECTIONS.FILES_PERSONAL).doc(id).get();
    return snapshot.data()?.hold;
  }

  it('🔴 ο κάτοχος `{ userId }` δεσμεύει το ΔΙΚΟ του αρχείο — βάση στο `files_personal` ΚΑΙ bytes', async () => {
    const bucket = personalWorld();

    const outcome = await placeFileHold({ actor: author, fileId: 'pfile_1', holdType: 'admin', reason: 'transmittal ctb_1' }, oneBucket(bucket));

    expect(outcome).toEqual({ kind: 'placed', fileIds: ['pfile_1'] });
    expect(await personalHoldOf('pfile_1')).toBe('admin');
    expect(bucket.objects.get(personalPath('pfile_1'))?.hold).toBe(true);
    expect(recordFileAudit).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'pfile_1', action: 'hold_place', userId: AUTHOR }));
  });

  it('🔑 άλλος άνθρωπος — ή εταιρεία — δεν βρίσκει το προσωπικό αρχείο ⇒ `not-found`', async () => {
    const bucket = personalWorld();
    expect(await placeFileHold({ actor: { uid: 'u_other', owner: { userId: 'u_other' } }, fileId: 'pfile_1', holdType: 'admin', reason: 'x' }, oneBucket(bucket)))
      .toEqual({ kind: 'not-found' });
    expect(await placeFileHold({ actor, fileId: 'pfile_1', holdType: 'admin', reason: 'x' }, oneBucket(bucket)))
      .toEqual({ kind: 'not-found' });
  });

  it('🔴 αποδέσμευση: η βάση ελευθερώνεται ΚΑΙ τα bytes', async () => {
    const bucket = personalWorld();
    await placeFileHold({ actor: author, fileId: 'pfile_1', holdType: 'admin', reason: 'transmittal ctb_1' }, oneBucket(bucket));

    expect(await releaseFileHold({ actor: author, fileId: 'pfile_1' }, oneBucket(bucket))).toEqual({ kind: 'released', fileIds: ['pfile_1'] });
    expect(await personalHoldOf('pfile_1')).toBe('none');
    expect(bucket.objects.get(personalPath('pfile_1'))?.hold).toBe(false);
  });
});
