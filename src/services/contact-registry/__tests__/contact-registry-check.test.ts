/**
 * @fileoverview Άγκυρες του **«Έλεγχος στο ΓΕΜΗ» ανά επαφή** — ADR-948 §8 Βήμα 4.
 *
 * 🔴 Τα σενάρια που φυλάνε: απάντηση που ο φράχτης αρνείται και **αποθηκεύεται** όμως · «δεν μπόρεσα να ρωτήσω»
 * που βγαίνει «δεν υπάρχει» · ΑΦΜ με πολλούς αριθμούς που διαλέγει μόνο του τον πρώτο · «δεν υπάρχει» για αριθμό
 * βρεμένο με ΑΦΜ που σβήνει αντίγραφο · αλλαγή αριθμού στη διάρκεια της ερώτησης που δηλώνεται «ρωτήθηκε».
 */

import type { DocumentReference } from 'firebase-admin/firestore';

import { registryRecord } from '@/lib/company/__fixtures__/registry-record-fixture';
import {
  readContactRegistryReport,
  verifyContactRegistry,
  type ContactRegistryDeps,
  type ContactRegistryTarget,
} from '@/services/contact-registry/contact-registry-check.service';
import type { ContactRegistryCheckWrite } from '@/services/contact-registry/contact-registry-check-record.service';
import type { RegistryCompanyRecord, RegistryLookupVerdict, RegistryTaxSearchVerdict } from '@/types/company-registry';
import type { ContactRegistryCheckRecord } from '@/types/contact-registry-check';

const NOW = '2026-11-22T10:00:00.000Z';
const TARGET: ContactRegistryTarget = {
  contactRef: {} as DocumentReference,
  companyId: 'comp_a',
  contactId: 'cont_1',
};

const AE_RECORD = registryRecord({ legalForm: { id: '1', label: 'ΑΕ' } });

const contactDoc = (overrides: Record<string, unknown> = {}) => ({
  type: 'company',
  companyId: 'comp_a',
  companyName: 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
  gemiNumber: '123456789000',
  vatNumber: '123456783',
  legalForm: 'ae',
  ...overrides,
});

interface Fake {
  readonly deps: ContactRegistryDeps;
  readonly lookups: string[];
  readonly taxSearches: string[];
  readonly writes: ContactRegistryCheckWrite[];
  readonly forgotten: string[];
}

function fake(options: {
  lookup?: RegistryLookupVerdict;
  taxSearch?: RegistryTaxSearchVerdict;
  stored?: ContactRegistryCheckRecord | null;
  contactChanged?: boolean;
} = {}): Fake {
  const lookups: string[] = [];
  const taxSearches: string[] = [];
  const writes: ContactRegistryCheckWrite[] = [];
  const forgotten: string[] = [];
  const deps: ContactRegistryDeps = {
    lookup: async (number) => {
      lookups.push(number);
      return options.lookup ?? { kind: 'found', record: AE_RECORD };
    },
    searchByTaxId: async (taxId) => {
      taxSearches.push(taxId);
      return options.taxSearch ?? { kind: 'results', registrationNumbers: ['123456789000'] };
    },
    readStored: async () => options.stored ?? null,
    record: async (write, record: RegistryCompanyRecord) => {
      writes.push(write);
      if (options.contactChanged) return null;
      return { companyId: write.companyId, contactId: write.contactId, checkedAt: write.checkedAt, checkedBy: write.checkedBy, record };
    },
    forgetAbsent: async (_companyId, _contactId, number) => {
      forgotten.push(number);
      return true;
    },
    now: () => NOW,
  };
  return { deps, lookups, taxSearches, writes, forgotten };
}

describe('Α — ο δρόμος του αριθμού', () => {
  it('Α1 — Αρ. ΓΕΜΗ της επαφής ⇒ μία ερώτηση, εγγραφή, σύγκριση', async () => {
    const f = fake();
    const run = await verifyContactRegistry(TARGET, contactDoc(), 'user_1', f.deps);
    expect(f.taxSearches).toEqual([]);
    expect(f.lookups).toEqual(['123456789000']);
    expect(f.writes[0]?.query).toEqual({ kind: 'gemi-number', registrationNumber: '123456789000' });
    expect(f.writes[0]?.checkedBy).toBe('user_1');
    expect(run.report.attempt).toEqual({ kind: 'asked' });
    expect(run.report.check?.checkedAt).toBe(NOW);
    expect(run.report.comparison?.legalName.state).toBe('match');
    expect(run.recorded).not.toBeNull();
  });

  it('Α2 — χωρίς αριθμό, με ΑΦΜ ⇒ αναζήτηση ΑΦΜ και μετά ερώτηση με τον έναν αριθμό', async () => {
    const f = fake();
    const run = await verifyContactRegistry(TARGET, contactDoc({ gemiNumber: '' }), 'user_1', f.deps);
    expect(f.taxSearches).toEqual(['123456783']);
    expect(f.lookups).toEqual(['123456789000']);
    expect(f.writes[0]?.query).toEqual({ kind: 'tax-id', taxId: '123456783' });
    expect(run.report.attempt).toEqual({ kind: 'asked' });
  });

  it('Α3 — ΑΦΜ με πολλούς αριθμούς ⇒ λίστα, καμία ερώτηση, τίποτα δεν γράφεται', async () => {
    const f = fake({ taxSearch: { kind: 'results', registrationNumbers: ['111', '222'] } });
    const run = await verifyContactRegistry(TARGET, contactDoc({ gemiNumber: '' }), 'user_1', f.deps);
    expect(run.report.attempt).toEqual({ kind: 'ambiguous', registrationNumbers: ['111', '222'] });
    expect(f.lookups).toEqual([]);
    expect(f.writes).toEqual([]);
  });

  it('Α4 — ΑΦΜ χωρίς αριθμό ⇒ «δεν βρέθηκε»', async () => {
    const f = fake({ taxSearch: { kind: 'results', registrationNumbers: [] } });
    const run = await verifyContactRegistry(TARGET, contactDoc({ gemiNumber: '' }), 'user_1', f.deps);
    expect(run.report.attempt).toEqual({ kind: 'not-found' });
    expect(f.lookups).toEqual([]);
  });

  it('Α5 — ούτε αριθμός ούτε έγκυρο ΑΦΜ ⇒ καμία κλήση', async () => {
    const f = fake();
    const run = await verifyContactRegistry(TARGET, contactDoc({ gemiNumber: '', vatNumber: '123456789' }), 'user_1', f.deps);
    expect(run.report.attempt).toEqual({ kind: 'no-identifier' });
    expect(f.taxSearches).toEqual([]);
    expect(f.lookups).toEqual([]);
  });
});

describe('Β — ο φράχτης «όχι φυσικό πρόσωπο»: άρνηση = τίποτα δεν αποθηκεύεται', () => {
  it.each([
    ['natural-person', { id: '16', label: 'ΑΤΟΜΙΚΗ' }],
    ['unmapped', { id: '9999', label: 'ΚΑΤΙ ΝΕΟ' }],
    ['catalog-drift', { id: '1', label: 'ΑΛΛΟ ΝΟΗΜΑ' }],
  ] as const)('Β — %s ⇒ refused, καμία εγγραφή, καμία σύγκριση', async (reason, legalForm) => {
    const f = fake({ lookup: { kind: 'found', record: registryRecord({ legalForm }) } });
    const run = await verifyContactRegistry(TARGET, contactDoc(), 'user_1', f.deps);
    expect(run.report.attempt).toEqual({ kind: 'refused', reason });
    expect(f.writes).toEqual([]);
    expect(run.recorded).toBeNull();
    expect(run.report.comparison).toBeNull();
  });
});

describe('Γ — «δεν μπόρεσα» ≠ «δεν υπάρχει»', () => {
  it('Γ1 — unavailable ⇒ unavailable, τίποτα δεν σβήνεται, η παλιά γνώση μένει', async () => {
    const stored: ContactRegistryCheckRecord = { companyId: 'comp_a', contactId: 'cont_1', checkedAt: '2026-01-01T00:00:00.000Z', checkedBy: 'u', record: AE_RECORD };
    const f = fake({ lookup: { kind: 'unavailable', reason: 'rate-limited' }, stored });
    const run = await verifyContactRegistry(TARGET, contactDoc(), 'user_1', f.deps);
    expect(run.report.attempt).toEqual({ kind: 'unavailable', reason: 'rate-limited' });
    expect(f.forgotten).toEqual([]);
    expect(run.report.check?.checkedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('Γ2 — absent με τον αριθμό της επαφής ⇒ σβήνεται το αντίγραφο ΑΥΤΟΥ του αριθμού', async () => {
    const f = fake({ lookup: { kind: 'absent' } });
    const run = await verifyContactRegistry(TARGET, contactDoc(), 'user_1', f.deps);
    expect(run.report.attempt).toEqual({ kind: 'not-found' });
    expect(f.forgotten).toEqual(['123456789000']);
  });

  it('Γ3 — absent για αριθμό που βρέθηκε με ΑΦΜ ⇒ ΚΑΝΕΝΑ σβήσιμο', async () => {
    const f = fake({ lookup: { kind: 'absent' } });
    await verifyContactRegistry(TARGET, contactDoc({ gemiNumber: '' }), 'user_1', f.deps);
    expect(f.forgotten).toEqual([]);
  });
});

describe('Δ — η επαφή άλλαξε όσο ρωτούσαμε', () => {
  it('Δ1 — η αποθήκη αρνείται ⇒ contact-changed, ποτέ «asked»', async () => {
    const f = fake({ contactChanged: true });
    const run = await verifyContactRegistry(TARGET, contactDoc(), 'user_1', f.deps);
    expect(run.report.attempt).toEqual({ kind: 'contact-changed' });
    expect(run.recorded).toBeNull();
  });
});

describe('Ε — η ανάγνωση δεν ρωτά ποτέ το ΓΕΜΗ', () => {
  it('Ε1 — συγκρίνει την ΤΡΕΧΟΥΣΑ επαφή με την αποθηκευμένη απάντηση', async () => {
    const stored: ContactRegistryCheckRecord = { companyId: 'comp_a', contactId: 'cont_1', checkedAt: NOW, checkedBy: 'u', record: AE_RECORD };
    const f = fake({ stored });
    const report = await readContactRegistryReport(TARGET, contactDoc({ companyName: 'ΑΛΛΗ ΕΠΩΝΥΜΙΑ' }), f.deps);
    expect(f.lookups).toEqual([]);
    expect(f.taxSearches).toEqual([]);
    expect(report.attempt).toEqual({ kind: 'not-asked' });
    expect(report.comparison?.legalName.state).toBe('differs');
  });

  it('Ε2 — αποθηκευμένη απάντηση που ο σημερινός χάρτης αρνείται ⇒ καμία σύγκριση', async () => {
    const stored: ContactRegistryCheckRecord = {
      companyId: 'comp_a', contactId: 'cont_1', checkedAt: NOW, checkedBy: 'u',
      record: registryRecord({ legalForm: { id: '1', label: 'ΑΛΛΟ ΝΟΗΜΑ' } }),
    };
    const report = await readContactRegistryReport(TARGET, contactDoc(), fake({ stored }).deps);
    expect(report.check).not.toBeNull();
    expect(report.comparison).toBeNull();
  });
});
