/**
 * ADR-944 — τα κλειδιά email μιας επαφής: το ΕΝΑ SSoT που γράφουν όλοι οι γραφείς και διαβάζει ο έλεγχος.
 */

import { contactEmailKeys, emailKeyOf, sameEmailKeys } from '../contact-email-keys';

describe('emailKeyOf', () => {
  it('Κ1 — πεζά + trim', () => {
    expect(emailKeyOf('  Georgios.Pagonis+ARCH1@Gmail.com ')).toBe('georgios.pagonis+arch1@gmail.com');
  });

  it('Κ2 — το +tag ΔΕΝ αφαιρείται (άλλο γραμματοκιβώτιο για την εφαρμογή)', () => {
    expect(emailKeyOf('a+x@gmail.com')).not.toBe(emailKeyOf('a@gmail.com'));
  });

  it('Κ3 — κενό ή μη-κείμενο ⇒ null, ποτέ κενό κλειδί', () => {
    expect(emailKeyOf('   ')).toBeNull();
    expect(emailKeyOf(null)).toBeNull();
    expect(emailKeyOf(42)).toBeNull();
  });
});

describe('contactEmailKeys', () => {
  it('Π1 — πίνακας αντικειμένων + επίπεδο email ⇒ μοναδικά, ταξινομημένα', () => {
    const emails = [{ email: 'B@x.gr', isPrimary: true }, { email: 'a@x.gr' }, { email: 'b@x.gr ' }];
    expect(contactEmailKeys(emails, 'A@x.gr')).toEqual(['a@x.gr', 'b@x.gr']);
  });

  it('Π2 — λάθος σχήματα αγνοούνται σιωπηλά', () => {
    expect(contactEmailKeys([null, 'string', { email: '' }, { phone: '1' }], undefined)).toEqual([]);
    expect(contactEmailKeys(undefined, undefined)).toEqual([]);
  });

  it('Π3 — ιδεμπότητο: ίδια είσοδος ⇒ ίδια έξοδος', () => {
    const emails = [{ email: 'z@x.gr' }, { email: 'a@x.gr' }];
    expect(contactEmailKeys(emails)).toEqual(contactEmailKeys([...emails].reverse()));
  });
});

describe('sameEmailKeys', () => {
  it('Ι1 — ίδιο ⇒ true · άλλη σειρά/μήκος/απόν ⇒ false', () => {
    expect(sameEmailKeys(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameEmailKeys(['b', 'a'], ['a', 'b'])).toBe(false);
    expect(sameEmailKeys(['a'], ['a', 'b'])).toBe(false);
    expect(sameEmailKeys(undefined, [])).toBe(false);
  });
});
