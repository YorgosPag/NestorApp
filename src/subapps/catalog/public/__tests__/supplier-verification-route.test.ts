/**
 * @fileoverview Άγκυρες της διαλογής επιβεβαίωσης προμηθευτή — ADR-923 §5.13 Ε1α.
 */

import {
  routeAllowsApproval,
  routeOpensReview,
  routeSupplierVerification,
  routeWithoutRegistry,
  type SupplierVerificationRoute,
} from '@/subapps/catalog/public/supplier-verification-route';
import type {
  RegistryCheck,
  RegistryIdentityGap,
  RegistryIdentityJudgment,
  RegistryTaxBinding,
} from '@/types/company-registry';

const CHECK = {} as RegistryCheck;
const VERIFIED: RegistryIdentityJudgment = { state: 'verified', issuer: 'gemi', check: CHECK };
const MATCHED: RegistryTaxBinding = { state: 'matched' };
const gap = (value: RegistryIdentityGap): RegistryIdentityJudgment => ({ state: 'declared', gap: value, check: null });

describe('routeSupplierVerification', () => {
  it('αυτόματη επιβεβαίωση μόνο με επαληθευμένο μητρώο και ταίριασμα ΑΦΜ', () => {
    expect(routeSupplierVerification(VERIFIED, MATCHED)).toEqual({ kind: 'verified' });
  });

  it.each<[RegistryTaxBinding]>([[{ state: 'mismatched' }], [{ state: 'not-found' }], [{ state: 'not-comparable', gap: 'no-registration-number' }]])(
    'επαληθευμένο μητρώο με διαφωνία ΑΦΜ πάει σε έλεγχο: %j',
    (binding) => {
      expect(routeSupplierVerification(VERIFIED, binding)).toEqual({ kind: 'manual-review', approvable: true });
    },
  );

  it('μητρώο που δεν απάντησε δεν ανοίγει ουρά', () => {
    expect(routeSupplierVerification(VERIFIED, { state: 'undetermined', reason: 'network' })).toEqual({ kind: 'ask-registry' });
  });

  it('ετυμηγορία που έπεσε ξαναρωτά το μητρώο', () => {
    expect(routeSupplierVerification(VERIFIED, { state: 'not-asked' })).toEqual({ kind: 'ask-registry' });
  });

  it('άκυρο ΑΦΜ διορθώνεται στο προφίλ', () => {
    expect(routeSupplierVerification(VERIFIED, { state: 'not-comparable', gap: 'invalid-tax-id' })).toEqual({ kind: 'correct-tax-id' });
  });

  it.each<[RegistryIdentityGap]>([
    ['no-registration-number'],
    ['invalid-registration-number'],
    ['not-in-registry'],
    ['status-unknown'],
  ])('το κενό %s πάει σε εγκρίσιμο έλεγχο, ακόμη και με ταίριασμα ΑΦΜ', (value) => {
    expect(routeSupplierVerification(gap(value), MATCHED)).toEqual({ kind: 'manual-review', approvable: true });
  });

  it.each<[RegistryIdentityGap]>([['not-checked'], ['check-unreadable'], ['number-mismatch']])('το κενό %s ξαναρωτά το μητρώο', (value) => {
    expect(routeSupplierVerification(gap(value), MATCHED)).toEqual({ kind: 'ask-registry' });
  });

  it('η διαφορά επωνυμίας πάει στην υιοθέτηση, όχι στην ουρά', () => {
    expect(routeSupplierVerification(gap('name-mismatch'), MATCHED)).toEqual({ kind: 'adopt-legal-name' });
  });

  it.each<[RegistryTaxBinding]>([[MATCHED], [{ state: 'mismatched' }], [{ state: 'undetermined', reason: 'server' }]])(
    'κλεισμένη εταιρεία δεν γίνεται ποτέ εγκρίσιμη: %j',
    (binding) => {
      expect(routeSupplierVerification(gap('inactive'), binding)).toEqual({ kind: 'manual-review', approvable: false });
    },
  );
});

describe('routeWithoutRegistry', () => {
  it('χωρίς μητρώο το «ρώτα ξανά» γίνεται έγγραφο', () => {
    expect(routeWithoutRegistry({ kind: 'ask-registry' })).toEqual({ kind: 'submit-document' });
  });

  it.each<[SupplierVerificationRoute]>([
    [{ kind: 'verified' }],
    [{ kind: 'adopt-legal-name' }],
    [{ kind: 'correct-tax-id' }],
    [{ kind: 'manual-review', approvable: false }],
    [{ kind: 'manual-review', approvable: true }],
  ])('οι άλλες διαλογές δεν αλλάζουν: %j', (route) => {
    expect(routeWithoutRegistry(route)).toEqual(route);
  });
});

describe('ποια διαλογή επιτρέπει τι', () => {
  it.each<[SupplierVerificationRoute, boolean, boolean]>([
    [{ kind: 'verified' }, false, false],
    [{ kind: 'ask-registry' }, true, false],
    [{ kind: 'submit-document' }, true, true],
    [{ kind: 'adopt-legal-name' }, false, false],
    [{ kind: 'correct-tax-id' }, false, false],
    [{ kind: 'manual-review', approvable: true }, true, true],
    [{ kind: 'manual-review', approvable: false }, false, false],
  ])('%j ⇒ έγκριση %s · αίτηση %s', (route, approval, review) => {
    expect(routeAllowsApproval(route)).toBe(approval);
    expect(routeOpensReview(route)).toBe(review);
  });
});
