/**
 * @jest-environment node
 *
 * @fileoverview Άγκυρες του **αποθηκευμένου αντιγράφου ΓΕΜΗ** — ADR-841 §7 Α23 (Φ1).
 * @related services/company-registry/company-registry-record.service.ts
 *
 * ⚠️ `FakeFirestore` + ο **αληθινός** φρουρός (`parseStoredRegistryRecord`): ό,τι γράφεται
 * πρέπει να ξαναδιαβάζεται από τον **ίδιο** δρόμο που θα το διαβάσει η παραγωγή.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  forgetRegistryCheck,
  readRegistryCheck,
  recordRegistryCheck,
} from '@/services/company-registry/company-registry-record.service';
import {
  REGISTRY_CHECKED_AT as CHECKED_AT,
  registryRecord,
} from '@/lib/company/__fixtures__/registry-record-fixture';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';

const COMPANY_ID = 'comp_registry_a';

// 🔑 Λατινική επωνυμία ΜΗ κενή: ο φρουρός αποθήκης πρέπει να ξαναδιαβάζει ΚΑΘΕ πίνακα, όχι μόνο κενούς.
const RECORD = registryRecord({ legalNamesLatin: ['PAGONIS AE'] });

function database() {
  const fake = new FakeFirestore();
  return { fake, adminDb: fake as unknown as AdminFirestore };
}

describe('Ρ — γράφεται, ξαναδιαβάζεται, σβήνεται', () => {
  it('Ρ1 — ό,τι γράφτηκε διαβάζεται ΙΔΙΟ από τον φρουρό της παραγωγής', async () => {
    const { adminDb } = database();
    await recordRegistryCheck(adminDb, COMPANY_ID, RECORD, CHECKED_AT);

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

  it('Ρ6 — forget ⇒ absent (δικαίωμα διαγραφής)', async () => {
    const { adminDb } = database();
    await recordRegistryCheck(adminDb, COMPANY_ID, RECORD, CHECKED_AT);
    await forgetRegistryCheck(adminDb, COMPANY_ID);
    expect(await readRegistryCheck(adminDb, COMPANY_ID)).toEqual({ kind: 'absent' });
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
