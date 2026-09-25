/**
 * ΑΓΚΥΡΕΣ — **Η ΣΧΕΔΙΑΣΜΕΝΗ ΠΕΡΙΟΧΗ ΚΡΙΝΕΤΑΙ ΩΣ ΕΝΩΣΗ** (ADR-885).
 *
 * 🔴 Η κρίσιμη άγκυρα είναι η **επικάλυψη**: ο κριτής του ορίου (ADR-883) κρίνει με
 * περιττό πλήθος, και αν το σχέδιο περνούσε από τον ίδιο δρόμο με όλα τα σχήματα μαζί,
 * σημείο μέσα σε δύο επικαλυπτόμενα σχήματα θα ήταν «έξω». Μετάλλαξη
 * `circleToRings(circle, query.shapes, 0)` ⇒ πρέπει να κοκκινίσει.
 */

import { areaBoundingBox, areaRelation, matchGeoArea, outlinesBoundingBox } from '@/lib/geo/geo-area';
import type { GeoArea, GeoCircle, GeoDrawnArea, GeoOutline } from '@/types/geo/coordinates';

/** Τετράγωνο ~2,2 × 1,8 χλμ. γύρω από το κέντρο της Αθήνας. */
const square = (south: number, west: number, size: number): GeoOutline => [
  { lat: south, lng: west },
  { lat: south, lng: west + size },
  { lat: south + size, lng: west + size },
  { lat: south + size, lng: west },
];

const A = square(37.97, 23.72, 0.02);
/** Επικαλύπτει το `A` στο τετράγωνο 37.98–37.99 / 23.73–23.74. */
const B = square(37.98, 23.73, 0.02);
/** Μακριά — Θεσσαλονίκη. */
const FAR = square(40.6, 22.9, 0.02);

const drawn = (...shapes: GeoOutline[]): GeoDrawnArea => ({
  shapes,
  bbox: outlinesBoundingBox(shapes) ?? { south: 0, west: 0, north: 0, east: 0 },
});

const point = (lat: number, lng: number, radiusKm = 0): GeoCircle => ({ center: { lat, lng }, radiusKm });

describe('σχεδιασμένη περιοχή — ένωση, όχι περιττό πλήθος', () => {
  it('🔴 σημείο στην ΕΠΙΚΑΛΥΨΗ δύο σχημάτων = within (με even-odd θα ήταν disjoint)', () => {
    expect(areaRelation(point(37.985, 23.735), drawn(A, B))).toBe('within');
  });

  it('σημείο μόνο στο δεύτερο σχήμα = within', () => {
    expect(areaRelation(point(37.995, 23.745), drawn(A, B))).toBe('within');
  });

  it('σημείο έξω από όλα = disjoint', () => {
    expect(areaRelation(point(37.96, 23.70), drawn(A, B))).toBe('disjoint');
  });

  it('κύκλος αβεβαιότητας που αγγίζει το σύνορο = intersects («ίσως»)', () => {
    expect(areaRelation(point(37.97, 23.73, 0.5), drawn(A))).toBe('intersects');
  });

  it('κύκλος μακριά από τα σχήματα = disjoint, ακόμη κι αν ένα σχήμα είναι μακριά αλλού', () => {
    expect(areaRelation(point(38.2, 23.9, 1), drawn(A, FAR))).toBe('disjoint');
  });

  it('ορθογώνιο ως υποκείμενο κρίνεται με τον περιγεγραμμένο κύκλο του', () => {
    const box = { south: 37.975, west: 23.725, north: 37.978, east: 23.728 };
    expect(areaRelation(box, drawn(A))).toBe('within');
  });
});

describe('outlinesBoundingBox', () => {
  it('καλύπτει όλα τα σχήματα', () => {
    expect(outlinesBoundingBox([A, B])).toEqual({ south: 37.97, west: 23.72, north: 38.0, east: 23.75 });
  });

  it('χωρίς κορυφές ⇒ null', () => {
    expect(outlinesBoundingBox([])).toBeNull();
  });

  it('το ορθογώνιο ανάγνωσης της περιοχής είναι το bbox της ένωσης', () => {
    const area = drawn(A, B);
    expect(areaBoundingBox(area)).toBe(area.bbox);
  });
});

describe('matchGeoArea — εξαντλητικός διακριτής', () => {
  const kind = (area: GeoArea): string =>
    matchGeoArea(area, {
      circle: () => 'circle',
      box: () => 'box',
      region: () => 'region',
      drawn: () => 'drawn',
    });

  it('ονομάζει σωστά και τα τέσσερα μέλη', () => {
    expect(kind(point(38, 23, 1))).toBe('circle');
    expect(kind({ south: 1, west: 1, north: 2, east: 2 })).toBe('box');
    expect(kind({ adminId: 'municipality:0708', rings: [A], bbox: drawn(A).bbox, toleranceM: 25 })).toBe('region');
    expect(kind(drawn(A))).toBe('drawn');
  });
});
