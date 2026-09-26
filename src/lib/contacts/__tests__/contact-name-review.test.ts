/**
 * ADR-884 §9.1 Α1 — λογαριασμός → όνομα επαφής, **χωρίς μαντεψιά** (Google People API · W3C Personal names).
 *
 * Μεταλλάξεις (2026-09-26): (α) διάσπαση του `displayName` στην `accountContactName` ⇒ κοκκινίζει το Ο2·
 * (β) σήμα `null` σε ενιαίο όνομα ⇒ κοκκινίζει το Ο2· (γ) χωρίς αντιστροφή ⇒ κοκκινίζει το Π2.
 */

import {
  accountContactName,
  nameReviewFromDocument,
  proposeNameSplit,
  type ContactNameReview,
} from '../contact-name-review';

const facts = (over: Partial<Parameters<typeof accountContactName>[0]> = {}) => ({
  givenName: null, familyName: null, displayName: null, email: 'maria@example.com', ...over,
});

describe('accountContactName — δομημένα αν τα ξέρουμε, αλλιώς ακέραιο + σήμα', () => {
  it('Ο1 — όνομα ΚΑΙ επώνυμο από τον λογαριασμό ⇒ αυτούσια, κανένα σήμα', () => {
    expect(accountContactName(facts({ givenName: ' Μαρία ', familyName: 'Παπαδοπούλου', displayName: 'Μ. Π.' })))
      .toEqual({ givenName: 'Μαρία', familyName: 'Παπαδοπούλου', nameReview: null });
  });

  it('Ο2 — μόνο ενιαίο όνομα ⇒ ΑΚΕΡΑΙΟ στο «Όνομα», κενό επώνυμο, σήμα με το ακατέργαστο', () => {
    expect(accountContactName(facts({ displayName: 'Μαρία Παπαδοπούλου' }))).toEqual({
      givenName: 'Μαρία Παπαδοπούλου', familyName: '',
      nameReview: { source: 'account-display-name', raw: 'Μαρία Παπαδοπούλου' },
    });
  });

  it('Ο3 — μόνο «Όνομα» δομημένο, χωρίς επώνυμο και χωρίς ενιαίο ⇒ ελλιπές, με σήμα', () => {
    expect(accountContactName(facts({ givenName: 'Μαρία' })).nameReview).toEqual({ source: 'account-display-name', raw: 'Μαρία' });
  });

  it('Ο4 — τίποτα από όνομα ⇒ το email, με σήμα «από email» (δεν είναι όνομα)', () => {
    expect(accountContactName(facts())).toEqual({
      givenName: 'maria@example.com', familyName: '', nameReview: { source: 'account-email', raw: 'maria@example.com' },
    });
  });
});

describe('proposeNameSplit — η πρόταση που επιβεβαιώνει ο άνθρωπος', () => {
  const review: ContactNameReview = { source: 'account-display-name', raw: 'Μαρία  Άννα Παπαδοπούλου' };

  it('Π1 — πρώτη λέξη όνομα, υπόλοιπο επώνυμο', () => {
    expect(proposeNameSplit(review)).toEqual({ givenName: 'Μαρία', familyName: 'Άννα Παπαδοπούλου' });
  });

  it('Π2 — αντιστροφή για «Επώνυμο Όνομα»: τελευταία λέξη όνομα', () => {
    expect(proposeNameSplit({ source: 'account-display-name', raw: 'Παπαδοπούλου Μαρία' }, true))
      .toEqual({ givenName: 'Μαρία', familyName: 'Παπαδοπούλου' });
  });

  it('Π3 — μία λέξη ή email ⇒ καμία πρόταση', () => {
    expect(proposeNameSplit({ source: 'account-display-name', raw: 'Μαρία' })).toBeNull();
    expect(proposeNameSplit({ source: 'account-email', raw: 'maria@example.com' })).toBeNull();
  });
});

describe('nameReviewFromDocument — άγνωστο σχήμα ⇒ null, ποτέ ρίψη', () => {
  it.each([undefined, null, 'x', {}, { source: 'x', raw: 'a' }, { source: 'account-email', raw: '  ' }])('%p ⇒ null', (value) => {
    expect(nameReviewFromDocument(value)).toBeNull();
  });

  it('έγκυρο ⇒ αυτούσιο', () => {
    expect(nameReviewFromDocument({ source: 'account-email', raw: 'a@b.gr' })).toEqual({ source: 'account-email', raw: 'a@b.gr' });
  });
});
