/**
 * @jest-environment node
 *
 * =============================================================================
 * 🔑 ΑΓΚΥΡΕΣ ΔΙΑΜΕΡΙΣΜΑΤΟΣ: ΓΡΑΦΕΑΣ ΕΚΚΑΘΑΡΙΣΗΣ + ΣΑΡΩΤΗΣ ΥΠΟΚΕΙΜΕΝΟΥ ΓΚΠΔ (ADR-866 §2.6.9)
 * =============================================================================
 *
 * | ομάδα | ερώτημα | μετάλλαξη που πιάνει |
 * |---|---|---|
 * | Γ | η λήξη γράφεται στη **συλλογή όπου ζει** το αρχείο; | `FILE_COLLECTION[custody]` → `COLLECTIONS.FILES` |
 * | Γ | γραμμή προσωπικού αρχείου στο **εταιρικό** βιβλίο; | αφαίρεση του φρουρού `custody !== 'company'` |
 * | Υ | η ΓΚΠΔ βλέπει **και τα δύο** διαμερίσματα; | `CUSTODY_KINDS` → `['company']` |
 * | Υ | ο μεσίτης σβήνει τον φάκελο του ιδιοκτήτη; | `FILE_SUBJECT_FIELD.personal` → `createdBy` |
 *
 * Πλαστά μόνο ο δίσκος (`FakeFirestore`) και το bucket — ο γραφέας και ο σαρωτής εκτελούνται αληθινά.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';

let fake: FakeFirestore;
let deletedObjects: string[] = [];

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
  getAdminStorage: () => ({
    bucket: () => ({
      file: (path: string) => ({
        delete: async (): Promise<void> => {
          deletedObjects.push(path);
        },
      }),
    }),
  }),
}));

jest.mock('@/services/enterprise-id.service', () => ({ generateAuditId: () => 'audit_test' }));

import { purgeFileRecord } from '../file-purge-helpers';
import { findSubjectFiles } from '../file-subject-scan';

const OWNER = 'uid_owner';
const BROKER = 'uid_broker';

beforeEach(() => {
  fake = new FakeFirestore();
  deletedObjects = [];
});

describe('Γ — ο γραφέας εκκαθάρισης ανά διαμέρισμα', () => {
  it('🔴 Γ1 — προσωπικό αρχείο: `purged` στο `files_personal`, ΚΑΜΙΑ γραμμή στο εταιρικό βιβλίο', async () => {
    fake.seed(COLLECTIONS.FILES_PERSONAL, 'file_p', { userId: OWNER, lifecycleState: 'trashed' });

    const result = await purgeFileRecord({
      fileId: 'file_p',
      custody: 'personal',
      storagePath: `people/${OWNER}/x.pdf`,
      performedBy: 'system:cron-purge',
      purgeReason: 'cron_trash',
    });

    expect(result).toEqual({ success: true, storageDeleted: true });
    expect(fake.all<{ lifecycleState: string }>(COLLECTIONS.FILES_PERSONAL)[0].lifecycleState).toBe('purged');
    expect(fake.all(COLLECTIONS.FILE_AUDIT_LOG)).toEqual([]);
    expect(deletedObjects).toEqual([`people/${OWNER}/x.pdf`]);
  });

  it('Γ2 — εταιρικό αρχείο: ό,τι ίσχυε — `purged` στο `files` ΚΑΙ γραμμή ίχνους', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_c', { companyId: 'comp_1', lifecycleState: 'trashed' });

    const result = await purgeFileRecord({
      fileId: 'file_c',
      custody: 'company',
      storagePath: undefined,
      performedBy: 'system:cron-purge',
      purgeReason: 'cron_trash',
    });

    expect(result.success).toBe(true);
    expect(fake.all<{ lifecycleState: string }>(COLLECTIONS.FILES)[0].lifecycleState).toBe('purged');
    expect(fake.all(COLLECTIONS.FILE_AUDIT_LOG)).toHaveLength(1);
  });

  it('🔴 Γ3 — λάθος διαμέρισμα ⇒ αποτυχία, ποτέ σιωπηλή εγγραφή αλλού', async () => {
    // Το προσωπικό αρχείο δεν υπάρχει στο `files`: η ενημέρωση **αποτυγχάνει** αντί να γεννήσει έγγραφο.
    fake.seed(COLLECTIONS.FILES_PERSONAL, 'file_p', { userId: OWNER });

    const result = await purgeFileRecord({
      fileId: 'file_p',
      custody: 'company',
      storagePath: undefined,
      performedBy: 'system:cron-purge',
      purgeReason: 'cron_trash',
    });

    expect(result.success).toBe(false);
    expect(fake.all(COLLECTIONS.FILES)).toEqual([]);
  });
});

describe('Υ — ο σαρωτής υποκειμένου ΓΚΠΔ', () => {
  it('🔴 Υ1 — βρίσκει τα αρχεία του ανθρώπου ΚΑΙ στα δύο διαμερίσματα, με το διαμέρισμα όπου βρέθηκαν', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_c', { companyId: 'comp_1', createdBy: OWNER });
    fake.seed(COLLECTIONS.FILES_PERSONAL, 'file_p', { userId: OWNER, createdBy: OWNER });

    const found = await findSubjectFiles(fake as unknown as AdminFirestore, OWNER);

    expect(found.map(({ custody, doc }) => [custody, doc.id]).sort()).toEqual([
      ['company', 'file_c'],
      ['personal', 'file_p'],
    ]);
  });

  it('🔑 Υ2 — προσωπικό διαμέρισμα κρίνεται από τον ΚΑΤΟΧΟ: ο συντάκτης-μεσίτης ΔΕΝ βρίσκει τον φάκελο', async () => {
    // Φ3 (ADR-866 Ε-3): ο μεσίτης ανεβάζει στον φάκελο του ιδιοκτήτη ⇒ `createdBy` = μεσίτης.
    fake.seed(COLLECTIONS.FILES_PERSONAL, 'file_p', { userId: OWNER, createdBy: BROKER });

    expect(await findSubjectFiles(fake as unknown as AdminFirestore, BROKER)).toEqual([]);
    expect((await findSubjectFiles(fake as unknown as AdminFirestore, OWNER)).map(({ doc }) => doc.id)).toEqual([
      'file_p',
    ]);
  });

  it('Υ3 — εταιρικό διαμέρισμα: ό,τι ίσχυε — ό,τι ανέβασε ο άνθρωπος (`createdBy`)', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_mine', { companyId: 'comp_1', createdBy: OWNER });
    fake.seed(COLLECTIONS.FILES, 'file_other', { companyId: 'comp_1', createdBy: BROKER });

    const found = await findSubjectFiles(fake as unknown as AdminFirestore, OWNER);

    expect(found.map(({ doc }) => doc.id)).toEqual(['file_mine']);
  });
});
