/**
 * ⚓ ADR-249 §7 · §7.7 — **ο ΕΝΑΣ κριτής «άλλαξε αυτό το πεδίο ακινήτου;»** και η μερική διόρθωση που χτίζεται πάνω του.
 *
 * Τον ρωτούν τρία σημεία — το κλείδωμα του server, η πύλη μεταλλάξεων του πελάτη, το φίλτρο της φόρμας — άρα αν
 * ξανααποκλίνει, η ίδια πράξη («δεν άλλαξα τίποτα») θα σήμαινε τρία διαφορετικά πράγματα. Εδώ κλειδώνεται η
 * σημασία: **ίδια τιμή = ίδια ΣΗΜΑΣΙΑ, όχι ίδια bytes** (AIP-203).
 */

import { changedPropertyFields, samePropertyFieldValue } from '../property-field-change';

describe('samePropertyFieldValue — ισοδυναμίες του τομέα', () => {
  it('Σ1 — εμβαδά: `0` ≡ απουσία ≡ «δεν μετρήθηκε» (ADR-777 §8.97)', () => {
    expect(samePropertyFieldValue('areas', { gross: 80, terrace: 0 }, { gross: 80 })).toBe(true);
    expect(samePropertyFieldValue('areas', { gross: 0 }, undefined)).toBe(true);
    expect(samePropertyFieldValue('areas', { gross: 80 }, { gross: 81 })).toBe(false);
    expect(samePropertyFieldValue('areas', { gross: 80 }, undefined)).toBe(false);
  });

  it('Σ2 — κοινόχρηστα: άδεια δήλωση ≡ απουσία· το `0` («χωρίς κοινόχρηστα») είναι ΑΠΑΝΤΗΣΗ', () => {
    expect(samePropertyFieldValue('commonCharges', { monthlyAmount: null, includes: null }, undefined)).toBe(true);
    expect(samePropertyFieldValue('commonCharges', { monthlyAmount: 0, includes: null }, undefined)).toBe(false);
    expect(samePropertyFieldValue('commonCharges', { monthlyAmount: 120, includes: null }, { monthlyAmount: 120 })).toBe(true);
  });

  it('Σ3 — ΠΕΑ: κλάση εκτός λεξιλογίου ≡ «δεν δηλώθηκε»· άλλη κλάση = αλλαγή', () => {
    expect(samePropertyFieldValue('energy', { class: null }, undefined)).toBe(true);
    expect(samePropertyFieldValue('energy', null, undefined)).toBe(true);
    expect(samePropertyFieldValue('energy', { class: 'C' }, { class: 'B' })).toBe(false);
    expect(samePropertyFieldValue('energy', { class: 'C' }, { class: 'C' })).toBe(true);
  });

  it('Σ4 — βαθμωτά (σειριοποιητής του ιστορικού): `undefined` ≡ `null` ≡ κενό ≡ `[]`· η σειρά κλειδιών δεν μετρά', () => {
    for (const empty of [null, '', []]) expect(samePropertyFieldValue('description', empty, undefined)).toBe(true);
    expect(samePropertyFieldValue('layout', { bedrooms: 2, wc: 0 }, { wc: 0, bedrooms: 2 })).toBe(true);
    expect(samePropertyFieldValue('name', 'Α', 'Β')).toBe(false);
    expect(samePropertyFieldValue('floor', 0, null)).toBe(false);
  });
});

describe('changedPropertyFields — μερική διόρθωση (RFC 7396) από δύο καταστάσεις', () => {
  it('Δ1 — αμετάβλητο πεδίο ⇒ ΔΕΝ μπαίνει· άλλαξε ⇒ μπαίνει με τη νέα τιμή', () => {
    const patch = changedPropertyFields({ name: 'Α', floor: 3 }, { name: 'Α', floor: 2 });
    expect(patch).toEqual({ floor: 3 });
  });

  it('Δ2 — ίδιο κατά τον τομέα (όχι κατά bytes) ⇒ ΔΕΝ μπαίνει', () => {
    expect(changedPropertyFields({ areas: { gross: 80 } }, { areas: { gross: 80, terrace: 0 } })).toEqual({});
  });

  it('🔴 Δ3 — πεδίο που ΕΙΧΕ τιμή και λείπει από το `next` ⇒ `null` («σβήσε το»)', () => {
    expect(changedPropertyFields({}, { description: 'Φωτεινό', areas: { gross: 80 } })).toEqual({
      description: null,
      areas: null,
    });
  });

  it('Δ4 — `undefined` στο `next` ≡ απουσία: σβήνει ό,τι είχε τιμή, αγνοείται ό,τι ήταν ήδη άδειο', () => {
    expect(changedPropertyFields({ description: undefined }, { description: 'Φωτεινό' })).toEqual({ description: null });
    expect(changedPropertyFields({ description: undefined }, {})).toEqual({});
  });

  it('Δ5 — πεδίο που λείπει και από τα δύο ή ήταν άδειο κατά τον τομέα ⇒ τίποτα (κανένα άσκοπο `null`)', () => {
    expect(changedPropertyFields({}, { areas: { gross: 0 }, commonCharges: { monthlyAmount: null, includes: null } })).toEqual({});
  });

  it('Δ6 — ιδεμπότητα: ίδια κατάσταση ⇒ κενή διόρθωση', () => {
    const state = { name: 'Α', areas: { gross: 80, net: 72 }, layout: { bedrooms: 2 } };
    expect(changedPropertyFields(state, { ...state })).toEqual({});
  });
});
