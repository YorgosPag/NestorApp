/**
 * @jest-environment node
 *
 * Λογιστικές περίοδοι ΑΝΑ ΜΙΣΘΩΤΗ — υπηρεσία + πραγματικό repository πάνω στο verified fake Firestore
 * (ADR-ACC-010 §2.1.1 Φάση 6). Κάθε ομάδα κλειδώνει ένα από τα σφάλματα που βρέθηκαν:
 *
 *   Π1  ΜΙΑ διεύθυνση ανά (μισθωτής, κλειδί) + `companyId` στο έγγραφο — δύο μισθωτές, δύο «2026-12»
 *   Π2  κλείσιμο / κλείδωμα ενός μισθωτή ΔΕΝ αγγίζει τον άλλο (τιμολόγια, Ε-Ε, τράπεζα ακολουθούν το `validatePostingAllowed`)
 *   Π3  η λίστα της χρήσης ΒΡΙΣΚΕΙ τις περιόδους (πριν: φίλτρο `companyId` σε έγγραφα χωρίς `companyId` ⇒ πάντα κενή)
 *   Π4  δεύτερη δημιουργία ⇒ `FiscalYearExistsError`, η ΚΛΕΙΔΩΜΕΝΗ περίοδος μένει κλειδωμένη (πριν: `batch.set` ⇒ OPEN)
 *   Π5  ξένο έγγραφο στη ΔΙΚΗ μου διεύθυνση = ανύπαρκτο (δεύτερη ζώνη: `ownedOrNull`)
 *   Π6  μετάβαση: απόφαση πάνω στη ΦΡΕΣΚΙΑ περίοδο + ίχνος στην ΙΔΙΑ συναλλαγή· κλείδωμα ΚΑΤΑ το ξανάνοιγμα ⇒ άρνηση
 *   Π7  ημερομηνία ⇒ περίοδος χωρίς ζώνη διακομιστή (στιγμή με ώρα = ημέρα Αθήνας· άκυρη ⇒ καμία περίοδος)
 *   Π8  άρνηση καταχώρησης = κωδικός `POSTING_PERIOD_DENIALS` + χρήση/αριθμός περιόδου, χωρίς ετικέτα σε γλώσσα (Φ7)
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicFiscalPeriodId } from '@/services/enterprise-id.service';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

import type { AccountingAuditEntry } from '../../types/accounting-audit';
import type { FiscalPeriod, FiscalPeriodStatus } from '../../types/fiscal-period';
import { createFiscalYear, getPeriodForDate, validatePostingAllowed } from '../fiscal-period-service';
import { FirestoreAccountingRepository } from '../repository/firestore-accounting-repository';
import {
  FiscalPeriodNotFoundError,
  FiscalPeriodTransitionError,
  FiscalYearExistsError,
} from '../repository/accounting-repo-fiscal-periods';

const fake = new FakeFirestore();

jest.mock('@/lib/firebaseAdmin', () => ({
  safeFirestoreOperation: async <T,>(op: (db: AdminFirestore) => Promise<T>, fallback?: T): Promise<T> => {
    try {
      return await op(fake as unknown as AdminFirestore);
    } catch (error) {
      if (fallback !== undefined) return fallback;
      throw error;
    }
  },
}));

const A = { companyId: 'comp_a', userId: 'user_a' } as const;
const B = { companyId: 'comp_b', userId: 'user_b' } as const;
const PERIODS = COLLECTIONS.ACCOUNTING_FISCAL_PERIODS;
const AUDIT = COLLECTIONS.ACCOUNTING_AUDIT_LOG;

const repoOf = (tenant: typeof A | typeof B) => new FirestoreAccountingRepository(tenant);
const docIdOf = (companyId: string, key: string) => generateDeterministicFiscalPeriodId(companyId, key);
const storedStatus = (companyId: string, key: string) =>
  (fake.getData(PERIODS, docIdOf(companyId, key)) as FiscalPeriod | undefined)?.status;
const periodAudits = () => fake.all<AccountingAuditEntry>(AUDIT).filter((e) => e.entityType === 'period');

async function transition(tenant: typeof A | typeof B, key: string, action: 'close' | 'lock' | 'reopen', reason: string | null = null) {
  return repoOf(tenant).transitionFiscalPeriod(key, { action, userId: tenant.userId, reason });
}

beforeEach(() => fake.reset());

describe('Π1 — μία διεύθυνση ανά (μισθωτής, κλειδί)', () => {
  it('δύο μισθωτές γεννούν 2 × 13 ΧΩΡΙΣΤΑ έγγραφα, το καθένα με το `companyId` του', async () => {
    await createFiscalYear(repoOf(A), 2026);
    await createFiscalYear(repoOf(B), 2026);

    expect(Object.keys(fake.getAllDocs(PERIODS))).toHaveLength(26);
    expect(fake.getData(PERIODS, docIdOf(A.companyId, '2026-12'))).toMatchObject({ periodId: '2026-12', companyId: 'comp_a' });
    expect(fake.getData(PERIODS, docIdOf(B.companyId, '2026-12'))).toMatchObject({ periodId: '2026-12', companyId: 'comp_b' });
    expect(fake.getData(PERIODS, '2026-12')).toBeUndefined();
  });
});

describe('Π2 — κλείσιμο / κλείδωμα ανά μισθωτή', () => {
  it('ο Α κλειδώνει τον Δεκέμβριο· ο Β καταχωρεί κανονικά, ο Α όχι', async () => {
    await createFiscalYear(repoOf(A), 2026);
    await createFiscalYear(repoOf(B), 2026);
    await transition(A, '2026-12', 'close');
    await transition(A, '2026-12', 'lock');

    expect(await validatePostingAllowed(repoOf(A), '2026-12-15')).toMatchObject({ allowed: false, periodStatus: 'LOCKED' });
    expect(await validatePostingAllowed(repoOf(B), '2026-12-15')).toMatchObject({ allowed: true, periodStatus: 'OPEN' });
    expect(storedStatus(B.companyId, '2026-12')).toBe('OPEN');
  });

  it('ο Β ΔΕΝ μπορεί να κλείσει την περίοδο του Α — ούτε καν τη βλέπει', async () => {
    await createFiscalYear(repoOf(A), 2026);

    await expect(transition(B, '2026-12', 'close')).rejects.toBeInstanceOf(FiscalPeriodNotFoundError);
    expect(storedStatus(A.companyId, '2026-12')).toBe('OPEN');
    expect(await repoOf(B).getFiscalPeriod('2026-12')).toBeNull();
  });
});

describe('Π3 — η λίστα της χρήσης', () => {
  it('επιστρέφει τις 13 περιόδους ΤΟΥ μισθωτή, με τη σειρά', async () => {
    await createFiscalYear(repoOf(A), 2026);
    await createFiscalYear(repoOf(B), 2026);

    const periods = await repoOf(A).listFiscalPeriods(2026);
    expect(periods.map((p) => p.periodNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(new Set(periods.map((p) => p.companyId))).toEqual(new Set(['comp_a']));
    expect(periods[1]).toMatchObject({ periodId: '2026-02', endDate: '2026-02-28' });
    expect(periods[12]).toMatchObject({ periodId: '2026-13', startDate: '2026-12-01', endDate: '2026-12-31' });
    expect(await repoOf(A).listFiscalPeriods(2027)).toEqual([]);
  });
});

describe('Π4 — η χρήση γεννιέται μία φορά', () => {
  it('δεύτερη δημιουργία ⇒ FiscalYearExistsError· η κλειδωμένη μένει κλειδωμένη', async () => {
    await createFiscalYear(repoOf(A), 2026);
    await transition(A, '2026-03', 'close');
    await transition(A, '2026-03', 'lock');

    await expect(createFiscalYear(repoOf(A), 2026)).rejects.toBeInstanceOf(FiscalYearExistsError);
    expect(storedStatus(A.companyId, '2026-03')).toBe('LOCKED');
  });

  it('ΜΙΑ υπάρχουσα περίοδος αρκεί για άρνηση — και δεν γράφεται ΚΑΜΙΑ από τις υπόλοιπες', async () => {
    fake.seedCollection(PERIODS, { [docIdOf(A.companyId, '2026-07')]: { periodId: '2026-07', companyId: 'comp_a', status: 'CLOSED' } });

    await expect(createFiscalYear(repoOf(A), 2026)).rejects.toBeInstanceOf(FiscalYearExistsError);
    expect(Object.keys(fake.getAllDocs(PERIODS))).toHaveLength(1);
  });
});

describe('Π5 — ξένο έγγραφο στη δική μου διεύθυνση', () => {
  it.each([['comp_b'], [''], [undefined]])('companyId %p ⇒ ανύπαρκτη περίοδος, καμία μετάβαση', async (companyId) => {
    fake.seedCollection(PERIODS, { [docIdOf(A.companyId, '2026-12')]: { periodId: '2026-12', companyId, status: 'OPEN' } });

    expect(await repoOf(A).getFiscalPeriod('2026-12')).toBeNull();
    expect(await validatePostingAllowed(repoOf(A), '2026-12-01')).toMatchObject({ allowed: false, periodId: null });
    await expect(transition(A, '2026-12', 'close')).rejects.toBeInstanceOf(FiscalPeriodNotFoundError);
  });
});

describe('Π6 — μετάβαση + ίχνος σε μία συναλλαγή', () => {
  beforeEach(() => createFiscalYear(repoOf(A), 2026));

  it.each([
    ['close', 'OPEN', 'CLOSED', 'PERIOD_CLOSED'],
    ['lock', 'CLOSED', 'LOCKED', 'PERIOD_LOCKED'],
    ['reopen', 'CLOSED', 'OPEN', 'PERIOD_REOPENED'],
  ] as const)('%s: %s → %s, ίχνος %s με τον ΧΡΗΣΤΗ και τον ΜΙΣΘΩΤΗ', async (action, from, to, event) => {
    if (from === 'CLOSED') await transition(A, '2026-05', 'close');
    const before = periodAudits().length;

    const updated = await transition(A, '2026-05', action, action === 'reopen' ? 'τροποποιητική ΦΠΑ' : null);

    expect(updated.status).toBe(to);
    expect(storedStatus(A.companyId, '2026-05')).toBe(to);
    const added = periodAudits().slice(before);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      eventType: event, entityId: '2026-05', userId: 'user_a', companyId: 'comp_a', metadata: { from, to },
    });
  });

  it.each([
    ['close', 'CLOSED'], ['lock', 'OPEN'], ['reopen', 'OPEN'], ['reopen', 'LOCKED'], ['close', 'LOCKED'],
  ] as const)('%s από %s ⇒ FiscalPeriodTransitionError, τίποτα δεν γράφεται', async (action, status: FiscalPeriodStatus) => {
    if (status !== 'OPEN') await transition(A, '2026-05', 'close');
    if (status === 'LOCKED') await transition(A, '2026-05', 'lock');
    const audits = periodAudits().length;

    await expect(transition(A, '2026-05', action, 'λόγος')).rejects.toBeInstanceOf(FiscalPeriodTransitionError);
    expect([storedStatus(A.companyId, '2026-05'), periodAudits().length]).toEqual([status, audits]);
  });

  it('κλείδωμα ΚΑΤΑ τη διάρκεια ξανανοίγματος ⇒ το ξανάνοιγμα αρνείται· η περίοδος ΜΕΝΕΙ κλειδωμένη', async () => {
    await transition(A, '2026-05', 'close');
    const id = docIdOf(A.companyId, '2026-05');
    fake.interfere = () => fake.write(PERIODS, id, { ...(fake.getData(PERIODS, id) ?? {}), status: 'LOCKED' });

    await expect(transition(A, '2026-05', 'reopen', 'λόγος')).rejects.toBeInstanceOf(FiscalPeriodTransitionError);
    expect(storedStatus(A.companyId, '2026-05')).toBe('LOCKED');
    expect(periodAudits().map((e) => e.eventType)).toEqual(['PERIOD_CLOSED']);
  });
});

describe('Π7 — ημερομηνία ⇒ περίοδος', () => {
  beforeEach(() => createFiscalYear(repoOf(A), 2026));

  it.each([
    ['2026-12-01', '2026-12'],
    ['2026-01-31', '2026-01'],
    ['2026-11-30T23:30:00.000Z', '2026-12'], // 01:30 Αθήνας, 1 Δεκεμβρίου
  ])('%s ⇒ %s', async (date, key) => {
    expect((await getPeriodForDate(repoOf(A), date))?.periodId).toBe(key);
  });

  it.each(['2026-13-01', '2026-02-30', 'not-a-date'])('%s ⇒ καμία περίοδος (ποτέ η περίοδος κλεισίματος)', async (date) => {
    expect(await getPeriodForDate(repoOf(A), date)).toBeNull();
    expect(await validatePostingAllowed(repoOf(A), date)).toMatchObject({ allowed: false, periodId: null });
  });
});

describe('Π8 — άρνηση καταχώρησης = ΚΩΔΙΚΟΣ + δομημένα στοιχεία, ποτέ κείμενο (Φ7)', () => {
  it('ανοιχτή ⇒ επιτρέπεται· κλεισμένη ⇒ PERIOD_CLOSED· κλειδωμένη ⇒ PERIOD_LOCKED· χωρίς χρήση ⇒ PERIOD_NOT_FOUND', async () => {
    await createFiscalYear(repoOf(A), 2026);
    await transition(A, '2026-03', 'close');
    await transition(A, '2026-04', 'close');
    await transition(A, '2026-04', 'lock');

    expect(await validatePostingAllowed(repoOf(A), '2026-02-10')).toEqual({ allowed: true, periodId: '2026-02', periodStatus: 'OPEN' });
    expect(await validatePostingAllowed(repoOf(A), '2026-03-10')).toEqual({
      allowed: false, denial: 'PERIOD_CLOSED', postingDate: '2026-03-10',
      periodId: '2026-03', periodStatus: 'CLOSED', fiscalYear: 2026, periodNumber: 3,
    });
    expect(await validatePostingAllowed(repoOf(A), '2026-04-10')).toMatchObject({ denial: 'PERIOD_LOCKED', periodNumber: 4 });
    expect(await validatePostingAllowed(repoOf(A), '2027-01-10')).toEqual({
      allowed: false, denial: 'PERIOD_NOT_FOUND', postingDate: '2027-01-10',
      periodId: null, periodStatus: null, fiscalYear: null, periodNumber: null,
    });
  });

  it('η περίοδος ΔΕΝ αποθηκεύει ετικέτα σε γλώσσα — την παράγει ο πελάτης από το `periodNumber`', async () => {
    await createFiscalYear(repoOf(A), 2026);
    expect(fake.getData(PERIODS, docIdOf(A.companyId, '2026-01'))).not.toHaveProperty('label');
  });
});
