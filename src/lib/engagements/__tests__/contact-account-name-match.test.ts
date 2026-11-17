/**
 * ADR-915 §40.8 — συμφωνεί το όνομα της επαφής με τον λογαριασμό που αποδέχτηκε;
 *
 * Το αληθινό εύρημα που γέννησε το σήμα: επαφή «Αλέξανδρος Μαυρίδης», λογαριασμός «ΓΕΩΡΓΙΟΣ ΠΕΑΣ» (Σ1).
 * Τα υπόλοιπα φρουρούν το αντίθετο λάθος — ψεύτικο «διαφέρει» που μαθαίνει τον άνθρωπο να αγνοεί το σήμα.
 */

import { compareContactToAccount, contactPersonNameOf } from '../contact-account-name-match';

const contact = (firstName: string | null, lastName: string | null) => ({ firstName, lastName });
const account = (givenName: string | null, familyName: string | null, displayName: string | null = null) =>
  ({ givenName, familyName, displayName });

describe('compareContactToAccount', () => {
  it('Σ1 — άλλος άνθρωπος ⇒ differs', () => {
    expect(compareContactToAccount(contact('Αλέξανδρος', 'Μαυρίδης'), account('ΓΕΩΡΓΙΟΣ', 'ΠΕΑΣ'))).toBe('differs');
  });

  it('Σ2 — τόνοι, κεφαλαία, τελικό σίγμα ⇒ match', () => {
    expect(compareContactToAccount(contact('Γεώργιος', 'Πέας'), account('ΓΕΩΡΓΙΟΣ', 'ΠΕΑΣ'))).toBe('match');
  });

  it('Σ3 — ελληνικά ↔ λατινικά ⇒ match', () => {
    expect(compareContactToAccount(contact('Γεώργιος', 'Παγώνης'), account('Georgios', 'Pagonis'))).toBe('match');
  });

  it('Σ4 — αντεστραμμένη σειρά ⇒ match', () => {
    expect(compareContactToAccount(contact('Πέας', 'Γεώργιος'), account('Γεώργιος', 'Πέας'))).toBe('match');
  });

  it('Σ5 — μεσαίο όνομα στη μία πλευρά (υποσύνολο) ⇒ match', () => {
    expect(compareContactToAccount(contact('Γεώργιος', 'Πέας'), account('Γεώργιος Ιωάννης', 'Πέας'))).toBe('match');
  });

  it('Σ6 — χωρίς δομημένα πεδία λογαριασμού ⇒ από το displayName', () => {
    expect(compareContactToAccount(contact('Μαρία', 'Παπαδοπούλου'), account(null, null, 'Μαρία Παπαδοπούλου'))).toBe('match');
    expect(compareContactToAccount(contact('Μαρία', 'Παπαδοπούλου'), account(null, null, 'Ελένη Κ.'))).toBe('differs');
  });

  it('Σ7 — λείπει πλευρά ⇒ unknown, ΠΟΤΕ differs', () => {
    expect(compareContactToAccount(null, account('Γεώργιος', 'Πέας'))).toBe('unknown');
    expect(compareContactToAccount(contact('Γεώργιος', 'Πέας'), null)).toBe('unknown');
    expect(compareContactToAccount(contact(null, null), account('Γεώργιος', 'Πέας'))).toBe('unknown');
    expect(compareContactToAccount(contact('Γεώργιος', 'Πέας'), account(null, null, '  '))).toBe('unknown');
  });

  it('Σ8 — διαχωριστικά (παύλα, τελεία) δεν μετράνε', () => {
    expect(compareContactToAccount(contact('Μαρία', 'Παπα-Γεωργίου'), account('Μαρία', 'Παπα Γεωργίου'))).toBe('match');
  });
});

describe('contactPersonNameOf', () => {
  it('Ε1 — φυσικό πρόσωπο ⇒ όνομα/επώνυμο, κενά ⇒ null', () => {
    expect(contactPersonNameOf({ type: 'individual', firstName: 'Αλέξανδρος', lastName: ' ' }))
      .toEqual({ firstName: 'Αλέξανδρος', lastName: null });
  });

  it('Ε2 — εταιρεία/υπηρεσία/ανύπαρκτο ⇒ null (η επωνυμία δεν συγκρίνεται με άνθρωπο)', () => {
    expect(contactPersonNameOf({ type: 'company', companyName: 'Α.Ε.' })).toBeNull();
    expect(contactPersonNameOf({ type: 'service', serviceName: 'ΔΟΥ' })).toBeNull();
    expect(contactPersonNameOf(undefined)).toBeNull();
  });
});
