/**
 * @fileoverview Άγκυρες του **«πού στέκεται ο οργανισμός απέναντι στο ΓΕΜΗ;»** — ADR-841 §7 Α23.9 Φέτα Β.
 * @related lib/agency/registry-standing.ts
 *
 * 🔴 Η άγκυρα που μετρά περισσότερο είναι η **Σ1**: το κλείσιμο της δημοσιευμένης βιτρίνας **προηγείται** κάθε
 * κρίσης — ακόμη και «επαληθευμένης». Ανάποδη σειρά θα έδειχνε στον κάτοχο «όλα καλά» ενώ ο κόσμος βλέπει «κλειστή».
 */

import { registryCheck } from '@/lib/company/__fixtures__/registry-record-fixture';
import {
  needsRegistrationFix,
  registryStandingOf,
  standingCheckedAt,
} from '@/lib/agency/registry-standing';
import type {
  RegistryIdentityGap,
  RegistryIdentityJudgment,
  RegistryIdentityReport,
} from '@/types/company-registry';
import type { RegistryClosure } from '@/types/showcase-legal-identity';

const CHECK = registryCheck({ registrationNumber: '123401000', legalName: 'ΑΛΦΑ ΑΕ' });
const CLOSURE: RegistryClosure = { issuer: 'gemi', checkedAt: '2026-09-10T08:00:00.000Z' };

function reportWith(judgment: RegistryIdentityJudgment): RegistryIdentityReport {
  return {
    declaration: { entityType: 'ae', businessName: 'ΑΛΦΑ ΑΕ', gemiNumber: '123401000' },
    judgment,
    freshness: { kind: 'not-asked' },
  };
}

const VERIFIED = reportWith({ state: 'verified', issuer: 'gemi', check: CHECK });
const declared = (gap: RegistryIdentityGap): RegistryIdentityReport =>
  reportWith({ state: 'declared', gap, check: CHECK });

describe('Σ — μία σειρά', () => {
  it('Σ1 — 🔴 κλειστή βιτρίνα ⇒ closed, ΑΚΟΜΗ και με επαληθευμένη κρίση', () => {
    expect(registryStandingOf(CLOSURE, VERIFIED)).toEqual({ kind: 'closed', closure: CLOSURE });
  });

  it('Σ2 — 🔑 ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: ίδια κρίση χωρίς κλείσιμο ⇒ verified με την ημερομηνία ελέγχου', () => {
    expect(registryStandingOf(null, VERIFIED)).toEqual({ kind: 'verified', checkedAt: CHECK.checkedAt });
  });

  it('Σ3 — καμία αναφορά (φορτώνει · όχι διαχειριστής · βλάβη) ⇒ unknown, ποτέ «όλα καλά»', () => {
    expect(registryStandingOf(null, null)).toEqual({ kind: 'unknown' });
  });

  it('Σ4 — χωρίς αριθμό ΓΕΜΗ ⇒ unregistered, όχι attention (δεν του λείπει τίποτα)', () => {
    expect(registryStandingOf(null, declared('no-registration-number'))).toEqual({ kind: 'unregistered' });
  });

  it('Σ5 — κάθε άλλο κενό ⇒ attention με το ίδιο το κενό', () => {
    expect(registryStandingOf(null, declared('name-mismatch'))).toEqual({ kind: 'attention', gap: 'name-mismatch' });
  });
});

describe('Η — η ημερομηνία δίπλα στην ένδειξη', () => {
  it('Η1 — κλειστή ⇒ ο έλεγχος του κλεισίματος · επαληθευμένη ⇒ ο έλεγχος της κρίσης · αλλιώς null', () => {
    expect(standingCheckedAt({ kind: 'closed', closure: CLOSURE })).toBe(CLOSURE.checkedAt);
    expect(standingCheckedAt({ kind: 'verified', checkedAt: CHECK.checkedAt })).toBe(CHECK.checkedAt);
    expect(standingCheckedAt({ kind: 'attention', gap: 'not-checked' })).toBeNull();
  });
});

describe('Δ — πού ζει η θεραπεία', () => {
  it.each([
    ['no-registration-number', true],
    ['invalid-registration-number', true],
    ['not-in-registry', true],
    ['number-mismatch', true],
    ['inactive', true],
    ['not-checked', false],
    ['check-unreadable', false],
    ['status-unknown', false],
    ['name-mismatch', false],
  ] as const)('Δ — %s ⇒ διόρθωση αριθμού: %s', (gap, expected) => {
    expect(needsRegistrationFix(declared(gap).judgment)).toBe(expected);
  });

  it('Δ10 — επαληθευμένη ⇒ καμία διόρθωση', () => {
    expect(needsRegistrationFix(VERIFIED.judgment)).toBe(false);
  });
});
