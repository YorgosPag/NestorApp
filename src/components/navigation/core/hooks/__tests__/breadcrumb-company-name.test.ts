/**
 * ΑΓΚΥΡΑ — **στο breadcrumb δεν εμφανίζεται ποτέ η ταυτότητα της εταιρείας** (ADR-016).
 *
 * 🔴 Μετρημένο ζωντανά 2026-10-04: αμέσως μετά τη δημιουργία έργου η γραμμή πλοήγησης έγραφε
 * `cont_…`. Τρία σημεία του `useBreadcrumbSync` είχαν `όνομα || companyId`.
 */

/* global describe, it, expect */

import { breadcrumbCompanyName } from '../breadcrumb-company-name';

const COMPANIES = [
  { id: 'cont_abc', companyName: 'ΔΟΚΙΜΗ Α.Ε.' },
  { id: 'cont_def', companyName: '  ' },
];

describe('breadcrumbCompanyName', () => {
  it('προτιμά το πρώτο όνομα που υπάρχει, με τη σειρά εμπιστοσύνης', () => {
    expect(
      breadcrumbCompanyName({ companyId: 'cont_abc', candidates: ['', 'Όνομα οντότητας'], companies: COMPANIES }),
    ).toBe('Όνομα οντότητας');
  });

  it('χωρίς όνομα ⇒ το βρίσκει στις εταιρείες της πλοήγησης', () => {
    expect(
      breadcrumbCompanyName({ companyId: 'cont_abc', candidates: [undefined, ''], companies: COMPANIES }),
    ).toBe('ΔΟΚΙΜΗ Α.Ε.');
  });

  it('κανείς δεν ξέρει το όνομα ⇒ ΚΕΝΟ, ποτέ η ταυτότητα', () => {
    const name = breadcrumbCompanyName({ companyId: 'cont_zzz', candidates: [null, ''], companies: COMPANIES });
    expect(name).toBe('');
  });

  it('«όνομα» που είναι η ίδια η ταυτότητα (παλιά δεδομένα) δεν μετράει ως όνομα', () => {
    expect(
      breadcrumbCompanyName({ companyId: 'cont_abc', candidates: ['cont_abc'], companies: COMPANIES }),
    ).toBe('ΔΟΚΙΜΗ Α.Ε.');
    expect(
      breadcrumbCompanyName({ companyId: 'cont_zzz', candidates: ['cont_zzz'], companies: COMPANIES }),
    ).toBe('');
  });

  it('κενό όνομα εταιρείας στην πλοήγηση παραμένει κενό', () => {
    expect(breadcrumbCompanyName({ companyId: 'cont_def', candidates: [], companies: COMPANIES })).toBe('');
  });

  it('χωρίς ταυτότητα και χωρίς όνομα ⇒ κενό', () => {
    expect(breadcrumbCompanyName({ companyId: '', candidates: [''], companies: COMPANIES })).toBe('');
  });
});
