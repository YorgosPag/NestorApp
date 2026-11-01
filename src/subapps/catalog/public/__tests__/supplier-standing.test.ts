/**
 * @fileoverview Άγκυρες της κρίσης επιβεβαίωσης προμηθευτή — ADR-923 §5.13 · §16.
 */

import { judgeSupplierStanding, taxBindingFromStored } from '@/subapps/catalog/public/supplier-standing';
import type { StoredTaxBinding, SupplierIdentityFacts } from '@/subapps/catalog/types/supplier-verification';
import type { RegistryCheck, RegistryIdentityGap, RegistryIdentityJudgment } from '@/types/company-registry';

const NUMBER = '123456789000';
const FACTS: SupplierIdentityFacts = { legalName: 'ΑΛΦΑ ΑΕ', gemiNumber: NUMBER, taxFingerprint: 'fp' };
const STORED: StoredTaxBinding = { outcome: 'matched', taxFingerprint: 'fp', registrationNumber: NUMBER, checkedAt: '2026-11-01T00:00:00Z' };
const VERIFIED: RegistryIdentityJudgment = { state: 'verified', issuer: 'gemi', check: {} as RegistryCheck };
const gap = (value: RegistryIdentityGap): RegistryIdentityJudgment => ({ state: 'declared', gap: value, check: null });
const MANUAL = { kind: 'verified', basis: 'manual-review' };
const UNVERIFIED = { kind: 'unverified' };

describe('taxBindingFromStored', () => {
  it('κρατά την ετυμηγορία για το ίδιο ζεύγος', () => {
    expect(taxBindingFromStored(STORED, FACTS)).toEqual({ state: 'matched' });
    expect(taxBindingFromStored({ ...STORED, outcome: 'mismatched' }, FACTS)).toEqual({ state: 'mismatched' });
  });

  it('πέφτει όταν αλλάξει το ΑΦΜ', () => {
    expect(taxBindingFromStored(STORED, { ...FACTS, taxFingerprint: 'other' })).toEqual({ state: 'not-asked' });
  });

  it('πέφτει όταν αλλάξει ο αριθμός', () => {
    expect(taxBindingFromStored(STORED, { ...FACTS, gemiNumber: '999999999000' })).toEqual({ state: 'not-asked' });
  });

  it('χωρίς ετυμηγορία δεν έχει ρωτηθεί', () => {
    expect(taxBindingFromStored(null, FACTS)).toEqual({ state: 'not-asked' });
  });

  it('ονομάζει ποιο στοιχείο λείπει', () => {
    expect(taxBindingFromStored(STORED, { ...FACTS, taxFingerprint: null })).toEqual({ state: 'not-comparable', gap: 'invalid-tax-id' });
    expect(taxBindingFromStored(STORED, { ...FACTS, gemiNumber: null })).toEqual({ state: 'not-comparable', gap: 'no-registration-number' });
  });
});

describe('judgeSupplierStanding', () => {
  const base = { registry: VERIFIED, taxBinding: { state: 'matched' }, facts: FACTS, approval: null } as const;

  it('επιβεβαιώνει από το μητρώο χωρίς έγκριση', () => {
    expect(judgeSupplierStanding(base)).toEqual({ kind: 'verified', basis: 'registry' });
  });

  it('διαφωνία χωρίς έγκριση δεν επιβεβαιώνεται', () => {
    expect(judgeSupplierStanding({ ...base, taxBinding: { state: 'mismatched' } })).toEqual(UNVERIFIED);
  });

  it('έγκριση με ίδιο στιγμιότυπο επιβεβαιώνει διαφωνία ΑΦΜ', () => {
    expect(judgeSupplierStanding({ ...base, taxBinding: { state: 'mismatched' }, approval: FACTS })).toEqual(MANUAL);
  });

  it('έγκριση επιζεί όταν το not-in-registry διαβάζεται ως not-checked', () => {
    expect(judgeSupplierStanding({ ...base, registry: gap('not-checked'), approval: FACTS })).toEqual(MANUAL);
  });

  it.each([
    ['επωνυμία', { legalName: 'ΒΗΤΑ ΑΕ' }],
    ['αριθμός', { gemiNumber: '999999999000' }],
    ['ΑΦΜ', { taxFingerprint: 'other' }],
  ])('αλλαγή στοιχείου ακυρώνει την έγκριση: %s', (_label, change) => {
    const inputs = { ...base, registry: gap('not-in-registry'), approval: FACTS, facts: { ...FACTS, ...change } };
    expect(judgeSupplierStanding(inputs)).toEqual(UNVERIFIED);
  });

  it('κλεισμένη εταιρεία δεν επιβεβαιώνεται ούτε με έγκριση', () => {
    expect(judgeSupplierStanding({ ...base, registry: gap('inactive'), approval: FACTS })).toEqual(UNVERIFIED);
  });

  it('διαφορά επωνυμίας δεν λύνεται με έγκριση', () => {
    expect(judgeSupplierStanding({ ...base, registry: gap('name-mismatch'), approval: FACTS })).toEqual(UNVERIFIED);
  });

  it('άκυρο ΑΦΜ δεν λύνεται με έγκριση', () => {
    const taxBinding = { state: 'not-comparable', gap: 'invalid-tax-id' } as const;
    expect(judgeSupplierStanding({ ...base, taxBinding, approval: FACTS })).toEqual(UNVERIFIED);
  });
});
