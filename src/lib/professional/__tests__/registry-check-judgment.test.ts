/**
 * ADR-915 §40.7 Φ2 — η κρίση του ελέγχου στο μητρώο: από το ζεύγος, ποτέ αποθηκευμένη.
 */

import { formShowcaseLicences } from '@/lib/agency/showcase-licence';
import {
  judgeRegistryCheck,
  licenceStandingOf,
  registryCheckSubjectOf,
  sameSurname,
} from '@/lib/professional/registry-check-judgment';
import type { ProfessionalRegistryCheckRecord } from '@/types/professional-registry-check';

function inspector(number: string) {
  const result = formShowcaseLicences([{ licence: 'energy-inspector', registrationNumber: number }]);
  if ('reason' in result) throw new Error(result.reason);
  return result.licences[0];
}

const RECORD: ProfessionalRegistryCheckRecord = {
  companyId: 'comp_1',
  contactId: 'cont_1',
  licence: 'energy-inspector',
  number: '2600',
  surname: 'ΔΟΚΙΜΑΣΤΙΚΟΣ',
  grades: { buildings: 'B', heating: 'none', cooling: 'A' },
  rowSha256: 'f'.repeat(64),
  checkedAt: '2026-11-15T10:00:00.000Z',
  checkedBy: 'uid_1',
};

describe('Ε — επώνυμο', () => {
  it('Ε1 τόνοι · κεφαλαία · λατινικά δεν μετρούν', () => {
    expect(sameSurname('Δοκιμαστικός', 'ΔΟΚΙΜΑΣΤΙΚΟΣ')).toBe(true);
    expect(sameSurname('Dokimastikos', 'ΔΟΚΙΜΑΣΤΙΚΟΣ')).toBe(true);
    expect(sameSurname('Παπαδόπουλος', 'ΔΟΚΙΜΑΣΤΙΚΟΣ')).toBe(false);
  });

  it('Ε2 κενό ⇒ δεν αποδεικνύει τίποτα', () => {
    expect(sameSurname('', '')).toBe(false);
  });
});

describe('Κ — κρίση', () => {
  const subject = { licence: 'energy-inspector' as const, held: inspector('2600'), lastName: 'Δοκιμαστικός' };

  it('Κ1 ίδιος αριθμός + ίδιο επώνυμο ⇒ verified, με τις τάξεις της ΑΡΧΗΣ', () => {
    expect(judgeRegistryCheck(subject, RECORD)).toEqual({ state: 'verified', grades: RECORD.grades, checkedAt: RECORD.checkedAt });
  });

  it('Κ2 άλλο επώνυμο ⇒ name-mismatch (ο αριθμός ανήκει σε άλλον)', () => {
    expect(judgeRegistryCheck({ ...subject, lastName: 'Μαυρίδης' }, RECORD)).toEqual({ state: 'name-mismatch', checkedAt: RECORD.checkedAt });
  });

  it('Κ3 η επαφή άλλαξε αριθμό μετά τον έλεγχο ⇒ stale-number, ΠΟΤΕ verified', () => {
    expect(judgeRegistryCheck({ ...subject, held: inspector('2700') }, RECORD)).toEqual({ state: 'stale-number', checkedAt: RECORD.checkedAt });
  });

  it('Κ4 κανένας έλεγχος · η επαφή δεν έχει πια την άδεια ⇒ not-checked', () => {
    expect(judgeRegistryCheck(subject, null)).toEqual({ state: 'not-checked' });
    expect(judgeRegistryCheck({ ...subject, held: null }, RECORD)).toEqual({ state: 'not-checked' });
  });
});

describe('Τ — η τάξη που μετρά (§40.7 Φ3)', () => {
  const held = { ...inspector('2600'), grades: { buildings: 'A' as const } };

  it('Τ1 verified ⇒ οι τάξεις της ΑΡΧΗΣ υπερισχύουν της δήλωσης', () => {
    expect(licenceStandingOf(held, { state: 'verified', grades: RECORD.grades, checkedAt: RECORD.checkedAt }))
      .toEqual({ grades: RECORD.grades, source: 'registry', checkedAt: RECORD.checkedAt });
  });

  it('Τ2 name-mismatch · stale-number · not-checked ⇒ η δήλωση, χωρίς ημερομηνία ελέγχου', () => {
    const declared = { grades: { buildings: 'A' }, source: 'declared', checkedAt: null };
    expect(licenceStandingOf(held, { state: 'name-mismatch', checkedAt: RECORD.checkedAt })).toEqual(declared);
    expect(licenceStandingOf(held, { state: 'stale-number', checkedAt: RECORD.checkedAt })).toEqual(declared);
    expect(licenceStandingOf(held, { state: 'not-checked' })).toEqual(declared);
  });

  it('Τ3 καμία δηλωμένη τάξη ⇒ κενές τάξεις (άγνοια, όχι «Όχι»)', () => {
    expect(licenceStandingOf(inspector('2600'), { state: 'not-checked' })).toEqual({ grades: {}, source: 'declared', checkedAt: null });
  });
});

describe('Σ — το υποκείμενο από το ωμό έγγραφο επαφής', () => {
  it('Σ1 η άδεια που κρατά η επαφή + το επώνυμο', () => {
    expect(registryCheckSubjectOf({ lastName: 'Δοκιμαστικός', licences: [] }, 'energy-inspector'))
      .toEqual({ licence: 'energy-inspector', held: null, lastName: 'Δοκιμαστικός' });
  });

  it('Σ2 επώνυμο που δεν είναι κείμενο ⇒ κενό (δεν αποδεικνύει τίποτα)', () => {
    expect(registryCheckSubjectOf({ lastName: 42 }, 'energy-inspector').lastName).toBe('');
  });
});
