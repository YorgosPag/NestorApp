/**
 * ADR-896 §6 — ο κριτής της μετάπτωσης «μόνο περιοχή»: τι απέμεινε, και ότι η αφαίρεση είναι ιδεμποτική.
 */

import { areaOnlyResidue, stripAreaOnlyResidue } from '../showcase-area-only-residue';

const STREET_LOCATION = {
  id: 'sloc_street',
  role: 'headquarters',
  street: { street: 'Σαμοθράκης', number: '16', postalCode: '56334' },
  place: { landId: 'land_street', buildingId: null },
  position: { lat: 40.66, lng: 22.9 },
  hours: null,
};

const LEGACY_AREA_ONLY = {
  id: 'sloc_area',
  role: 'branch',
  street: null,
  place: { landId: 'land_home', buildingId: null },
  position: { lat: 37.98, lng: 23.72 },
  hours: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
  unknownFutureField: 'κρατιέται',
};

const AREA = { adminId: 'municipality:0701' };

describe('areaOnlyResidue', () => {
  it('βρίσκει ΜΟΝΟ τα «μόνο περιοχή» που κουβαλούν ακόμη τόπο', () => {
    expect(areaOnlyResidue([STREET_LOCATION, LEGACY_AREA_ONLY])).toEqual([
      { locationId: 'sloc_area', place: { landId: 'land_home', buildingId: null }, position: { lat: 37.98, lng: 23.72 } },
    ]);
  });

  it('μισή οδός μετράει ως «μόνο περιοχή» — ίδιος κανόνας με τον αναγνώστη', () => {
    const half = { ...LEGACY_AREA_ONLY, street: { street: 'Κομνηνών', number: '4', postalCode: '' } };
    expect(areaOnlyResidue([half])).toHaveLength(1);
  });

  it('απόν / σκουπίδι ⇒ τίποτα, ποτέ σφάλμα', () => {
    expect(areaOnlyResidue(undefined)).toEqual([]);
    expect(areaOnlyResidue([null, 'x', { street: null }])).toEqual([]);
  });
});

describe('stripAreaOnlyResidue', () => {
  it('🔴 αφαιρεί place/position, βάζει τον δήμο, και αφήνει ΟΛΑ τα άλλα αυτούσια', () => {
    const areas = new Map([['sloc_area', AREA]]);
    const [street, stripped] = stripAreaOnlyResidue([STREET_LOCATION, LEGACY_AREA_ONLY], areas);
    expect(street).toBe(STREET_LOCATION);
    expect(stripped).not.toHaveProperty('place');
    expect(stripped).not.toHaveProperty('position');
    expect(stripped).toMatchObject({ area: AREA, hours: LEGACY_AREA_ONLY.hours, unknownFutureField: 'κρατιέται' });
  });

  it('🔑 ιδεμποτία: μετά την αφαίρεση, το υπόλειμμα είναι ΜΗΔΕΝ', () => {
    const once = stripAreaOnlyResidue([STREET_LOCATION, LEGACY_AREA_ONLY], new Map([['sloc_area', AREA]]));
    expect(areaOnlyResidue(once)).toEqual([]);
    expect(stripAreaOnlyResidue(once, new Map([['sloc_area', AREA]]))).toEqual(once);
  });

  it('κατάστημα χωρίς απόφαση δήμου ΔΕΝ αγγίζεται (ο γραφέας ρωτά πρώτα)', () => {
    const [untouched] = stripAreaOnlyResidue([LEGACY_AREA_ONLY], new Map());
    expect(untouched).toBe(LEGACY_AREA_ONLY);
  });
});
