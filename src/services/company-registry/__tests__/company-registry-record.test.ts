/**
 * @jest-environment node
 *
 * @fileoverview Άγκυρες του **αποθηκευμένου αντιγράφου ΓΕΜΗ** — ADR-841 §7 Α23 (Φ1) · Α23.12.
 * @related services/company-registry/company-registry-record.service.ts
 *
 * ⚠️ `FakeFirestore` + ο **αληθινός** φρουρός (`parseStoredRegistryRecord`): ό,τι γράφεται
 * πρέπει να ξαναδιαβάζεται από τον **ίδιο** δρόμο που θα το διαβάσει η παραγωγή.
 *
 * 🔴 Α23.12: η γραφή **ξαναδιαβάζει το προφίλ μέσα στη συναλλαγή** — απάντηση για αριθμό που το προφίλ
 * δεν δηλώνει πια **δεν** γράφεται (Ρ6 · Ρ6β · Ρ6γ). Η διαγραφή ζει στο `company-registry-retention.test.ts`.
 */

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({}),
  safeFirestoreOperation: jest.fn(),
}));

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  readRegistryCheck,
  recordRegistryCheck,
} from '@/services/company-registry/company-registry-record.service';
import {
  REGISTRY_CHECKED_AT as CHECKED_AT,
  registryRecord,
} from '@/lib/company/__fixtures__/registry-record-fixture';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { givenCompanyProfile } from '@/services/mandate/__tests__/showcase-legal-fixture';

const COMPANY_ID = 'comp_registry_a';
const OTHER_NUMBER = '999999999000';

// 🔑 Λατινική επωνυμία ΜΗ κενή: ο φρουρός αποθήκης πρέπει να ξαναδιαβάζει ΚΑΘΕ πίνακα, όχι μόνο κενούς.
const RECORD = registryRecord({ legalNamesLatin: ['PAGONIS AE'] });

/** Προφίλ με τον **ίδιο** αριθμό με την απάντηση (`COMPANY_PROFILE` ⇄ `registryRecord`), εκτός αν ζητηθεί άλλο. */
function database(profile: Record<string, unknown> | null = {}) {
  const fake = new FakeFirestore();
  if (profile !== null) givenCompanyProfile(fake, COMPANY_ID, profile);
  return { fake, adminDb: fake as unknown as AdminFirestore };
}

describe('Ρ — γράφεται, ξαναδιαβάζεται', () => {
  it('Ρ1 — ό,τι γράφτηκε διαβάζεται ΙΔΙΟ από τον φρουρό της παραγωγής', async () => {
    const { adminDb } = database();
    await expect(recordRegistryCheck(adminDb, COMPANY_ID, RECORD, CHECKED_AT)).resolves.toEqual({
      record: RECORD,
      checkedAt: CHECKED_AT,
    });

    expect(await readRegistryCheck(adminDb, COMPANY_ID)).toEqual({
      kind: 'present',
      check: { record: RECORD, checkedAt: CHECKED_AT },
    });
  });

  it('Ρ2 — ποτέ δεν ρωτήθηκε ⇒ absent', async () => {
    const { adminDb } = database();
    expect(await readRegistryCheck(adminDb, COMPANY_ID)).toEqual({ kind: 'absent' });
  });

  it('Ρ3 — 🔑 η βάση δεν απαντά ⇒ unavailable, ΟΧΙ absent', async () => {
    const { fake, adminDb } = database();
    await recordRegistryCheck(adminDb, COMPANY_ID, RECORD, CHECKED_AT);
    fake.failReads = true;
    expect(await readRegistryCheck(adminDb, COMPANY_ID)).toEqual({ kind: 'unavailable' });
  });

  it('Ρ4 — 🔴 χαλασμένο αντίγραφο ⇒ unavailable (το έγγραφο ΥΠΑΡΧΕΙ)', async () => {
    const { fake, adminDb } = database();
    fake.seed(COLLECTIONS.COMPANY_REGISTRY_RECORDS, COMPANY_ID, {
      companyId: COMPANY_ID,
      checkedAt: CHECKED_AT,
      record: { ...RECORD, legalName: '' },
    });
    expect(await readRegistryCheck(adminDb, COMPANY_ID)).toEqual({ kind: 'unavailable' });
  });

  it('Ρ5 — άγνωστη πηγή στο αντίγραφο ⇒ unavailable (καμία «χειροκίνητη» επαλήθευση)', async () => {
    const { fake, adminDb } = database();
    fake.seed(COLLECTIONS.COMPANY_REGISTRY_RECORDS, COMPANY_ID, {
      companyId: COMPANY_ID,
      checkedAt: CHECKED_AT,
      record: { ...RECORD, source: 'admin-manual' },
    });
    expect(await readRegistryCheck(adminDb, COMPANY_ID)).toEqual({ kind: 'unavailable' });
  });

  it('Ρ7 — 🔴 το έγγραφο κρατά ΜΟΝΟ companyId · checkedAt · record — κανένα πεδίο προσώπου', async () => {
    const { fake, adminDb } = database();
    await recordRegistryCheck(adminDb, COMPANY_ID, RECORD, CHECKED_AT);
    const [stored] = fake.all<Record<string, unknown>>(COLLECTIONS.COMPANY_REGISTRY_RECORDS);
    expect(Object.keys(stored).sort()).toEqual(['checkedAt', 'companyId', 'record']);
    expect(JSON.stringify(stored)).not.toMatch(/persons|afm|capital/);
  });

  it('Ρ8 — νέα ερώτηση ΑΝΤΙΚΑΘΙΣΤΑ: τίτλος που αφαιρέθηκε από το μητρώο δεν επιζεί', async () => {
    const { adminDb } = database();
    await recordRegistryCheck(adminDb, COMPANY_ID, RECORD, CHECKED_AT);
    await recordRegistryCheck(adminDb, COMPANY_ID, { ...RECORD, distinctiveTitles: [] }, CHECKED_AT);
    const read = await readRegistryCheck(adminDb, COMPANY_ID);
    expect(read.kind === 'present' && read.check.record.distinctiveTitles).toEqual([]);
  });
});

describe('Ρ6 — ⚖️ Α23.12: απάντηση για αριθμό που το προφίλ ΔΕΝ δηλώνει πια δεν γράφεται', () => {
  it('🔴 Ρ6 — ο αριθμός του προφίλ άλλαξε ⇒ `null`, και ΚΑΜΙΑ γραφή', async () => {
    const { fake, adminDb } = database({ gemiNumber: OTHER_NUMBER });
    const writesBefore = fake.writes;

    await expect(recordRegistryCheck(adminDb, COMPANY_ID, RECORD, CHECKED_AT)).resolves.toBeNull();

    expect(await readRegistryCheck(adminDb, COMPANY_ID)).toEqual({ kind: 'absent' });
    expect(fake.writes).toBe(writesBefore);
  });

  it('🔴 Ρ6β — χωρίς προφίλ ή χωρίς αριθμό ⇒ δεν γράφεται (καμία απάντηση δεν αφορά «τίποτα»)', async () => {
    const noProfile = database(null);
    const noNumber = database({ gemiNumber: null });

    await expect(recordRegistryCheck(noProfile.adminDb, COMPANY_ID, RECORD, CHECKED_AT)).resolves.toBeNull();
    await expect(recordRegistryCheck(noNumber.adminDb, COMPANY_ID, RECORD, CHECKED_AT)).resolves.toBeNull();
    expect(noProfile.fake.all(COLLECTIONS.COMPANY_REGISTRY_RECORDS)).toHaveLength(0);
    expect(noNumber.fake.all(COLLECTIONS.COMPANY_REGISTRY_RECORDS)).toHaveLength(0);
  });

  it('🔴 Ρ6γ — RACE: ο άνθρωπος αλλάζει τον αριθμό ΑΝΑΜΕΣΑ σε ανάγνωση και δέσμευση ⇒ η συναλλαγή ξανατρέχει και ΔΕΝ γράφει', async () => {
    const { fake, adminDb } = database();
    fake.interfere = () => givenCompanyProfile(fake, COMPANY_ID, { gemiNumber: OTHER_NUMBER });

    await expect(recordRegistryCheck(adminDb, COMPANY_ID, RECORD, CHECKED_AT)).resolves.toBeNull();

    expect(fake.all(COLLECTIONS.COMPANY_REGISTRY_RECORDS)).toHaveLength(0);
  });
});
