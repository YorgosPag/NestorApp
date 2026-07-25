/**
 * Β2 / N.11 — το αποθηκευμένο `label` δεν φτάνει ΠΟΤΕ ωμό στην οθόνη.
 *
 * Ρίζα του bug: ο κλάδος φυσικού προσώπου αποθήκευε `label: 'contacts.address.primary'`
 * — raw i18n key ως **δεδομένο**. Δύο shared render sinks (`AddressCard`, `AddressMap`)
 * το τύπωναν αυτούσιο. Ο resolver εδώ είναι το μοναδικό σημείο απόδοσης.
 */

import { renderStoredAddressLabel } from '../contactAddressLabel';

/** Ψεύτικος μεταφραστής: επιστρέφει το κλειδί με σήμανση, ώστε να φαίνεται ότι κλήθηκε. */
const t = (key: string) => `T[${key}]`;

describe('renderStoredAddressLabel', () => {
  it('μεταφράζει σημασιολογικά slugs της ταξινομίας ADR-319', () => {
    expect(renderStoredAddressLabel('home', t)).toBe('T[types.home]');
    expect(renderStoredAddressLabel('headquarters', t)).toBe('T[types.headquarters]');
  });

  it('ΔΕΝ εμφανίζει legacy raw i18n key (το ακριβές bug)', () => {
    expect(renderStoredAddressLabel('contacts.address.primary', t)).toBeNull();
    expect(renderStoredAddressLabel('contacts.address.types.home', t)).toBeNull();
  });

  it('περνά ελεύθερο κείμενο χρήστη αυτούσιο', () => {
    expect(renderStoredAddressLabel('Εξοχικό στη Χαλκιδική', t)).toBe('Εξοχικό στη Χαλκιδική');
  });

  it('επιστρέφει null για κενό/απόν label', () => {
    expect(renderStoredAddressLabel(undefined, t)).toBeNull();
    expect(renderStoredAddressLabel('', t)).toBeNull();
    expect(renderStoredAddressLabel('   ', t)).toBeNull();
  });

  it('ελεύθερο κείμενο με τελεία δεν μπερδεύεται με i18n key', () => {
    // Το heuristic του key αφορά dot-separated ASCII identifiers — ελληνικό
    // κείμενο με τελεία παραμένει κείμενο.
    expect(renderStoredAddressLabel('Γραφείο κ. Παπαδόπουλου', t)).toBe('Γραφείο κ. Παπαδόπουλου');
  });
});
