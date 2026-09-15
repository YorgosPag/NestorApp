/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **«ΥΙΟΘΕΤΗΣΗ ΕΠΩΝΥΜΙΑΣ ΓΕΜΗ» ΣΤΟΝ ΔΙΣΚΟ** — ADR-841 §7 Α23, Φ3.2 Γ.
 * @related services/company-registry/legal-name-adoption.service
 *
 * Ρωτά **τον δίσκο** (FakeFirestore με αληθινή επανάληψη συναλλαγής), ποτέ μόνο τι επέστρεψε η συνάρτηση:
 *   • Υ1 — γράφεται ΜΟΝΟ η επωνυμία · οι μέτοχοι επιζούν · ίχνος audit στην ίδια συναλλαγή
 *   • Υ2 — CAS: ό,τι είδε ο άνθρωπος ≠ αποθηκευμένη απάντηση ⇒ καμία γραφή (και σε ταυτόχρονη επαλήθευση)
 *   • Υ3 — μόνο `name-mismatch` υιοθετείται (κλειστή, χωρίς έλεγχο, χωρίς προφίλ ⇒ άρνηση)
 *   • Υ4 — ιδεμποτής: δεύτερο πάτημα = καμία γραφή, ένα ίχνος
 */

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({}),
  safeFirestoreOperation: jest.fn(),
}));

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { registryRecord } from '@/lib/company/__fixtures__/registry-record-fixture';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { givenCompanyProfile, givenRegistryCheck } from '@/services/mandate/__tests__/showcase-legal-fixture';

import { adoptRegistryLegalName } from '../legal-name-adoption.service';

const COMPANY = 'comp_adopt_0001';
const REGISTRY_NAME = 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ';
const TYPED_NAME = 'Δοκιμαστικό Γραφείο Ο1-Ο9';
const SHAREHOLDERS = [{ shareholderId: 'shr_1', fullName: 'Γ. Παγώνης', dividendSharePercent: 100 }];

function db(profile: Record<string, unknown> | null = { businessName: TYPED_NAME }) {
  const fake = new FakeFirestore();
  if (profile !== null) {
    givenCompanyProfile(fake, COMPANY, { vatNumber: '123456789', shareholders: SHAREHOLDERS, ...profile });
  }
  return { fake, admin: fake as unknown as AdminFirestore };
}

function adopt(admin: AdminFirestore, expectedLegalName = REGISTRY_NAME) {
  return adoptRegistryLegalName(admin, { companyId: COMPANY, actorUid: 'user_admin', expectedLegalName });
}

async function profileOf(fake: FakeFirestore): Promise<Record<string, unknown>> {
  const snap = await fake.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(COMPANY).get();
  return snap.data() as Record<string, unknown>;
}

function auditEntries(fake: FakeFirestore): Record<string, unknown>[] {
  return [...fake.all<Record<string, unknown>>(COLLECTIONS.ACCOUNTING_AUDIT_LOG)];
}

describe('Υ — η υιοθέτηση της επωνυμίας του μητρώου', () => {
  it('🔴 Υ1 — γράφει ΜΟΝΟ την επωνυμία ΓΕΜΗ, κρατά μετόχους/ΑΦΜ, και αφήνει ίχνος στην ΙΔΙΑ συναλλαγή', async () => {
    const { fake, admin } = db();
    givenRegistryCheck(fake, COMPANY);

    const outcome = await adopt(admin);

    expect(outcome.kind).toBe('adopted');
    expect(outcome.report.judgment.state).toBe('verified');
    expect(outcome.report.declaration.businessName).toBe(REGISTRY_NAME);
    const profile = await profileOf(fake);
    expect(profile).toMatchObject({ businessName: REGISTRY_NAME, vatNumber: '123456789', shareholders: SHAREHOLDERS });
    expect(typeof profile.updatedAt).toBe('string');

    expect(auditEntries(fake)).toEqual([
      expect.objectContaining({
        eventType: 'COMPANY_LEGAL_NAME_CHANGED',
        entityType: 'company_profile',
        entityId: COMPANY,
        companyId: COMPANY,
        userId: 'user_admin',
        metadata: {
          previousLegalName: TYPED_NAME,
          legalName: REGISTRY_NAME,
          source: 'gemi-adoption',
          registrationNumber: '123456789000',
          registryCheckedAt: expect.any(String),
        },
      }),
    ]);
  });

  it('🔴 Υ2 — CAS: ο άνθρωπος είδε ΑΛΛΗ επωνυμία ⇒ `registry-changed`, ΚΑΜΙΑ γραφή, νέα αναφορά', async () => {
    const { fake, admin } = db();
    givenRegistryCheck(fake, COMPANY);

    const outcome = await adopt(admin, 'ΠΑΛΙΑ ΕΠΩΝΥΜΙΑ ΑΕ');

    expect(outcome.kind).toBe('registry-changed');
    expect(outcome.report.judgment).toMatchObject({ state: 'declared', gap: 'name-mismatch' });
    expect(fake.writes).toBe(0);
    expect((await profileOf(fake)).businessName).toBe(TYPED_NAME);
  });

  it('🔴 Υ2β — ταυτόχρονη επαλήθευση ΓΕΜΗ ανάμεσα σε ανάγνωση και commit ⇒ ξανακρίνεται, καμία γραφή', async () => {
    const { fake, admin } = db();
    givenRegistryCheck(fake, COMPANY);
    fake.interfere = () => givenRegistryCheck(fake, COMPANY, registryRecord({ legalName: 'ΠΑΓΩΝΗΣ ΝΕΑ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ' }));

    const outcome = await adopt(admin);

    expect(outcome.kind).toBe('registry-changed');
    expect(fake.writes).toBe(0);
    expect(auditEntries(fake)).toHaveLength(0);
  });

  it.each([
    [
      'κλειστή στο ΓΕΜΗ',
      (fake: FakeFirestore) =>
        givenRegistryCheck(fake, COMPANY, registryRecord({ status: { code: { id: '5', label: 'Διαγραφή' }, activity: 'inactive' } })),
      'inactive',
    ],
    ['δεν ρωτήθηκε ποτέ το μητρώο', () => undefined, 'not-checked'],
    ['άλλος αριθμός στο αντίγραφο', (fake: FakeFirestore) => givenRegistryCheck(fake, COMPANY, registryRecord({ registrationNumber: '999999999000' })), 'number-mismatch'],
  ])('🔴 Υ3 — %s ⇒ `not-adoptable` (%s), καμία γραφή', async (_label, seed, gap) => {
    const { fake, admin } = db();
    seed(fake);

    const outcome = await adopt(admin);

    expect(outcome.kind).toBe('not-adoptable');
    expect(outcome.report.judgment).toMatchObject({ state: 'declared', gap });
    expect(fake.writes).toBe(0);
  });

  it('🔴 Υ3β — χωρίς προφίλ ⇒ `not-adoptable`, και ΔΕΝ δημιουργείται προφίλ', async () => {
    const { fake, admin } = db(null);
    givenRegistryCheck(fake, COMPANY);

    const outcome = await adopt(admin);

    expect(outcome.kind).toBe('not-adoptable');
    expect(fake.writes).toBe(0);
  });

  it('🔑 Υ4 — ιδεμποτής: το δεύτερο πάτημα ⇒ `already-adopted`, καμία νέα γραφή, ΕΝΑ ίχνος', async () => {
    const { fake, admin } = db();
    givenRegistryCheck(fake, COMPANY);

    await adopt(admin);
    const writesAfterFirst = fake.writes;
    const second = await adopt(admin);

    expect(second.kind).toBe('already-adopted');
    expect(fake.writes).toBe(writesAfterFirst);
    expect(auditEntries(fake)).toHaveLength(1);
  });
});
