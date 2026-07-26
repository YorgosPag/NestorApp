/**
 * Anchor tests: κενές διευθύνσεις δεν φτάνουν στη βάση (ADR-332 D20).
 *
 * ΤΙ ΚΑΘΗΛΩΝΟΥΝ
 * Η «ALFA ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε.» (δοκιμαστική εγγραφή) βρέθηκε στη βάση με
 * ολότελα κενή έδρα, σε δύο σημεία ταυτόχρονα (`addresses[0]` και
 * `customFields.companyAddresses[0]`). Δεν την πρόσθεσε χρήστης: τη συνέθετε ο
 * κώδικας και τη γραφε αυτούσια.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΚΑΙ ROUND-TRIP ΜΕΡΟΣ (μάθημα D18.1)
 * Πράσινα unit tests στο κατηγόρημα **δεν** αποδεικνύουν ότι το κλάδεμα τρέχει
 * στο σωστό σημείο. Τα tests της ενότητας «δικλείδα» περνούν από τον **πραγματικό**
 * `EnterpriseContactSaver` και ελέγχουν **και τους δύο** πίνακες — γιατί κλάδεμα
 * μόνο στο παράγωγο θα άφηνε την κενή γραμμή στη φόρμα να ξαναγράφεται.
 */

import type { AddressInfo } from '@/types/contacts';
import type { CompanyAddress, ContactFormData } from '@/types/ContactFormTypes';
import { initialFormData } from '@/types/ContactFormTypes';
import {
  isBlankContactAddress,
  pruneBlankContactAddresses,
} from '../contact-address-blankness';
import { EnterpriseContactSaver } from '../EnterpriseContactSaver';

// =============================================================================
// ΒΟΗΘΗΤΙΚΑ
// =============================================================================

/** Ακριβώς η κενή εγγραφή που βρέθηκε στη δοκιμαστική ALFA. */
function blankAddress(type: CompanyAddress['type'] = 'headquarters'): CompanyAddress {
  return { type, street: '', number: '', city: '', postalCode: '', country: 'GR' };
}

function realAddress(partial: Partial<CompanyAddress> = {}): CompanyAddress {
  return {
    type: 'branch',
    street: 'Ονειροπόλων',
    number: '42',
    postalCode: '54624',
    city: 'Θεσσαλονίκη',
    ...partial,
  };
}

function formWith(addresses: CompanyAddress[], flatStreet = ''): ContactFormData {
  return {
    ...initialFormData,
    type: 'company',
    street: flatStreet,
    companyAddresses: addresses,
  };
}

// =============================================================================
// ΤΟ ΚΑΤΗΓΟΡΗΜΑ
// =============================================================================

describe('isBlankContactAddress', () => {
  it('η ακριβής εγγραφή της ALFA είναι κενή — παρότι έχει country και type', () => {
    expect(isBlankContactAddress(blankAddress())).toBe(true);
  });

  it('όλα τα πεδία undefined = κενή', () => {
    expect(isBlankContactAddress({ type: 'branch', street: '', number: '', postalCode: '', city: '' })).toBe(true);
  });

  it('μόνο κενά διαστήματα = κενή', () => {
    expect(isBlankContactAddress({ type: 'branch', street: '   ', number: ' ', postalCode: '', city: '\t' })).toBe(true);
  });

  it.each([
    ['street', { street: 'Ορφέως' }],
    ['number', { number: '7' }],
    ['city', { city: 'Κομοτηνή' }],
    ['postalCode', { postalCode: '69100' }],
    ['region', { region: 'Ροδόπη' }],
    ['neighborhood', { neighborhood: 'Κέντρο' }],
    ['municipalityName', { municipalityName: 'Δήμος Κομοτηνής' }],
    ['settlementId', { settlementId: 'stl_123' }],
    ['majorGeoName', { majorGeoName: 'Θράκη' }],
  ])('ΕΝΑ γεμάτο πεδίο (%s) αρκεί για να ΜΗΝ είναι κενή', (_field, patch) => {
    expect(isBlankContactAddress({ ...blankAddress('branch'), ...patch })).toBe(false);
  });

  it.each([
    ['type', { type: 'warehouse' as const }],
    ['customLabel', { customLabel: 'Αποθήκη Λαμίας' }],
    ['country', { country: 'IT' }],
  ])('%s είναι ταξινόμηση/ετικέτα, ΟΧΙ περιεχόμενο — μένει κενή', (_field, patch) => {
    expect(isBlankContactAddress({ ...blankAddress(), ...patch })).toBe(true);
  });
});

// =============================================================================
// ΤΟ ΔΕΥΤΕΡΟ ΣΧΗΜΑ — ΑΠΟΘΗΚΕΥΜΕΝΟ `AddressInfo`, ΑΛΛΟ ΛΕΞΙΛΟΓΙΟ ΙΕΡΑΡΧΙΑΣ
// =============================================================================

describe('isBlankContactAddress — σχήμα AddressInfo', () => {
  /** Ακριβώς η κενή εγγραφή που βρέθηκε στο `addresses[0]` της δοκιμαστικής ALFA. */
  const BLANK_INFO: AddressInfo = {
    street: '', number: '', city: '', postalCode: '',
    country: 'GR', type: 'work', isPrimary: true, label: 'headquarters',
  };

  it('η κενή εγγραφή του παράγωγου είναι κενή — παρότι έχει label/isPrimary/country', () => {
    expect(isBlankContactAddress(BLANK_INFO)).toBe(true);
  });

  it.each([
    ['municipality', { municipality: 'Δήμος Κομοτηνής' }],
    ['settlement', { settlement: 'Κομοτηνή' }],
    ['community', { community: 'Κοινότητα' }],
    ['municipalUnit', { municipalUnit: 'Δ.Ε.' }],
    ['regionalUnit', { regionalUnit: 'Π.Ε. Ροδόπης' }],
    ['decentAdmin', { decentAdmin: 'Αποκ. Διοίκηση' }],
    ['majorGeo', { majorGeo: 'Θράκη' }],
  ])('το λεξιλόγιο AddressInfo μετράει: %s', (_field, patch) => {
    // ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΦΥΛΑΕΙ: αν η λίστα πεδίων κάλυπτε μόνο το λεξιλόγιο της
    // φόρμας (`municipalityName` κ.λπ.), όλα αυτά θα κρίνονταν «κενά» και το
    // κλάδεμα θα πετούσε πραγματική γεωγραφική πληροφορία.
    expect(isBlankContactAddress({ ...BLANK_INFO, ...patch })).toBe(false);
  });

  it('το label δεν είναι περιεχόμενο', () => {
    expect(isBlankContactAddress({ ...BLANK_INFO, label: 'Αποθήκη Λαμίας' })).toBe(true);
  });
});

// =============================================================================
// Ο ΚΑΝΟΝΑΣ ΚΛΑΔΕΜΑΤΟΣ — ΘΕΤΙΚΗ ΑΝΑΛΛΟΙΩΤΗ ADR-319
// =============================================================================

describe('pruneBlankContactAddresses', () => {
  it('κενή έδρα ΧΩΡΙΣ υποκαταστήματα → τίποτα (το σενάριο της ALFA)', () => {
    expect(pruneBlankContactAddresses([blankAddress()])).toEqual([]);
  });

  it('κλαδεύει τα κενά υποκαταστήματα', () => {
    const result = pruneBlankContactAddresses([
      realAddress({ type: 'headquarters' }),
      realAddress({ city: 'Εύοσμος' }),
      blankAddress('branch'),
      blankAddress('warehouse'),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map(a => a.city)).toEqual(['Θεσσαλονίκη', 'Εύοσμος']);
  });

  it('ΚΡΑΤΑ κενή έδρα όταν υπάρχει υποκατάστημα — αλλιώς το υποκατάστημα θα ανέβαινε στη θέση 0', () => {
    const result = pruneBlankContactAddresses([blankAddress(), realAddress()]);

    // Η θέση 0 μένει η έδρα. Χωρίς αυτό, η φόρμα θα εμφάνιζε το υποκατάστημα
    // ως έδρα στο επόμενο άνοιγμα — παλινδρόμηση χειρότερη από την κενή γραμμή.
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('headquarters');
    expect(result[1].type).toBe('branch');
  });

  it('κενή έδρα + ΜΟΝΟ κενά υποκαταστήματα → τίποτα', () => {
    expect(pruneBlankContactAddresses([blankAddress(), blankAddress('branch')])).toEqual([]);
  });

  it('δεν αγγίζει λίστα χωρίς κενά', () => {
    const input = [realAddress({ type: 'headquarters' }), realAddress({ city: 'Σίνδος' })];
    expect(pruneBlankContactAddresses(input)).toEqual(input);
  });

  it('ιδεμποτεντικό — δεύτερη κλήση δίνει το ίδιο', () => {
    const input = [blankAddress(), realAddress(), blankAddress('branch')];
    const once = pruneBlankContactAddresses(input);

    expect(pruneBlankContactAddresses(once)).toEqual(once);
  });

  it('κενή λίστα μένει κενή', () => {
    expect(pruneBlankContactAddresses([])).toEqual([]);
  });

  it('μερικώς συμπληρωμένη διεύθυνση ΔΕΝ κλαδεύεται — ελλιπή στοιχεία είναι θεμιτά', () => {
    const partial: CompanyAddress = { type: 'branch', street: '', number: '', postalCode: '', city: 'Ξάνθη' };

    expect(pruneBlankContactAddresses([realAddress({ type: 'headquarters' }), partial])).toHaveLength(2);
  });
});

// =============================================================================
// Η ΔΙΚΛΕΙΔΑ ΣΤΟ ΠΡΑΓΜΑΤΙΚΟ CHOKEPOINT — ΚΑΙ ΟΙ ΔΥΟ ΠΙΝΑΚΕΣ
// =============================================================================

describe('EnterpriseContactSaver — δικλείδα κενών διευθύνσεων', () => {
  it('καθαρίζει ΚΑΙ την αυθεντική λίστα ΚΑΙ το παράγωγο (το σενάριο της ALFA)', () => {
    const result = EnterpriseContactSaver.convertToEnterpriseStructure(formWith([blankAddress()]));

    // ΤΟ ΕΛΑΤΤΩΜΑ: και τα δύο έβγαιναν με ένα κενό αντικείμενο μέσα.
    expect(result.customFields?.companyAddresses).toEqual([]);
    expect(result.addresses).toEqual([]);
  });

  it('κλάδεμα σε ΕΝΑ σημείο ⇒ οι δύο πίνακες δεν μπορούν να αποκλίνουν', () => {
    const result = EnterpriseContactSaver.convertToEnterpriseStructure(
      formWith([realAddress({ type: 'headquarters' }), blankAddress('branch'), realAddress({ city: 'Σέρρες' })], 'Ονειροπόλων'),
    );

    const authoritative = result.customFields?.companyAddresses as CompanyAddress[];
    expect(authoritative).toHaveLength(2);
    expect(result.addresses).toHaveLength(2);
    expect(result.addresses?.map(a => a.city)).toEqual(authoritative.map(a => a.city));
  });

  it('δεν πειράζει επαφή χωρίς λίστα διευθύνσεων — δεν σβήνει ό,τι δεν άγγιξε ο χρήστης', () => {
    const formWithoutList: ContactFormData = { ...initialFormData, type: 'individual' };
    delete (formWithoutList as Record<string, unknown>).companyAddresses;

    const result = EnterpriseContactSaver.convertToEnterpriseStructure(formWithoutList);

    expect(result.customFields?.companyAddresses).toBeUndefined();
  });

  it('flat έδρα με δεδομένα δεν χάνεται όταν η λίστα κλαδεύεται σε κενή', () => {
    const result = EnterpriseContactSaver.convertToEnterpriseStructure(
      { ...initialFormData, type: 'company', street: 'Ορφέως', city: 'Κομοτηνή', companyAddresses: [blankAddress()] },
    );

    // Το παράγωγο κρατά την έδρα των flat πεδίων — δεν μηδενίζεται από το κλάδεμα.
    expect(result.addresses).toHaveLength(1);
    expect(result.addresses?.[0].street).toBe('Ορφέως');
  });
});
