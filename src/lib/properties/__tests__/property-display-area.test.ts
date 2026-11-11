/**
 * ⚓ «Ποιο εμβαδόν» — το ΕΝΑ εμβαδόν της οθόνης, με το ΕΙΔΟΣ του, και η ΒΑΣΗ ΣΥΓΚΡΙΣΗΣ της αγγελίας
 * (ADR-898 Φ4β · ADR-777 §8.96.5 · §8.100).
 */

import {
  propertyDisplayArea,
  readStoredGrossBasisKind,
  resolveDisplayArea,
  resolveGrossBasisArea,
  resolveListingDisplayArea,
} from '../property-display-area';

describe('Ε1 — η αλυσίδα: μικτό → καθαρό → παλιό `area`', () => {
  it.each([
    ['μικτό', { areas: { gross: 95, net: 80 }, area: 70 }, 95],
    ['χωρίς μικτό ⇒ καθαρό', { areas: { net: 80 }, area: 70 }, 80],
    ['χωρίς `areas` ⇒ το παλιό επίπεδο', { area: 70 }, 70],
    ['τίποτα ⇒ `null`', {}, null],
  ])('%s', (_label, source, expected) => {
    expect(propertyDisplayArea(source)).toBe(expected);
  });
});

describe('Ε2 — `0` = «δεν μετρήθηκε»: η αλυσίδα προχωρά, ποτέ «0 m²»', () => {
  it('μικτό 0 ⇒ το καθαρό', () => {
    expect(propertyDisplayArea({ areas: { gross: 0, net: 80 } })).toBe(80);
  });

  it('όλα 0 ⇒ `null`', () => {
    expect(propertyDisplayArea({ areas: { gross: 0, net: 0 }, area: 0 })).toBeNull();
  });
});

describe('Ε3 — ανεκτικός αναγνώστης: ωμό έγγραφο Firestore δεν περνά ό,τι δεν είναι μέτρηση', () => {
  it.each([
    ['συμβολοσειρά', '95'],
    ['αρνητικό', -95],
    ['άπειρο', Number.POSITIVE_INFINITY],
    ['NaN', Number.NaN],
  ])('μικτό ως %s ⇒ παραλείπεται, μετρά το επόμενο', (_label, gross) => {
    expect(propertyDisplayArea({ areas: { gross, net: 80 } })).toBe(80);
  });

  it('`areas` που δεν είναι αντικείμενο ⇒ το παλιό `area`', () => {
    expect(propertyDisplayArea({ areas: 'x', area: 70 })).toBe(70);
    expect(propertyDisplayArea({ areas: null, area: 70 })).toBe(70);
  });
});

describe('Ε4 — η τιμή ταξιδεύει ΜΕ το είδος της (ADR-777 §8.100)', () => {
  it.each([
    ['μικτό ⇒ gross', { areas: { gross: 120, net: 108 }, area: 120 }, { value: 120, kind: 'gross' }],
    ['καθαρό ⇒ net', { areas: { net: 108 } }, { value: 108, kind: 'net' }],
    ['παλιό `area` ⇒ unspecified', { area: 95 }, { value: 95, kind: 'unspecified' }],
    ['τίποτα ⇒ null', {}, null],
  ])('%s', (_label, source, expected) => {
    expect(resolveDisplayArea(source)).toEqual(expected);
  });

  it('🔴 το ζωντανό σφάλμα του τίτλου (2026-11-11): μικτό 0 + καθαρό 108 ⇒ «108 καθαρά», όχι κρυφό', () => {
    // Ο τίτλος έγραφε `gross ?? net ?? area` ⇒ `0` ⇒ ο έλεγχος `> 0` έκρυβε το εμβαδόν.
    expect(resolveDisplayArea({ areas: { gross: 0, net: 108 } })).toEqual({ value: 108, kind: 'net' });
  });

  it('το `propertyDisplayArea` είναι ΠΑΝΤΑ η τιμή του `resolveDisplayArea` — καμία δεύτερη αλυσίδα', () => {
    const sources = [{ areas: { gross: 120 } }, { areas: { gross: 0, net: 108 } }, { area: 95 }, {}];
    for (const source of sources) {
      expect(propertyDisplayArea(source)).toBe(resolveDisplayArea(source)?.value ?? null);
    }
  });
});

describe('Ε5 — βάση σύγκρισης: μικτό → παλιό `area`, ΠΟΤΕ καθαρό (Idealista · RESO)', () => {
  it.each([
    ['μικτό ⇒ gross', { areas: { gross: 120, net: 108 }, area: 120 }, { value: 120, kind: 'gross' }],
    ['παλιό `area` ⇒ unspecified', { areas: { net: 108 }, area: 95 }, { value: 95, kind: 'unspecified' }],
    ['🔴 μόνο καθαρό ⇒ null (ποτέ το καθαρό ως μικτό)', { areas: { net: 108 } }, null],
    ['🔴 μικτό 0 + καθαρό ⇒ null', { areas: { gross: 0, net: 108 }, area: 0 }, null],
  ])('%s', (_label, source, expected) => {
    expect(resolveGrossBasisArea(source)).toEqual(expected);
  });
});

describe('Ε6 — η αγγελία δείχνει τη βάση, αλλιώς το καθαρό ΟΝΟΜΑΣΜΕΝΟ', () => {
  it.each([
    ['μικτό', { areaSqm: 120, areaKind: 'gross', netAreaSqm: 108 }, { value: 120, kind: 'gross' }],
    ['βάση χωρίς είδος (παλιό έγγραφο) ⇒ unspecified', { areaSqm: 95, areaKind: null, netAreaSqm: null }, { value: 95, kind: 'unspecified' }],
    ['χωρίς βάση ⇒ το καθαρό', { areaSqm: null, areaKind: null, netAreaSqm: 108 }, { value: 108, kind: 'net' }],
    ['τίποτα ⇒ null', { areaSqm: null, areaKind: null, netAreaSqm: null }, null],
  ] as const)('%s', (_label, listing, expected) => {
    expect(resolveListingDisplayArea(listing)).toEqual(expected);
  });
});

describe('Ε7 — παλιό αποθηκευμένο έγγραφο (κρίκος v29): «η βάση δεν είναι γνωστή», ποτέ εικασία', () => {
  it.each([
    ['εμβαδόν χωρίς είδος ⇒ unspecified (μπορεί να ήταν το καθαρό)', undefined, 95, 'unspecified'],
    ['έγκυρο είδος μένει (ιδιοδύναμο)', 'gross', 95, 'gross'],
    ['🔴 `net` ΔΕΝ είναι έγκυρη βάση ⇒ unspecified', 'net', 95, 'unspecified'],
    ['σκουπίδι ⇒ unspecified', 42, 95, 'unspecified'],
    ['χωρίς εμβαδόν ⇒ null (ποτέ ορφανό είδος)', 'gross', null, null],
    ['εμβαδόν 0 ⇒ null', 'gross', 0, null],
  ])('%s', (_label, kind, areaSqm, expected) => {
    expect(readStoredGrossBasisKind(kind, areaSqm)).toBe(expected);
  });
});
