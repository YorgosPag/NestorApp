/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΟΥ ΑΔΕΙΑΣΜΑΤΟΣ** — `null` στο σώμα ⇒ διαγραφή πεδίου-δήλωσης, σε ΕΝΑ σημείο (ADR-249 §7.8).
 * @related api/properties/[id]/property-patch-helpers · api/properties/[id]/property-energy-patch · api/properties/[id]/route
 *
 * 🔴 Γιατί υπάρχει: η μετάφραση `null → FieldValue.delete()` είναι **μία γραμμή** (`isClearing`) και το κλειστό σύνολο
 * `PROPERTY_CLEARABLE_FIELDS` **ένας πίνακας**. Και τα δύο είναι αφαιρέσιμα/επεκτάσιμα σιωπηλά:
 * - χωρίς τη μετάφραση, το έγγραφο κρατά `commonCharges: null` και η δημόσια προβολή το διαβάζει ως «δηλωμένο»·
 * - με επέκταση σε `floorId`/`buildingId`, η μονάδα **εξαφανίζεται** από τα ερωτήματα `where(…, '==', null)`
 *   (το Firestore δεν ευρετηριάζει απόν πεδίο).
 * Κάθε `describe` εδώ κοκκινίζει σε μία από αυτές τις μεταλλάξεις.
 */

import { FieldValue } from 'firebase-admin/firestore';

import { energyDeclarationPatch } from '../property-energy-patch';
import {
  PROPERTY_CLEARABLE_FIELDS,
  PropertyPatchSchema,
  buildUpdateData,
  firestoreUpdateOf,
  propertyAfterUpdate,
} from '../property-patch-helpers';

const AT = '2026-11-10T12:00:00.000Z';
const UNDECLARED = {
  class: null, primaryEnergy: null, co2Emissions: null, issuedOn: null, usefulArea: null, finalEnergy: null,
  scope: null, sourceFileId: null, absence: null,
};
const DECLARED_B = { ...UNDECLARED, class: 'B', issuedOn: '2024-03-12' };

const isDeleteSentinel = (value: unknown): boolean =>
  value instanceof FieldValue && value.isEqual(FieldValue.delete());

/** Τα πεδία σύνδεσης/τιμής που αποθηκεύουν `null` ως «αποσυνδέθηκε» — ΠΟΤΕ διαγραφή. */
const STORED_NULL_FIELDS = ['floor', 'floorId', 'buildingId', 'projectId', 'area', 'price'] as const;

describe('Κ1 — το κλειστό σύνολο: ΑΚΡΙΒΩΣ αυτά τα πεδία σβήνονται', () => {
  it('🔴 το σύνολο είναι αυτό — επέκταση ή συρρίκνωση είναι απόφαση ADR, όχι σιωπηλή αλλαγή', () => {
    expect([...PROPERTY_CLEARABLE_FIELDS].sort()).toEqual([
      'areas', 'commonCharges', 'condition', 'description', 'energy',
      'finishes', 'interiorFeatures', 'securityFeatures', 'systemsOverride',
    ]);
  });

  it.each(STORED_NULL_FIELDS)('🔴 `%s` ΔΕΝ ανήκει στο σύνολο (ερωτήματα `== null`)', (field) => {
    expect(PROPERTY_CLEARABLE_FIELDS.has(field)).toBe(false);
  });
});

describe('Κ2 — η πόρτα δέχεται `null` ως «σβήσε» (RFC 7396)', () => {
  it.each(['commonCharges', 'energy', 'description'])('`%s: null` ⇒ περνά, και φτάνει ως `null` (το transform δεν τρέχει)', (field) => {
    const parsed = PropertyPatchSchema.safeParse({ [field]: null });
    expect(parsed.success).toBe(true);
    expect(parsed.success && (parsed.data as Record<string, unknown>)[field]).toBeNull();
  });

  it('κενή/λευκή περιγραφή ⇒ `null` στο updateData (ίδιος δρόμος με το ρητό `null`)', () => {
    expect(buildUpdateData({ description: '   ' }, {}).description).toBeNull();
    expect(buildUpdateData({ description: null }, {}).description).toBeNull();
  });
});

describe('Κ3 — `firestoreUpdateOf`: το ΕΝΑ σημείο μετάφρασης', () => {
  it.each([...PROPERTY_CLEARABLE_FIELDS])('🔴 `%s: null` ⇒ `FieldValue.delete()`', (field) => {
    expect(isDeleteSentinel(firestoreUpdateOf({ [field]: null })[field])).toBe(true);
  });

  it.each(STORED_NULL_FIELDS)('🔴 `%s: null` ⇒ μένει αποθηκευμένο `null`', (field) => {
    expect(firestoreUpdateOf({ [field]: null })[field]).toBeNull();
  });

  it('τιμές (όχι `null`) περνούν αυτούσιες — και στα σβήσιμα πεδία', () => {
    const charges = { monthlyAmount: 40, includes: null };
    const written = firestoreUpdateOf({ commonCharges: charges, name: 'Δ1', description: 'Φωτεινό', areas: { gross: 0 } });
    expect(written).toEqual({ commonCharges: charges, name: 'Δ1', description: 'Φωτεινό', areas: { gross: 0 } });
  });

  it('δεν αγγίζει την είσοδο — ιστορικό/κλείδωμα/προβολή συνεχίζουν να βλέπουν καθαρό `null`', () => {
    const updateData = { commonCharges: null, floorId: null };
    firestoreUpdateOf(updateData);
    expect(updateData).toEqual({ commonCharges: null, floorId: null });
  });
});

describe('Κ4 — `propertyAfterUpdate`: το έγγραφο όπως θα είναι στο Firestore', () => {
  const EXISTING = {
    name: 'Δ1', description: 'Παλιά', commonCharges: { monthlyAmount: 40, includes: null }, floorId: 'flr_1', price: 100_000,
  };

  it('🔴 τα σβησμένα ΛΕΙΠΟΥΝ (όχι `null`) — όπως μετά το `FieldValue.delete()`', () => {
    const after = propertyAfterUpdate(EXISTING, { commonCharges: null, description: null });
    expect(after).not.toHaveProperty('commonCharges');
    expect(after).not.toHaveProperty('description');
  });

  it('τα πεδία σύνδεσης με `null` ΜΕΝΟΥΝ `null` — ίδια απόφαση με την εγγραφή', () => {
    const after = propertyAfterUpdate(EXISTING, { floorId: null, price: null });
    expect(after).toMatchObject({ floorId: null, price: null });
  });

  it('τα υπόλοιπα συγχωνεύονται: νέα τιμή κερδίζει, ό,τι δεν στάλθηκε μένει', () => {
    const after = propertyAfterUpdate(EXISTING, { name: 'Δ2', commonCharges: null });
    expect(after).toEqual({ name: 'Δ2', description: 'Παλιά', floorId: 'flr_1', price: 100_000 });
  });

  it('δεν αγγίζει το αποθηκευμένο έγγραφο', () => {
    const snapshot = structuredClone(EXISTING);
    propertyAfterUpdate(EXISTING, { commonCharges: null });
    expect(EXISTING).toEqual(snapshot);
  });
});

describe('Κ5 — `energyDeclarationPatch(…, null, …)`: σβήσιμο του ΠΕΑ', () => {
  const OTHER_CLAIM = {
    kind: 'building-identity', subject: [{ propertyId: 'prop_1', spaceId: null }], tier: 'document-provided',
    value: null, authority: 'μηχανικός', assertedAt: AT, validUntil: null,
  };
  const declaredLegality = () => energyDeclarationPatch('prop_1', DECLARED_B, { legality: [OTHER_CLAIM] }, AT).legality;

  it('🔴 χωρίς πεδία παλιού σχήματος ⇒ `energy: null` — που η εγγραφή κάνει ΔΙΑΓΡΑΦΗ', () => {
    const patch = energyDeclarationPatch('prop_1', null, { energy: DECLARED_B }, AT);
    expect(patch.energy).toBeNull();
    expect(isDeleteSentinel(firestoreUpdateOf(patch).energy)).toBe(true);
  });

  it('🔴 τα πεδία του παλιού σχήματος ΕΠΙΒΙΩΝΟΥΝ — ό,τι δεν κατέχει το μπλοκ δεν σβήνεται από τη φόρμα', () => {
    const existing = { energy: { ...DECLARED_B, certificateId: '12345/2021', certificateDate: '2021-05-01', validUntil: 'legacy' } };
    const patch = energyDeclarationPatch('prop_1', null, existing, AT);
    expect(patch.energy).toEqual({ certificateId: '12345/2021', certificateDate: '2021-05-01', validUntil: 'legacy' });
    expect(firestoreUpdateOf(patch).energy).toEqual(patch.energy);
  });

  it('`null` στα πεδία παλιού σχήματος ΔΕΝ μετρά ως επιβίωση ⇒ διαγραφή', () => {
    const patch = energyDeclarationPatch('prop_1', null, { energy: { ...DECLARED_B, certificateId: null } }, AT);
    expect(patch.energy).toBeNull();
  });

  it('🔴 η αυτοδηλωμένη αξίωση ΦΕΥΓΕΙ· οι άλλες αξιώσεις μένουν', () => {
    const patch = energyDeclarationPatch('prop_1', null, { energy: DECLARED_B, legality: declaredLegality() }, AT);
    expect(patch.legality).toEqual([OTHER_CLAIM]);
  });

  // ADR-249 §7.8 (απόφαση 2026-11-10): το `legality` ΔΕΝ είναι δήλωση — είναι σύνολο αξιώσεων του server, με κανονική
  // μορφή «καμία» το `[]` (ίδια με τον γραφέα του ιδιοκτήτη και τη δημόσια αγγελία, ADR-838). Ποτέ διαγραφή.
  it('🔒 χωρίς άλλες αξιώσεις μένει `legality: []` — κανονική μορφή του «καμία αξίωση», ΟΧΙ διαγραφή', () => {
    const patch = energyDeclarationPatch('prop_1', null, { energy: DECLARED_B }, AT);
    expect(patch.legality).toEqual([]);
    expect(firestoreUpdateOf(patch).legality).toEqual([]);
  });
});
