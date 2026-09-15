/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **ΔΙΑΤΗΡΗΣΗ ΤΟΥ ΑΝΤΙΓΡΑΦΟΥ ΓΕΜΗ, ΣΤΟΝ ΔΙΣΚΟ** — ADR-841 §7 Α23.12 (GDPR άρθ. 5(1)(ε) · 5(2) · 17).
 * @related services/company-registry/company-registry-retention.service.ts
 *
 * Ρωτά **τον δίσκο** (FakeFirestore με αληθινή επανάληψη συναλλαγής) μέσα από την **αληθινή** αποθήκευση
 * προφίλ (`FirestoreAccountingRepository`) — ώστε το «στην ίδια συναλλαγή» να είναι μετρημένο, όχι δηλωμένο:
 *   • Δ — αλλαγή/σβήσιμο αριθμού ⇒ διαγραφή + ΕΝΑ ίχνος · ίδιος αριθμός ⇒ τίποτα · race · ατομικότητα
 *   • Α — αίτημα διαγραφής: ίχνος · ιδεμποτές
 *   • Ν — «δεν υπάρχει» σβήνει ΜΟΝΟ το αντίγραφο του αριθμού που ρωτήθηκε
 *
 * ⚠️ Ο πλαστός ζει **μέσα** στο mock module (`jest.requireMock`), πρότυπο `firestore-accounting-repository.company-setup.test.ts`.
 */

jest.mock('@/lib/firebaseAdmin', () => {
  const { FakeFirestore: Fake } = jest.requireActual('@/services/places/__tests__/fake-firestore');
  const fake = new Fake();
  return {
    fake,
    getAdminFirestore: () => fake,
    safeFirestoreOperation: async <T,>(op: (db: unknown) => Promise<T>, fallback?: T): Promise<T> => {
      try {
        return await op(fake);
      } catch (error) {
        if (fallback !== undefined) return fallback;
        throw error;
      }
    },
  };
});

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { REGISTRY_CHECKED_AT, registryRecord } from '@/lib/company/__fixtures__/registry-record-fixture';
import type { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import {
  COMPANY_PROFILE,
  givenCompanyProfile,
  givenRegistryCheck,
} from '@/services/mandate/__tests__/showcase-legal-fixture';
import { FirestoreAccountingRepository } from '@/subapps/accounting/services/repository/firestore-accounting-repository';
import type { CompanyProfileField, CompanySetupInput } from '@/subapps/accounting/types/company';

import {
  eraseRegistryCopyOnRequest,
  forgetAbsentRegistryNumber,
  registryRetentionCompanion,
} from '../company-registry-retention.service';

const { fake } = jest.requireMock('@/lib/firebaseAdmin') as { fake: FakeFirestore };
const adminDb = fake as unknown as AdminFirestore;

const COMPANY_ID = 'comp_retention_a';
const ACTOR = 'user_admin';
const OLD_NUMBER = COMPANY_PROFILE.gemiNumber;
const NEW_NUMBER = '999999999000';

function saveProfile(overrides: Record<string, unknown>, fields: CompanyProfileField[], auditOf?: () => never) {
  const repository = new FirestoreAccountingRepository({ companyId: COMPANY_ID, userId: ACTOR });
  return repository.saveCompanySetup({ ...COMPANY_PROFILE, ...overrides } as unknown as CompanySetupInput, {
    fields,
    auditOf,
    companion: registryRetentionCompanion(adminDb, COMPANY_ID, ACTOR),
  });
}

const copies = () => fake.all<{ record: { registrationNumber: string } }>(COLLECTIONS.COMPANY_REGISTRY_RECORDS);
const erasures = () =>
  fake
    .all<Record<string, unknown>>(COLLECTIONS.ACCOUNTING_AUDIT_LOG)
    .filter((entry) => entry.eventType === 'COMPANY_REGISTRY_COPY_ERASED');

beforeEach(() => {
  fake.reset();
  fake.interfere = null;
  givenCompanyProfile(fake, COMPANY_ID, { companyId: COMPANY_ID, phone: '2310000000' });
  givenRegistryCheck(fake, COMPANY_ID);
});

describe('Δ — η αποθήκευση προφίλ κατέχει τη διατήρηση', () => {
  it('🔴 Δ1 — ο αριθμός ΑΛΛΑΞΕ ⇒ το αντίγραφο του παλιού σβήνεται, με ΕΝΑ ίχνος στην ίδια δέσμευση', async () => {
    const { after } = await saveProfile({ gemiNumber: NEW_NUMBER }, ['gemiNumber']);

    expect(after.gemiNumber).toBe(NEW_NUMBER);
    expect(copies()).toHaveLength(0);
    expect(erasures()).toEqual([
      expect.objectContaining({
        entityType: 'company_profile',
        entityId: COMPANY_ID,
        companyId: COMPANY_ID,
        userId: ACTOR,
        metadata: { reason: 'profile-number-changed', registrationNumber: OLD_NUMBER, registryCheckedAt: REGISTRY_CHECKED_AT },
      }),
    ]);
  });

  it('🔴 Δ2 — ο αριθμός ΣΒΗΣΤΗΚΕ ⇒ το αντίγραφο σβήνεται', async () => {
    await saveProfile({ gemiNumber: null }, ['gemiNumber']);

    expect(copies()).toHaveLength(0);
    expect(erasures()).toHaveLength(1);
  });

  it('🔑 Δ3 — ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: άλλαξε το τηλέφωνο, ίδιος αριθμός ⇒ το αντίγραφο ΜΕΝΕΙ, κανένα ίχνος διαγραφής', async () => {
    const { after } = await saveProfile({ phone: '2310999999' }, ['phone']);

    expect(after).toMatchObject({ phone: '2310999999', gemiNumber: OLD_NUMBER });
    expect(copies()).toHaveLength(1);
    expect(erasures()).toHaveLength(0);
  });

  it('🔴 Δ4 — RACE: επαλήθευση του ΝΕΟΥ αριθμού γράφει ανάμεσα σε ανάγνωση και δέσμευση ⇒ ξανατρέχει, το ΝΕΟ αντίγραφο ΕΠΙΖΕΙ', async () => {
    fake.interfere = () => givenRegistryCheck(fake, COMPANY_ID, registryRecord({ registrationNumber: NEW_NUMBER }));

    await saveProfile({ gemiNumber: NEW_NUMBER }, ['gemiNumber']);

    expect(copies().map((copy) => copy.record.registrationNumber)).toEqual([NEW_NUMBER]);
    expect(erasures()).toHaveLength(0);
  });

  it('🔴 Δ5 — ΑΤΟΜΙΚΟΤΗΤΑ: η αποθήκευση αποτυγχάνει ⇒ ΟΥΤΕ διαγραφή, ΟΥΤΕ ίχνος', async () => {
    const failingAudit = () => {
      throw new Error('AUDIT_FAILED');
    };

    await expect(saveProfile({ gemiNumber: NEW_NUMBER }, ['gemiNumber'], failingAudit)).rejects.toThrow('AUDIT_FAILED');

    expect(copies()).toHaveLength(1);
    expect(erasures()).toHaveLength(0);
  });

  it('🔴 Δ6 — χαλασμένο αντίγραφο (δεν αφορά κανέναν αριθμό) + αλλαγή αριθμού ⇒ σβήνεται, ίχνος χωρίς αριθμό', async () => {
    fake.seed(COLLECTIONS.COMPANY_REGISTRY_RECORDS, COMPANY_ID, { companyId: COMPANY_ID, checkedAt: 'x', record: {} });

    await saveProfile({ gemiNumber: NEW_NUMBER }, ['gemiNumber']);

    expect(copies()).toHaveLength(0);
    expect(erasures()).toEqual([
      expect.objectContaining({ metadata: expect.objectContaining({ registrationNumber: null, registryCheckedAt: null }) }),
    ]);
  });
});

describe('Α — αίτημα διαγραφής του κατόχου (άρθ. 17 · 21)', () => {
  it('🔴 Α1 — σβήνει με ίχνος · δεύτερο αίτημα ⇒ `already-absent`, ΚΑΝΕΝΑ δεύτερο ίχνος (ιδεμποτές)', async () => {
    await expect(eraseRegistryCopyOnRequest(adminDb, COMPANY_ID, ACTOR)).resolves.toBe('erased');
    await expect(eraseRegistryCopyOnRequest(adminDb, COMPANY_ID, ACTOR)).resolves.toBe('already-absent');

    expect(copies()).toHaveLength(0);
    expect(erasures()).toEqual([
      expect.objectContaining({ userId: ACTOR, metadata: expect.objectContaining({ reason: 'erasure-request' }) }),
    ]);
  });

  it('🔑 Α2 — ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: τίποτα αποθηκευμένο ⇒ `already-absent` και ΚΑΜΙΑ γραφή', async () => {
    fake.reset();
    await expect(eraseRegistryCopyOnRequest(adminDb, COMPANY_ID, ACTOR)).resolves.toBe('already-absent');
    expect(fake.writes).toBe(0);
  });
});

describe('Ν — «δεν υπάρχει» σβήνει ΜΟΝΟ τον αριθμό που ρωτήθηκε', () => {
  it('🔴 Ν1 — αργή απάντηση για τον ΠΑΛΙΟ αριθμό ενώ κρατάμε αντίγραφο του ΝΕΟΥ ⇒ το νέο ΕΠΙΖΕΙ', async () => {
    givenRegistryCheck(fake, COMPANY_ID, registryRecord({ registrationNumber: NEW_NUMBER }));

    await forgetAbsentRegistryNumber(adminDb, COMPANY_ID, OLD_NUMBER, ACTOR);

    expect(copies()).toHaveLength(1);
    expect(erasures()).toHaveLength(0);
  });

  it('🔑 Ν2 — ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: «δεν υπάρχει» για τον αριθμό του αντιγράφου ⇒ σβήνεται, αιτία `not-in-registry`', async () => {
    await forgetAbsentRegistryNumber(adminDb, COMPANY_ID, OLD_NUMBER, ACTOR);

    expect(copies()).toHaveLength(0);
    expect(erasures()).toEqual([expect.objectContaining({ metadata: expect.objectContaining({ reason: 'not-in-registry' }) })]);
  });
});
