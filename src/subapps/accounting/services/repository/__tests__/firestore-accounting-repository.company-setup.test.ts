/**
 * @jest-environment node
 *
 * @fileoverview **ΑΠΟΘΗΚΕΥΣΗ ΠΡΟΦΙΛ ΣΤΟΝ ΔΙΣΚΟ** — ADR-439 (ανά οργανισμό) · ADR-841 §7 Α23 Φ3.2 Γ3.
 * @related subapps/accounting/services/repository/accounting-repo-company-setup.ts
 *
 * Ρωτά **τον δίσκο** (FakeFirestore με αληθινή επανάληψη συναλλαγής), όχι μόνο τι επέστρεψε η κλήση:
 *   • Τ — ανά οργανισμό `accounting_settings/{companyId}`, ποτέ το παλιό καθολικό έγγραφο
 *   • Μ — η μπαγιάτικη οθόνη δεν ξαναγράφει επωνυμία/μετόχους · σφραγίδες διακομιστή
 *   • Σ — ίχνος στην ΙΔΙΑ συναλλαγή · ανταγωνιστής ⇒ επανάληψη · αποτυχία ⇒ τίποτα · καμία αλλαγή ⇒ καμία γραφή
 *
 * ⚠️ Ο πλαστός ζει **μέσα** στο mock module (`jest.requireMock`): η εργοστασιακή συνάρτηση του mock
 * δεν μπορεί να κλείσει πάνω σε μεταβλητή του test.
 */

jest.mock('@/lib/firebaseAdmin', () => {
  const { FakeFirestore: Fake } = jest.requireActual('@/services/places/__tests__/fake-firestore');
  const fake = new Fake();
  return {
    fake,
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

import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';
import type { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { accountingAuditEntryOf } from '@/subapps/accounting/services/accounting-audit-service';
import { FirestoreAccountingRepository } from '@/subapps/accounting/services/repository/firestore-accounting-repository';
import type { AccountingAuditEntry } from '@/subapps/accounting/types/accounting-audit';
import type { TenantContext } from '@/subapps/accounting/types/common';
import type { CompanySetupInput } from '@/subapps/accounting/types/company';

const { fake } = jest.requireMock('@/lib/firebaseAdmin') as { fake: FakeFirestore };

const COMPANY_ID = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';
const tenant: TenantContext = { companyId: COMPANY_ID, userId: 'user_test' };
const CREATED_AT = '2020-01-01T00:00:00.000Z';
const SHAREHOLDERS = [
  { shareholderId: 's1', fullName: 'Α. Παγώνης', dividendSharePercent: 60 },
  { shareholderId: 's2', fullName: 'Β. Παγώνης', dividendSharePercent: 40 },
];

const AE = {
  entityType: 'ae', businessName: 'ΠΑΓΩΝΗΣ Α.Ε.', profession: 'Κατασκευές', vatNumber: '123456789',
  taxOffice: 'Δ.Ο.Υ. Θεσσαλονίκης', address: 'Σαμοθράκης 16', city: 'Θεσσαλονίκη', postalCode: '54248',
  phone: '2310000000', mobile: null, email: null, website: null,
  mainKad: { code: '41.20', description: 'Κατασκευή κτιρίων', type: 'primary', activeFrom: '2020-01-01' },
  secondaryKads: [], bookCategory: 'double_entry', vatRegime: 'normal', fiscalYearEnd: 12, currency: 'EUR',
  invoiceSeries: [], gemiNumber: '001234567000', shareholders: SHAREHOLDERS, shareCapital: 25000,
} as const;

const input = (overrides: Record<string, unknown> = {}) => ({ ...AE, ...overrides }) as unknown as CompanySetupInput;
const repo = () => new FirestoreAccountingRepository(tenant);

function seedProfile(overrides: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.ACCOUNTING_SETTINGS, COMPANY_ID, {
    ...AE, companyId: COMPANY_ID, createdAt: CREATED_AT, updatedAt: '2026-09-01T00:00:00.000Z', ...overrides,
  });
}

async function disk(): Promise<Record<string, unknown> | undefined> {
  return (await fake.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(COMPANY_ID).get()).data();
}

const auditLog = () => fake.all<Record<string, unknown>>(COLLECTIONS.ACCOUNTING_AUDIT_LOG);

/** Νέο αναγνωριστικό σε ΚΑΘΕ κλήση — όπως ο αληθινός wrapper, ώστε διπλή γραφή να μετριέται. */
function freshEntry(): AccountingAuditEntry {
  return accountingAuditEntryOf({
    eventType: 'COMPANY_LEGAL_NAME_CHANGED', entityType: 'company_profile', entityId: COMPANY_ID,
    userId: 'user_test', details: 'δοκιμή',
  });
}

beforeEach(() => {
  fake.reset();
  fake.interfere = null;
});

describe('Τ — ανά οργανισμό (ADR-439)', () => {
  it('🔑 Τ1 — διαβάζει `accounting_settings/{companyId}`, ΟΧΙ το καθολικό έγγραφο', async () => {
    fake.seed(COLLECTIONS.ACCOUNTING_SETTINGS, SYSTEM_DOCS.ACCT_COMPANY_PROFILE, { businessName: 'ΚΑΘΟΛΙΚΟ' });
    expect(await repo().getCompanySetup()).toBeNull();

    seedProfile();
    expect((await repo().getCompanySetup())?.businessName).toBe('ΠΑΓΩΝΗΣ Α.Ε.');
  });

  it('🔑 Τ2 — παλιό έγγραφο χωρίς `entityType` ⇒ ατομική, και στην ανάγνωση ΚΑΙ στο «πριν» της αποθήκευσης', async () => {
    fake.seed(COLLECTIONS.ACCOUNTING_SETTINGS, COMPANY_ID, { businessName: 'Sole Prop', companyId: COMPANY_ID });
    expect((await repo().getCompanySetup())?.entityType).toBe('sole_proprietor');

    const { before } = await repo().saveCompanySetup(input({ businessName: 'Άλλη' }), { fields: ['businessName'] });
    expect(before?.entityType).toBe('sole_proprietor');
  });

  it('🔑 Τ3 — πρώτη αποθήκευση: σφραγίζει `companyId`, `createdAt` = `updatedAt`, «πριν» = null', async () => {
    const { before, after } = await repo().saveCompanySetup(input());

    const stored = await disk();
    expect(before).toBeNull();
    expect(stored).toMatchObject({ companyId: COMPANY_ID, businessName: 'ΠΑΓΩΝΗΣ Α.Ε.' });
    expect(stored?.createdAt).toBe(stored?.updatedAt);
    expect(after).toEqual(stored);
  });
});

describe('Μ — η μπαγιάτικη οθόνη (μάσκα πεδίων)', () => {
  it('🔴 Μ1 — επωνυμία υιοθετήθηκε στο μεταξύ · η παλιά οθόνη αλλάζει τηλέφωνο ⇒ η επωνυμία ΜΕΝΕΙ στον δίσκο', async () => {
    seedProfile({ businessName: 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ' });

    await repo().saveCompanySetup(input({ phone: '2310999999' }), { fields: ['phone'] });

    expect(await disk()).toMatchObject({ businessName: 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ', phone: '2310999999' });
  });

  it('🔴 Μ2 — μέτοχοι που άλλαξαν αλλού ΕΠΙΖΟΥΝ · `createdAt` διατηρείται · `updatedAt` νέο', async () => {
    seedProfile({ shareholders: [...SHAREHOLDERS, { shareholderId: 's3', fullName: 'Γ', dividendSharePercent: 0 }] });

    await repo().saveCompanySetup(input({ city: 'Αθήνα' }), { fields: ['city'] });

    const stored = await disk();
    expect(stored?.shareholders).toHaveLength(3);
    expect(stored).toMatchObject({ city: 'Αθήνα', createdAt: CREATED_AT });
    expect(stored?.updatedAt).not.toBe('2026-09-01T00:00:00.000Z');
  });

  it('🔑 Μ3 — χωρίς μάσκα (παλιός πελάτης) ⇒ πλήρης αντικατάσταση, σαν πριν', async () => {
    seedProfile({ businessName: 'ΠΑΛΙΑ' });

    await repo().saveCompanySetup(input({ businessName: 'ΝΕΑ' }));

    expect((await disk())?.businessName).toBe('ΝΕΑ');
  });
});

describe('Σ — μία συναλλαγή: αλλαγή και ίχνος μαζί', () => {
  it('🔴 Σ1 — τα ίχνη του `auditOf` γράφονται στην ίδια δέσμευση, από το «πριν/μετά» της συναλλαγής', async () => {
    seedProfile({ businessName: 'Α' });
    const auditOf = jest.fn(() => [freshEntry()]);

    const result = await repo().saveCompanySetup(input({ businessName: 'Β' }), { fields: ['businessName'], auditOf });

    expect(auditOf).toHaveBeenCalledWith(
      expect.objectContaining({ businessName: 'Α' }),
      expect.objectContaining({ businessName: 'Β', companyId: COMPANY_ID }),
    );
    expect(auditLog()).toEqual([expect.objectContaining({ eventType: 'COMPANY_LEGAL_NAME_CHANGED', companyId: COMPANY_ID })]);
    expect(result.after.businessName).toBe('Β');
  });

  it('🔴 Σ2 — ανταγωνιστής αλλάζει την επωνυμία ανάμεσα σε ανάγνωση και δέσμευση ⇒ το σώμα ΞΑΝΑΤΡΕΧΕΙ, ΕΝΑ ίχνος', async () => {
    seedProfile({ businessName: 'Α', phone: '1' });
    fake.interfere = () => seedProfile({ businessName: 'ΓΕΜΗ', phone: '1' });
    const auditOf = jest.fn(() => [freshEntry()]);

    const result = await repo().saveCompanySetup(input({ businessName: 'Α', phone: '2' }), { fields: ['phone'], auditOf });

    expect(await disk()).toMatchObject({ businessName: 'ΓΕΜΗ', phone: '2' });
    expect(auditOf).toHaveBeenCalledTimes(2);
    expect(result.before?.businessName).toBe('ΓΕΜΗ');
    expect(auditLog()).toHaveLength(1);
  });

  it('🔴 Σ3 — αποτυχία στη σύνθεση ίχνους ⇒ ΤΙΠΟΤΑ δεν γράφεται (ούτε προφίλ, ούτε ίχνος)', async () => {
    seedProfile({ businessName: 'Α' });
    const auditOf = () => {
      throw new Error('AUDIT_FAILED');
    };

    await expect(
      repo().saveCompanySetup(input({ businessName: 'Β' }), { fields: ['businessName'], auditOf }),
    ).rejects.toThrow('AUDIT_FAILED');
    expect((await disk())?.businessName).toBe('Α');
    expect(fake.writes).toBe(0);
  });

  it('🔑 Σ4 — τίποτα δεν άλλαξε ⇒ ΚΑΜΙΑ γραφή (ούτε `updatedAt`, ούτε ίχνος) · «μετά» = «πριν»', async () => {
    seedProfile();
    const auditOf = jest.fn(() => [freshEntry()]);

    const result = await repo().saveCompanySetup(input(), { fields: [], auditOf });

    expect(fake.writes).toBe(0);
    expect(auditOf).not.toHaveBeenCalled();
    expect(result.after).toBe(result.before);
  });

  it('🔑 Σ5 — ίδιο περιεχόμενο αλλά έγγραφο ΧΩΡΙΣ `companyId` ⇒ γράφεται (σφραγίζεται για τους κανόνες)', async () => {
    seedProfile({ companyId: undefined });

    await repo().saveCompanySetup(input());

    expect((await disk())?.companyId).toBe(COMPANY_ID);
  });
});
