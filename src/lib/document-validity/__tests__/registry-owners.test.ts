/**
 * ADR-915 §25 — **ποιος είναι ο ιδιοκτήτης**: ο καθαρός κανόνας. Συνθετικά δεδομένα μόνο.
 */

import {
  companyPropertyOwners,
  distinctContactIds,
  mandatedPropertyOwners,
  type CompanyPropertyOwnership,
} from '@/lib/document-validity/registry-owners';

const BASE: CompanyPropertyOwnership = {
  legalPhase: null, buyerContactIds: [], sellerContactIds: [], projectCompanyContactId: 'cont_company',
};

describe('distinctContactIds', () => {
  it('σειρά πρώτης εμφάνισης, χωρίς κενά, `null` ή διπλά (και μετά από trim)', () => {
    expect(distinctContactIds(['cont_b', null, ' ', 'cont_a', ' cont_b ', undefined])).toEqual(['cont_b', 'cont_a']);
  });
});

describe('ακίνητο ιδιώτη υπό εντολή', () => {
  it('οι πελάτες των εντολών — ο ίδιος πελάτης σε δύο εντολές είναι ΕΝΑΣ ιδιοκτήτης', () => {
    expect(mandatedPropertyOwners([{ clientContactId: 'cont_x' }, { clientContactId: 'cont_x' }, { clientContactId: 'cont_y' }]))
      .toEqual(['cont_x', 'cont_y']);
  });

  it('χωρίς εντολή ⇒ κανείς (ποτέ ο συγγραφέας της εγγραφής)', () => {
    expect(mandatedPropertyOwners([])).toEqual([]);
  });
});

describe('ακίνητο εταιρείας', () => {
  it('μετά το οριστικό ⇒ οι αγοραστές, όχι η εταιρεία ούτε οι πωλητές', () => {
    expect(companyPropertyOwners({ ...BASE, legalPhase: 'final_signed', buyerContactIds: ['cont_buyer'], sellerContactIds: ['cont_s'] }))
      .toEqual(['cont_buyer']);
    expect(companyPropertyOwners({ ...BASE, legalPhase: 'payoff_completed', buyerContactIds: ['cont_buyer'] })).toEqual(['cont_buyer']);
  });

  it('αγοραστές ΠΡΙΝ το οριστικό (προσύμφωνο) ⇒ ΔΕΝ είναι ιδιοκτήτες', () => {
    expect(companyPropertyOwners({ ...BASE, legalPhase: 'preliminary_signed', buyerContactIds: ['cont_buyer'] })).toEqual(['cont_company']);
  });

  it('ανοιχτή υπόθεση ⇒ οι μεταβιβάζοντες (μαζί οι συμπωλητές), όχι μόνο η εταιρεία του έργου', () => {
    expect(companyPropertyOwners({ ...BASE, sellerContactIds: ['cont_company', 'cont_landowner', null] }))
      .toEqual(['cont_company', 'cont_landowner']);
  });

  it('οριστικό χωρίς καταγεγραμμένους αγοραστές ⇒ ΔΕΝ εφευρίσκεται ιδιοκτήτης: πέφτει στην επόμενη πηγή', () => {
    expect(companyPropertyOwners({ ...BASE, legalPhase: 'final_signed' })).toEqual(['cont_company']);
  });

  it('τίποτα γνωστό ⇒ `[]` («δεν έχει οριστεί»), ποτέ μαντεψιά', () => {
    expect(companyPropertyOwners({ ...BASE, projectCompanyContactId: null, sellerContactIds: [null] })).toEqual([]);
  });
});
