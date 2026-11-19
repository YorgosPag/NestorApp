/**
 * Tests για τον ΕΝΑ κατασκευαστή `AddressInfo` (ADR-332 D15).
 *
 * Καθηλώνουν ακριβώς ό,τι έχανε η προηγούμενη διπλή υλοποίηση: τη διοικητική
 * ιεραρχία, τη «Περιοχή / Συνοικία», την πραγματική χώρα και το ταχυδρομικό
 * είδος. Πράσινα tests ΔΕΝ έπιαναν το ελάττωμα — γιατί δεν υπήρχαν.
 */

import type { Contact } from '@/types/contacts';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import { DEFAULT_STORED_COUNTRY_CODE } from '@/utils/address/country-codes';
import {
  buildAddressInfoListFromCompanyAddresses,
  buildCompanyAddressFromLegacyRoot,
} from '../address-info-builder';
import { resolveContactAddresses } from '../contact-addresses-reader';

function companyAddress(partial: Partial<CompanyAddress> = {}): CompanyAddress {
  return {
    type: 'branch',
    street: 'Ονειροπόλων',
    number: '42',
    postalCode: '54624',
    city: 'Θεσσαλονίκη',
    ...partial,
  };
}

describe('buildAddressInfoListFromCompanyAddresses', () => {
  it('μεταφέρει ΟΛΗ τη διοικητική ιεραρχία στο παράγωγο', () => {
    const [address] = buildAddressInfoListFromCompanyAddresses([
      companyAddress({
        settlementId: 'settlement:THES1',
        communityName: 'Κοινότητα Θεσσαλονίκης',
        municipalUnitName: 'Δ.Ε. Θεσσαλονίκης',
        municipalityName: 'Δήμος Θεσσαλονίκης',
        municipalityId: 'municipality:THES',
        regionalUnitName: 'Π.Ε. Θεσσαλονίκης',
        regionName: 'Κεντρική Μακεδονία',
        decentAdminName: 'Α.Δ. Μακεδονίας-Θράκης',
        majorGeoName: 'Βόρεια Ελλάδα',
      }),
    ]);

    expect(address).toMatchObject({
      settlement: 'Θεσσαλονίκη', // ο οικισμός ζει στο `city` του CompanyAddress
      settlementId: 'settlement:THES1',
      community: 'Κοινότητα Θεσσαλονίκης',
      municipalUnit: 'Δ.Ε. Θεσσαλονίκης',
      municipality: 'Δήμος Θεσσαλονίκης',
      municipalityId: 'municipality:THES',
      regionalUnit: 'Π.Ε. Θεσσαλονίκης',
      region: 'Κεντρική Μακεδονία',
      decentAdmin: 'Α.Δ. Μακεδονίας-Θράκης',
      majorGeo: 'Βόρεια Ελλάδα',
    });
  });

  it('κρατά τη «Περιοχή / Συνοικία» — το πεδίο που χανόταν σιωπηλά', () => {
    const [address] = buildAddressInfoListFromCompanyAddresses([
      companyAddress({ neighborhood: 'Κέντρο' }),
    ]);
    expect(address.neighborhood).toBe('Κέντρο');
  });

  it('προτιμά το `regionName` της ιεραρχίας από το ελεύθερο `region`', () => {
    const [address] = buildAddressInfoListFromCompanyAddresses([
      companyAddress({ region: 'ελεύθερο κείμενο', regionName: 'Κεντρική Μακεδονία' }),
    ]);
    expect(address.region).toBe('Κεντρική Μακεδονία');
  });

  it('πέφτει στο ελεύθερο `region` όταν δεν υπάρχει ιεραρχία', () => {
    const [address] = buildAddressInfoListFromCompanyAddresses([
      companyAddress({ region: 'Μακεδονία' }),
    ]);
    expect(address.region).toBe('Μακεδονία');
  });

  it('παραλείπει τα κενά αντί να γράφει κενά strings στο Firestore', () => {
    const [address] = buildAddressInfoListFromCompanyAddresses([
      companyAddress({ municipalityName: '', settlementId: null, region: '' }),
    ]);
    expect(address).not.toHaveProperty('municipality');
    expect(address).not.toHaveProperty('settlementId');
    expect(address).not.toHaveProperty('region');
  });

  it('σέβεται την πραγματική χώρα αντί για σταθερό «GR» — σε ΤΑΥΤΟΤΗΤΑ (ADR-332 D27 Φάση Α)', () => {
    // Η πρόθεση της άγκυρας **δεν άλλαξε**: ξένη χώρα ΔΕΝ επιτρέπεται να καταπιεί η
    // προεπιλογή. Άλλαξε το **λεξιλόγιο**: αποθηκεύεται ο κωδικός ISO, όχι η ετικέτα.
    const [foreign] = buildAddressInfoListFromCompanyAddresses([
      companyAddress({ country: 'Germany' }),
    ]);
    expect(foreign.country).toBe('DE');
    expect(foreign.country).not.toBe(DEFAULT_STORED_COUNTRY_CODE);
  });

  it('άγνωστη χώρα μένει ΑΥΤΟΥΣΙΑ — καμία επινόηση κωδικού, καμία απώλεια', () => {
    const [exotic] = buildAddressInfoListFromCompanyAddresses([
      companyAddress({ country: 'Ουτοπία' }),
    ]);
    expect(exotic.country).toBe('Ουτοπία');
  });

  it('πέφτει στο «GR» μόνο όταν δεν δηλώνεται χώρα', () => {
    const [address] = buildAddressInfoListFromCompanyAddresses([companyAddress()]);
    expect(address.country).toBe('GR');
  });

  describe('ταχυδρομικό είδος — παράγωγο, όχι σταθερό «work»', () => {
    it.each([
      ['headquarters' as const, 'work'],
      ['branch' as const, 'work'],
      ['warehouse' as const, 'work'],
      ['office' as const, 'work'],
      ['other' as const, 'other'],
    ])('%s → %s', (type, expected) => {
      const [address] = buildAddressInfoListFromCompanyAddresses([companyAddress({ type })]);
      expect(address.type).toBe(expected);
    });
  });

  describe('ετικέτα ADR-319 — σημασιολογικό slug, ποτέ i18n key', () => {
    it('γράφει το slug για τους τυπικούς τύπους', () => {
      const [address] = buildAddressInfoListFromCompanyAddresses([
        companyAddress({ type: 'warehouse' }),
      ]);
      expect(address.label).toBe('warehouse');
    });

    it('γράφει το custom label μόνο για `other`', () => {
      const [address] = buildAddressInfoListFromCompanyAddresses([
        companyAddress({ type: 'other', customLabel: '  Αποθήκη Β  ' }),
      ]);
      expect(address.label).toBe('Αποθήκη Β');
    });

    it('αγνοεί custom label σε μη-`other` τύπο', () => {
      const [address] = buildAddressInfoListFromCompanyAddresses([
        companyAddress({ type: 'branch', customLabel: 'άσχετο' }),
      ]);
      expect(address.label).toBe('branch');
    });
  });

  describe('κύρια διεύθυνση', () => {
    it('θέση 0 = κύρια', () => {
      const [first, second] = buildAddressInfoListFromCompanyAddresses([
        companyAddress({ type: 'branch' }),
        companyAddress({ type: 'branch' }),
      ]);
      expect(first.isPrimary).toBe(true);
      expect(second.isPrimary).toBe(false);
    });

    it('ρητή έδρα σε άλλη θέση μετράει επίσης', () => {
      const [, second] = buildAddressInfoListFromCompanyAddresses([
        companyAddress({ type: 'branch' }),
        companyAddress({ type: 'headquarters' }),
      ]);
      expect(second.isPrimary).toBe(true);
    });
  });
});

/**
 * ADR-332 §D30 Φάση 2 — ο tolerant reader. Το `buildAddressInfoFromFlatFields` (δεύτερη πηγή του
 * `addresses[]`, από επίπεδα πεδία φόρμας) αποσύρθηκε μαζί με τα ίδια τα πεδία· εδώ φυλάγεται η
 * ΜΟΝΗ ανάγνωση της ρίζας που έμεινε: ολόκληρη εγγραφή, από μία πηγή, μόνο για πολύ παλιά έγγραφα.
 */
describe('buildCompanyAddressFromLegacyRoot', () => {
  const root: Record<string, unknown> = {
    street: 'Τσιμισκή',
    streetNumber: '43',
    city: 'Θεσσαλονίκη',
    postalCode: '54623',
    municipality: 'Δήμος Θεσσαλονίκης',
    settlementId: 'settlement:THES1',
    neighborhood: 'Κέντρο',
  };

  it('χαρτογραφεί το επίπεδο `streetNumber` στο `number` της εγγραφής', () => {
    expect(buildCompanyAddressFromLegacyRoot(root, 'headquarters')?.number).toBe('43');
  });

  it('μεταφέρει ιεραρχία και συνοικία', () => {
    expect(buildCompanyAddressFromLegacyRoot(root, 'headquarters')).toMatchObject({
      municipalityName: 'Δήμος Θεσσαλονίκης',
      settlementId: 'settlement:THES1',
      neighborhood: 'Κέντρο',
      type: 'headquarters',
    });
  });

  it('ρητός `primaryAddressType` υπερισχύει της προεπιλογής του είδους', () => {
    expect(buildCompanyAddressFromLegacyRoot({ ...root, primaryAddressType: 'factory' }, 'headquarters')?.type)
      .toBe('factory');
  });

  it('η χώρα της ρίζας περνά από το σύνορο ταυτότητας (ετικέτα → ISO)', () => {
    expect(buildCompanyAddressFromLegacyRoot({ ...root, hqAddressCountry: 'Ελλάδα' }, 'home')?.country).toBe('GR');
  });

  it('ρίζα χωρίς διεύθυνση ⇒ καμία εγγραφή (όχι κενή έδρα στη βάση)', () => {
    expect(buildCompanyAddressFromLegacyRoot({ companyName: 'ALFA' }, 'headquarters')).toBeUndefined();
  });

  it('ΙΣΟΔΥΝΑΜΙΑ: ρίζα → εγγραφή → παράγωγο δίνει την ίδια ιεραρχία με την αυθεντική εγγραφή', () => {
    const fromRoot = buildCompanyAddressFromLegacyRoot(root, 'headquarters');
    expect(fromRoot).toBeDefined();
    const [derivedFromRoot] = buildAddressInfoListFromCompanyAddresses([fromRoot as CompanyAddress]);
    const [derivedFromList] = buildAddressInfoListFromCompanyAddresses([
      companyAddress({
        street: 'Τσιμισκή', number: '43', city: 'Θεσσαλονίκη', postalCode: '54623',
        municipalityName: 'Δήμος Θεσσαλονίκης', settlementId: 'settlement:THES1',
        neighborhood: 'Κέντρο', type: 'headquarters',
      }),
    ]);
    expect(derivedFromRoot).toEqual(derivedFromList);
  });
});

describe('resolveContactAddresses — μία πηγή ανά έγγραφο, ποτέ ανάμειξη ανά πεδίο (§D30 Φάση 2)', () => {
  const asContact = (doc: Record<string, unknown>) => doc as unknown as Contact;

  it('πεδίο ΚΑΘΑΡΙΣΜΕΝΟ στη λίστα + τιμή στη ρίζα ⇒ μένει κενό (η ρίζα δεν ανασταίνει)', () => {
    const [hq] = resolveContactAddresses(asContact({
      type: 'company',
      neighborhood: 'Μπαγιάτικη Συνοικία',
      municipality: 'Μπαγιάτικος Δήμος',
      customFields: { companyAddresses: [companyAddress({ type: 'headquarters', neighborhood: '' })] },
    }), 'company');
    expect(hq.neighborhood).toBe('');
    expect(hq.municipalityName).toBeUndefined();
  });

  it('πεδίο που λείπει από το `addresses[0]` + τιμή στη ρίζα ⇒ μένει κενό', () => {
    const [hq] = resolveContactAddresses(asContact({
      type: 'individual',
      neighborhood: 'Μπαγιάτικη Συνοικία',
      addresses: [{ street: 'Τσιμισκή', number: '1', city: 'Θεσσαλονίκη', postalCode: '54623', type: 'home', isPrimary: true }],
    }), 'individual');
    expect(hq.street).toBe('Τσιμισκή');
    expect(hq.neighborhood).toBeUndefined();
  });

  it('μόνο ρίζα (πολύ παλιό έγγραφο) ⇒ μία εγγραφή με τον τύπο ADR-319 του είδους', () => {
    const list = resolveContactAddresses(asContact({ type: 'service', street: 'Βασ. Σοφίας', city: 'Αθήνα' }), 'service');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ street: 'Βασ. Σοφίας', city: 'Αθήνα', type: 'central_service' });
  });
});
