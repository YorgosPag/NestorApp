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
import { UNDECLARED_ENERGY_FORM_SLICE } from '@/lib/energy-certificate/energy-certificate-form';

function formOf(overrides: Partial<PropertyFieldsFormData>): PropertyFieldsFormData {
  return {
    name: 'ΔΟΚΙΜΗ Α', code: 'T-A-1.01', type: 'apartment', projectId: '', buildingId: '', floorId: '',
    operationalStatus: 'draft', commercialStatus: 'for-rent', description: '', floor: 1,
    bedrooms: 2, bathrooms: 1, wc: 0, areaGross: 80, areaNet: 72, areaBalcony: 8, areaTerrace: 0,
    areaGarden: 0, orientations: [], condition: '', energyClass: '', heatingType: '', coolingType: '',
    flooring: [], windowFrames: '', glazing: '', interiorFeatures: [], securityFeatures: [],
    levelData: {}, levels: [], askingPrice: '', rentPrice: '500',
    commonCharges: { monthlyAmount: null, includes: null },
    energyDetails: UNDECLARED_ENERGY_FORM_SLICE.energyDetails,
    ...overrides,
  };
}

/** Η «ΔΟΚΙΜΗ Α» της ζωντανής Firestore: προς ενοικίαση, 500 €/μήνα. */
const dokimiA = {
  id: 'prop_a0000001', name: 'ΔΟΚΙΜΗ Α', commercialStatus: 'for-rent',
  commercial: { askingPrice: null, rentPrice: 500, finalPrice: null, owners: [{ contactId: 'c1' }] },
} as unknown as Property;

describe('Φόρμα ακινήτου → κοινόχρηστα (ADR-777 §8.93)', () => {
  it('Κ1 — καμία αλλαγή ⇒ ΚΑΝΕΝΑ `commonCharges` στο σώμα (αλλιώς κάθε αποθήκευση θα έγραφε ίχνος)', () => {
    const updates = buildPropertyUpdatesFromForm({ formData: formOf({}), property: dokimiA, isMultiLevel: false });
    expect(updates.commonCharges).toBeUndefined();
  });

  it('Κ2 — νέα δήλωση ⇒ ολόκληρο το μπλοκ', () => {
    const commonCharges = { monthlyAmount: 120, includes: ['heating' as const] };
    const updates = buildPropertyUpdatesFromForm({ formData: formOf({ commonCharges }), property: dokimiA, isMultiLevel: false });
    expect(updates.commonCharges).toEqual(commonCharges);
  });

  it('🔴 Κ3 — «χωρίς κοινόχρηστα» (`0`) γράφεται ως απάντηση, δεν πέφτει ως «κενό»', () => {
    const updates = buildPropertyUpdatesFromForm({
      formData: formOf({ commonCharges: { monthlyAmount: 0, includes: null } }),
      property: dokimiA,
      isMultiLevel: false,
    });
    expect(updates.commonCharges).toEqual({ monthlyAmount: 0, includes: null });
  });

  it('Κ4 — ίδια δήλωση με το έγγραφο ⇒ δεν ξαναγράφεται· σβήσιμο ⇒ γράφεται το «τίποτα δηλωμένο»', () => {
    const stored = { ...dokimiA, commonCharges: { monthlyAmount: 120, includes: null } } as Property;
    const same = buildPropertyUpdatesFromForm({
      formData: formOf({ commonCharges: { monthlyAmount: 120, includes: null } }),
      property: stored,
      isMultiLevel: false,
    });
    expect(same.commonCharges).toBeUndefined();

    const cleared = buildPropertyUpdatesFromForm({ formData: formOf({}), property: stored, isMultiLevel: false });
    expect(cleared.commonCharges).toEqual({ monthlyAmount: null, includes: null });
  });
});

describe('Φόρμα ακινήτου → ενεργειακό πιστοποιητικό (ADR-777 §8.94)', () => {
  const figures = { primaryEnergy: 132.4, co2Emissions: 38.1, issuedOn: '2024-03-12', usefulArea: null, finalEnergy: null, absence: null };

  it('Ε1 — καμία αλλαγή ⇒ ΚΑΝΕΝΑ `energy` στο σώμα', () => {
    const updates = buildPropertyUpdatesFromForm({ formData: formOf({}), property: dokimiA, isMultiLevel: false });
    expect(updates.energy).toBeUndefined();
  });

  it('Ε2 — νέα δήλωση ⇒ ολόκληρο το μπλοκ, κλάση και αριθμοί μαζί', () => {
    const updates = buildPropertyUpdatesFromForm({
      formData: formOf({ energyClass: 'B+', energyDetails: figures }),
      property: dokimiA,
      isMultiLevel: false,
    });
    expect(updates.energy).toEqual({ class: 'B+', ...figures });
  });

  it('🔴 Ε3 — αλλαγή ΜΟΝΟ της κλάσης δεν σβήνει τους αριθμούς (ο παλιός mapper έγραφε `{ class }` και τους έσβηνε)', () => {
    const stored = { ...dokimiA, energy: { class: 'C', ...figures } } as Property;
    const updates = buildPropertyUpdatesFromForm({
      formData: formOf({ energyClass: 'B', energyDetails: figures }),
      property: stored,
      isMultiLevel: false,
    });
    expect(updates.energy).toEqual({ class: 'B', ...figures });
  });

  it('🔴 Ε4 — σβήσιμο κλάσης ΓΡΑΦΕΤΑΙ (πριν ήταν αδύνατο), και παίρνει μαζί του τους αριθμούς', () => {
    const stored = { ...dokimiA, energy: { class: 'C', ...figures } } as Property;
    const updates = buildPropertyUpdatesFromForm({
      formData: formOf({ energyClass: '', energyDetails: figures }),
      property: stored,
      isMultiLevel: false,
    });
    expect(updates.energy).toEqual({ class: null, primaryEnergy: null, co2Emissions: null, issuedOn: null, usefulArea: null, finalEnergy: null, absence: null });
  });

  it('Ε5 — ίδια δήλωση με το έγγραφο ⇒ δεν ξαναγράφεται (ούτε ίχνος, ούτε νέα αξίωση)', () => {
    const stored = { ...dokimiA, energy: { class: 'C', ...figures } } as Property;
    const updates = buildPropertyUpdatesFromForm({
      formData: formOf({ energyClass: 'C', energyDetails: figures }),
      property: stored,
      isMultiLevel: false,
    });
    expect(updates.energy).toBeUndefined();
  });
});

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
