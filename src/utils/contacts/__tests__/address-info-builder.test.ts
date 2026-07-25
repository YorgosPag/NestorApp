/**
 * Tests για τον ΕΝΑ κατασκευαστή `AddressInfo` (ADR-332 D15).
 *
 * Καθηλώνουν ακριβώς ό,τι έχανε η προηγούμενη διπλή υλοποίηση: τη διοικητική
 * ιεραρχία, τη «Περιοχή / Συνοικία», την πραγματική χώρα και το ταχυδρομικό
 * είδος. Πράσινα tests ΔΕΝ έπιαναν το ελάττωμα — γιατί δεν υπήρχαν.
 */

import type { CompanyAddress, ContactFormData } from '@/types/ContactFormTypes';
import {
  buildAddressInfoFromFlatFields,
  buildAddressInfoListFromCompanyAddresses,
} from '../address-info-builder';

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

  it('σέβεται την πραγματική χώρα αντί για σταθερό «GR»', () => {
    const [foreign] = buildAddressInfoListFromCompanyAddresses([
      companyAddress({ country: 'Germany' }),
    ]);
    expect(foreign.country).toBe('Germany');
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

describe('buildAddressInfoFromFlatFields', () => {
  const flat: Partial<ContactFormData> = {
    type: 'company',
    street: 'Τσιμισκή',
    streetNumber: '43',
    city: 'Θεσσαλονίκη',
    postalCode: '54623',
    municipality: 'Δήμος Θεσσαλονίκης',
    settlement: 'Θεσσαλονίκη',
    settlementId: 'settlement:THES1',
    neighborhood: 'Κέντρο',
  };

  it('χαρτογραφεί το flat `streetNumber` στο `number` του πίνακα', () => {
    expect(buildAddressInfoFromFlatFields(flat).number).toBe('43');
  });

  it('μεταφέρει ιεραρχία και συνοικία', () => {
    expect(buildAddressInfoFromFlatFields(flat)).toMatchObject({
      municipality: 'Δήμος Θεσσαλονίκης',
      settlement: 'Θεσσαλονίκη',
      settlementId: 'settlement:THES1',
      neighborhood: 'Κέντρο',
    });
  });

  it('η κύρια διεύθυνση παίρνει την ταξινομία του είδους επαφής', () => {
    expect(buildAddressInfoFromFlatFields({ ...flat, type: 'company' }).label).toBe('headquarters');
    expect(buildAddressInfoFromFlatFields({ ...flat, type: 'individual' }).label).toBe('home');
    expect(buildAddressInfoFromFlatFields({ ...flat, type: 'individual' }).type).toBe('home');
  });

  it('ρητός `primaryAddressType` υπερισχύει του είδους επαφής', () => {
    const address = buildAddressInfoFromFlatFields({ ...flat, primaryAddressType: 'factory' });
    expect(address.label).toBe('factory');
  });

  it('ΙΣΟΔΥΝΑΜΙΑ: οι δύο κατασκευαστές παράγουν ίδια ιεραρχία για ίδια δεδομένα', () => {
    // Αυτό ακριβώς είχε αποκλίνει: το ένα μονοπάτι έγραφε ιεραρχία, το άλλο όχι.
    const fromFlat = buildAddressInfoFromFlatFields(flat);
    const [fromCompany] = buildAddressInfoListFromCompanyAddresses([
      companyAddress({
        street: 'Τσιμισκή',
        number: '43',
        city: 'Θεσσαλονίκη',
        postalCode: '54623',
        municipalityName: 'Δήμος Θεσσαλονίκης',
        settlementId: 'settlement:THES1',
        neighborhood: 'Κέντρο',
        type: 'headquarters',
      }),
    ]);

    const hierarchyOf = (a: typeof fromFlat) => ({
      municipality: a.municipality,
      settlement: a.settlement,
      settlementId: a.settlementId,
      neighborhood: a.neighborhood,
    });

    expect(hierarchyOf(fromCompany)).toEqual(hierarchyOf(fromFlat));
    expect(fromCompany.label).toBe(fromFlat.label);
    expect(fromCompany.type).toBe(fromFlat.type);
    expect(fromCompany.isPrimary).toBe(fromFlat.isPrimary);
  });
});
