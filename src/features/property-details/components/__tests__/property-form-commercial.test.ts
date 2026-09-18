/**
 * ⚓ ADR-777 §8.60.18 — η φόρμα ΑΚΙΝΗΤΟΥ ρωτά τον ΙΔΙΟ κριτή «τι άλλαξε» με τους χώρους.
 *
 * Ο mapper είχε δικό του, χειρόγραφο αντίγραφο της ανάλυσης ποσών. Πλέον ζητά το
 * `changedCommercialAmounts` — αν ξανααποκλίνει, η ίδια πράξη («άλλαξα το ενοίκιο») θα έγραφε
 * άλλο πράγμα σε ακίνητο και σε θέση.
 */

import { buildPropertyUpdatesFromForm } from '../property-fields-form-mapper';
import type { PropertyFieldsFormData } from '../property-fields-form-types';
import type { Property } from '@/types/property-viewer';

function formOf(overrides: Partial<PropertyFieldsFormData>): PropertyFieldsFormData {
  return {
    name: 'ΔΟΚΙΜΗ Α', code: 'T-A-1.01', type: 'apartment', projectId: '', buildingId: '', floorId: '',
    operationalStatus: 'draft', commercialStatus: 'for-rent', description: '', floor: 1,
    bedrooms: 2, bathrooms: 1, wc: 0, areaGross: 80, areaNet: 72, areaBalcony: 8, areaTerrace: 0,
    areaGarden: 0, orientations: [], condition: '', energyClass: '', heatingType: '', coolingType: '',
    flooring: [], windowFrames: '', glazing: '', interiorFeatures: [], securityFeatures: [],
    levelData: {}, levels: [], askingPrice: '', rentPrice: '500',
    ...overrides,
  };
}

/** Η «ΔΟΚΙΜΗ Α» της ζωντανής Firestore: προς ενοικίαση, 500 €/μήνα. */
const dokimiA = {
  id: 'prop_a0000001', name: 'ΔΟΚΙΜΗ Α', commercialStatus: 'for-rent',
  commercial: { askingPrice: null, rentPrice: 500, finalPrice: null, owners: [{ contactId: 'c1' }] },
} as unknown as Property;

describe('Φόρμα ακινήτου → ποσά μέσα από τον ΕΝΑ κριτή', () => {
  it('🔴 Π1 — αλλαγή ΜΟΝΟ του ενοικίου ⇒ γράφεται το νέο ενοίκιο, τα υπόλοιπα εμπορικά μένουν', () => {
    const updates = buildPropertyUpdatesFromForm({ formData: formOf({ rentPrice: '650' }), property: dokimiA, isMultiLevel: false });
    expect(updates.commercial).toMatchObject({ rentPrice: 650, owners: [{ contactId: 'c1' }] });
  });

  it('Π2 — καμία αλλαγή ποσού ⇒ ΚΑΝΕΝΑ `commercial` στο σώμα (δεν ξαναγράφεται ό,τι δεν αγγίχτηκε)', () => {
    const updates = buildPropertyUpdatesFromForm({ formData: formOf({}), property: dokimiA, isMultiLevel: false });
    expect(updates.commercial).toBeUndefined();
  });

  it('Π3 — «0» ή κενό ⇒ `null` (ποτέ «0 €» στην αγγελία)', () => {
    const updates = buildPropertyUpdatesFromForm({ formData: formOf({ rentPrice: '0' }), property: dokimiA, isMultiLevel: false });
    expect(updates.commercial).toMatchObject({ rentPrice: null });
  });
});
