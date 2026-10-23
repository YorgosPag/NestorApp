/**
 * ΑΓΚΥΡΑ — **ο ανιχνευτής αλλαγής του κτιρίου βλέπει ό,τι διαβάζει η αγγελία, και μόνο αυτό** (ADR-919 §9).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ο `PATCH /api/buildings` απαριθμούσε με το χέρι τα πεδία που ξαναπροβάλλουν, και η λίστα
 * ξέμεινε πίσω από τον αναγνώστη: αλλαγή `status` / `completionDeclaration` δεν έφτανε ποτέ στην αγγελία.
 */

/* global describe, it, expect */

import { buildingChainFactsOf, buildingListingFactsChanged } from '../building-listing-facts';

const DECLARATION = {
  provenance: 'declared',
  value: { precision: 'quarter', anchor: '2027-07-01' },
  at: '2026-10-23T10:00:00.000Z',
};

const STORED = {
  name: 'Κτίριο Α',
  projectId: 'proj_1',
  placeRef: { kind: 'plot', id: 'plc_1' },
  constructionYear: 2026,
  status: 'construction',
  completionDeclaration: DECLARATION,
};

describe('Α — αλλαγή εισόδου της αγγελίας ⇒ επαναπροβολή', () => {
  it('Α1 — το κτίριο παραδόθηκε (`status`)', () => {
    expect(buildingListingFactsChanged(STORED, { status: 'completed' })).toBe(true);
  });

  it('Α2 — μετατέθηκε η δημόσια υπόσχεση (`completionDeclaration`)', () => {
    const moved = { ...DECLARATION, value: { precision: 'quarter', anchor: '2027-10-01' } };
    expect(buildingListingFactsChanged(STORED, { completionDeclaration: moved })).toBe(true);
  });

  it('Α3 — αποσύρθηκε η υπόσχεση (`null`)', () => {
    expect(buildingListingFactsChanged(STORED, { completionDeclaration: null })).toBe(true);
  });

  it('Α4 — έτος κατασκευής · δεσμός επιπέδου Α · έργο (τα πεδία πριν από το βήμα 5 μένουν)', () => {
    expect(buildingListingFactsChanged(STORED, { constructionYear: 2027 })).toBe(true);
    expect(buildingListingFactsChanged(STORED, { placeRef: { kind: 'plot', id: 'plc_2' } })).toBe(true);
    expect(buildingListingFactsChanged(STORED, { projectId: 'proj_2' })).toBe(true);
  });
});

describe('Σ — η αυτόματη αποθήκευση ξαναστέλνει τα ίδια ⇒ καμία επαναπροβολή', () => {
  it('Σ1 — ολόκληρο το έγγραφο αμετάβλητο', () => {
    expect(buildingListingFactsChanged(STORED, { ...STORED })).toBe(false);
  });

  it('Σ2 — ίδια δήλωση με άλλη σειρά κλειδιών: ισοδυναμία, όχι ταυτότητα αναφοράς', () => {
    const reordered = { at: DECLARATION.at, value: { anchor: '2027-07-01', precision: 'quarter' }, provenance: 'declared' };
    expect(buildingListingFactsChanged(STORED, { completionDeclaration: reordered })).toBe(false);
  });

  it('Σ3 — πεδίο που η αγγελία δεν διαβάζει (`name` · `completionDate`, ADR-919 §7)', () => {
    expect(buildingListingFactsChanged(STORED, { name: 'Κτίριο Β', completionDate: '2027-06-30' })).toBe(false);
  });

  it('Σ4 — απόν και `null` είναι το ίδιο', () => {
    const bare = { projectId: 'proj_1' };
    expect(buildingListingFactsChanged(bare, { status: null, completionDeclaration: null, placeRef: null })).toBe(false);
  });
});

describe('Ρ — ο αναγνώστης', () => {
  it('Ρ1 — ωμά γεγονότα, χωρίς κρίση: ο επιλυτής κρίνει', () => {
    expect(buildingChainFactsOf(STORED)).toEqual({
      projectId: 'proj_1',
      placeRef: { kind: 'plot', id: 'plc_1' },
      constructionYear: 2026,
      availability: { status: 'construction', completionDeclaration: DECLARATION },
    });
  });
});
