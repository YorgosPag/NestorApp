/**
 * @jest-environment node
 *
 * @fileoverview Άγκυρες της **επαλήθευσης νομικής ταυτότητας** — ADR-841 §7 Α23 (Φ2).
 * @related services/company-registry/company-registry-verification.service.ts
 *
 * ⚠️ `FakeFirestore` + **αληθινή** αποθήκη αντιγράφου + **αληθινή** κρίση. Εγχέονται μόνο το
 * προφίλ, το μητρώο και το ρολόι.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { CompanyRegistryDeclarationRead } from '@/services/company/company-legal-identity';
import { recordRegistryCheck } from '@/services/company-registry/company-registry-record.service';
import {
  readRegistryIdentityReport,
  verifyRegistryIdentity,
  type RegistryVerificationDeps,
} from '@/services/company-registry/company-registry-verification.service';
import { registryRecord } from '@/lib/company/__fixtures__/registry-record-fixture';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { RegistryLookupVerdict } from '@/types/company-registry';

const COMPANY_ID = 'comp_verify_a';
const NOW = '2026-09-14T12:00:00.000Z';
const EARLIER = '2026-09-01T09:00:00.000Z';

// 🔑 Η επωνυμία γράφεται ρητά: το {@link PROFILE} τη δηλώνει με άλλη ορθογραφία («Α.Ε.»).
const RECORD = registryRecord({ legalName: 'ΑΛΦΑ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ' });

const PROFILE: CompanyRegistryDeclarationRead = {
  kind: 'present',
  declaration: { entityType: 'ae', businessName: 'ΑΛΦΑ Κατασκευαστική Α.Ε.', gemiNumber: '123456789000' },
};

function setup(profile: CompanyRegistryDeclarationRead, verdict: RegistryLookupVerdict = { kind: 'found', record: RECORD }) {
  const fake = new FakeFirestore();
  const lookups: string[] = [];
  const deps: RegistryVerificationDeps = {
    readDeclaration: async () => profile,
    lookup: async (registrationNumber) => {
      lookups.push(registrationNumber);
      return verdict;
    },
    now: () => NOW,
  };
  return { fake, adminDb: fake as unknown as AdminFirestore, deps, lookups };
}

describe('Π — η πράξη ρωτά, αποθηκεύει, κρίνει', () => {
  it('Π1 — found + ίδια επωνυμία ⇒ verified με ΣΗΜΕΡΙΝΗ ημερομηνία, και το αντίγραφο γράφτηκε', async () => {
    const { fake, adminDb, deps, lookups } = setup(PROFILE);
    const outcome = await verifyRegistryIdentity(adminDb, COMPANY_ID, deps);

    expect(lookups).toEqual(['123456789000']);
    expect(outcome.kind === 'report' && outcome.report.judgment).toEqual({
      state: 'verified',
      issuer: 'gemi',
      check: { record: RECORD, checkedAt: NOW },
    });
    expect(outcome.kind === 'report' && outcome.report.freshness).toEqual({ kind: 'asked' });
    expect(fake.all(COLLECTIONS.COMPANY_REGISTRY_RECORDS)).toHaveLength(1);
  });

  it('Π2 — found αλλά άλλη επωνυμία ⇒ declared/name-mismatch, και η απάντηση ΜΕΝΕΙ για «Υιοθέτηση»', async () => {
    const renamed = { ...RECORD, legalName: 'ΒΗΤΑ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ' };
    const { adminDb, deps } = setup(PROFILE, { kind: 'found', record: renamed });
    const outcome = await verifyRegistryIdentity(adminDb, COMPANY_ID, deps);

    expect(outcome.kind === 'report' && outcome.report.judgment).toEqual({
      state: 'declared',
      gap: 'name-mismatch',
      check: { record: renamed, checkedAt: NOW },
    });
  });

  it('Π3 — 🔴 absent ⇒ not-in-registry, και το παλιό αντίγραφο ΣΒΗΝΕΤΑΙ', async () => {
    const { fake, adminDb, deps } = setup(PROFILE, { kind: 'absent' });
    await recordRegistryCheck(adminDb, COMPANY_ID, RECORD, EARLIER);
    const outcome = await verifyRegistryIdentity(adminDb, COMPANY_ID, deps);

    expect(outcome.kind === 'report' && outcome.report.judgment).toEqual({
      state: 'declared',
      gap: 'not-in-registry',
      check: null,
    });
    expect(fake.all(COLLECTIONS.COMPANY_REGISTRY_RECORDS)).toHaveLength(0);
  });

  it('Π4 — 🔑 unavailable ΔΕΝ ακυρώνει την παλιά γνώση, αλλά ΛΕΕΙ ότι η ερώτηση απέτυχε', async () => {
    const { adminDb, deps } = setup(PROFILE, { kind: 'unavailable', reason: 'rate-limited' });
    await recordRegistryCheck(adminDb, COMPANY_ID, RECORD, EARLIER);
    const outcome = await verifyRegistryIdentity(adminDb, COMPANY_ID, deps);

    expect(outcome.kind === 'report' && outcome.report.judgment).toEqual({
      state: 'verified',
      issuer: 'gemi',
      check: { record: RECORD, checkedAt: EARLIER },
    });
    expect(outcome.kind === 'report' && outcome.report.freshness).toEqual({ kind: 'unavailable', reason: 'rate-limited' });
  });

  it('Π5 — χωρίς αριθμό στο προφίλ ⇒ ΚΑΜΙΑ ερώτηση, κενό no-registration-number', async () => {
    const noNumber: CompanyRegistryDeclarationRead = {
      kind: 'present',
      declaration: { entityType: 'sole_proprietor', businessName: 'Γ. ΠΑΠΑΣ', gemiNumber: null },
    };
    const { adminDb, deps, lookups } = setup(noNumber);
    const outcome = await verifyRegistryIdentity(adminDb, COMPANY_ID, deps);

    expect(lookups).toHaveLength(0);
    expect(outcome.kind === 'report' && outcome.report.judgment).toEqual({
      state: 'declared',
      gap: 'no-registration-number',
      check: null,
    });
  });

  it('Π6 — 🔴 το προφίλ δεν διαβάστηκε ⇒ profile-unavailable και ΚΑΜΙΑ ερώτηση (όχι «χωρίς αριθμό»)', async () => {
    const { adminDb, deps, lookups } = setup({ kind: 'unavailable' });
    expect(await verifyRegistryIdentity(adminDb, COMPANY_ID, deps)).toEqual({ kind: 'profile-unavailable' });
    expect(lookups).toHaveLength(0);
  });
});

describe('Α — η ανάγνωση ΔΕΝ ρωτά το μητρώο', () => {
  it('Α1 — κρίνει το αποθηκευμένο ζεύγος χωρίς καμία κλήση', async () => {
    const { adminDb, deps, lookups } = setup(PROFILE);
    await recordRegistryCheck(adminDb, COMPANY_ID, RECORD, EARLIER);
    const outcome = await readRegistryIdentityReport(adminDb, COMPANY_ID, deps);

    expect(lookups).toHaveLength(0);
    expect(outcome.kind === 'report' && outcome.report.judgment.state).toBe('verified');
    expect(outcome.kind === 'report' && outcome.report.freshness).toEqual({ kind: 'not-asked' });
  });

  it('Α2 — 🔴 drift: ο αριθμός άλλαξε στο προφίλ ⇒ το σήμα πέφτει στην ΕΠΟΜΕΝΗ ανάγνωση', async () => {
    const changed: CompanyRegistryDeclarationRead = {
      kind: 'present',
      declaration: { ...PROFILE.declaration, gemiNumber: '999999999000' },
    };
    const { adminDb, deps } = setup(changed);
    await recordRegistryCheck(adminDb, COMPANY_ID, RECORD, EARLIER);
    const outcome = await readRegistryIdentityReport(adminDb, COMPANY_ID, deps);

    expect(outcome.kind === 'report' && outcome.report.judgment.state).toBe('declared');
    expect(outcome.kind === 'report' && outcome.report.judgment.state === 'declared' && outcome.report.judgment.gap)
      .toBe('number-mismatch');
  });
});
