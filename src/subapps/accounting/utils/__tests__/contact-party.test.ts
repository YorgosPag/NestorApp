/**
 * Άγκυρα — **η επαφή γίνεται στοιχεία συναλλασσόμενου με ΕΝΑΝ τρόπο** (`extractContactParty`).
 *
 * Κλειδώνει τη συμπεριφορά που είχαν τα δύο αντίγραφα (`CustomerSelector`, `BasicInfoSection`)
 * πριν ενωθούν, και τη μία σκόπιμη διαφορά: η δημόσια υπηρεσία διαβάζει πλέον τα παλαιά της
 * πεδία επικοινωνίας μέσω του SSoT `getPrimary*`.
 */

import type { Contact } from '@/types/contacts';
import { extractContactParty } from '../contact-party';

const ADDRESS = {
  street: 'Εγνατίας', number: '12', city: 'Θεσσαλονίκη', postalCode: '54624', country: 'GR',
  type: 'work' as const, isPrimary: true,
};

function contact(fields: Record<string, unknown>): Contact {
  return { id: 'c1', ...fields } as unknown as Contact;
}

describe('extractContactParty', () => {
  it('φυσικό πρόσωπο: όνομα, επάγγελμα, ΑΦΜ/ΔΟΥ, οδός + αριθμός, κύρια στοιχεία', () => {
    const party = extractContactParty(contact({
      type: 'individual', firstName: 'Άννα', lastName: 'Παπά', profession: 'Μηχανικός',
      vatNumber: '123456789', taxOffice: '1234',
      addresses: [{ ...ADDRESS, isPrimary: false, street: 'Άλλη' }, ADDRESS],
      phones: [{ number: '2310', type: 'work', isPrimary: true }],
      emails: [{ email: 'a@x.gr', type: 'work', isPrimary: true }],
    }));
    expect(party).toEqual({
      name: 'Άννα Παπά', profession: 'Μηχανικός', hasTaxIdentity: true,
      vatNumber: '123456789', taxOffice: '1234', street: 'Εγνατίας 12', city: 'Θεσσαλονίκη',
      postalCode: '54624', country: 'GR', phone: '2310', email: 'a@x.gr',
    });
  });

  it('νομικό πρόσωπο: επωνυμία, χωρίς επάγγελμα (null = δεν ισχύει)', () => {
    const party = extractContactParty(contact({ type: 'company', companyName: 'ΑΕ', vatNumber: '9' }));
    expect(party).toMatchObject({ name: 'ΑΕ', profession: null, hasTaxIdentity: true, vatNumber: '9', street: '' });
  });

  it('δημόσια υπηρεσία: χωρίς φορολογική ταυτότητα, με τα παλαιά πεδία επικοινωνίας', () => {
    const party = extractContactParty(contact({
      type: 'service', serviceName: 'ΔΟΥ Α', centralPhone: '210', officialEmail: 'doy@gov.gr',
    }));
    expect(party).toMatchObject({
      name: 'ΔΟΥ Α', hasTaxIdentity: false, vatNumber: null, taxOffice: null,
      phone: '210', email: 'doy@gov.gr', city: null,
    });
  });

  it('χωρίς διεύθυνση αριθμό: μόνο η οδός', () => {
    const party = extractContactParty(contact({
      type: 'company', companyName: 'ΑΕ', addresses: [{ ...ADDRESS, number: undefined }],
    }));
    expect(party.street).toBe('Εγνατίας');
  });
});
