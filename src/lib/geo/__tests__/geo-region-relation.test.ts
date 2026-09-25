/**
 * @fileoverview Άγκυρα του κριτή «κύκλος προς όριο» (ADR-883) — **δύο αβεβαιότητες προστίθενται**:
 * η ακτίνα της αγγελίας και η ανοχή του απλοποιημένου συνόρου. Καμία δεν αγνοείται.
 */

import { areaBoundingBox, areaRelation, isGeoRegion } from '../geo-area';
import type { GeoRegion } from '@/types/geo/coordinates';

/** Τετράγωνο ~2,2 km × ~1,7 km γύρω από τον Εύοσμο. */
const REGION: GeoRegion = {
  adminId: 'municipality:0708',
  rings: [[
    { lat: 40.66, lng: 22.90 },
    { lat: 40.66, lng: 22.92 },
    { lat: 40.68, lng: 22.92 },
    { lat: 40.68, lng: 22.90 },
  ]],
  bbox: { south: 40.66, west: 22.90, north: 40.68, east: 22.92 },
  toleranceM: 25,
};

const CENTRE = { lat: 40.67, lng: 22.91 };
/** ~85 m μέσα από το ανατολικό σύνορο (0,001° μήκους ≈ 84,5 m σε πλάτος 40,67°). */
const NEAR_EAST_EDGE = { lat: 40.67, lng: 22.919 };

describe('areaRelation(κύκλος, όριο)', () => {
  it('σημείο στο κέντρο ⇒ within', () => {
    expect(areaRelation({ center: CENTRE, radiusKm: 0 }, REGION)).toBe('within');
  });

  it('🔒 σημείο 85 m μέσα, ανοχή 25 m ⇒ within· με ακτίνα 70 m ⇒ ΙΣΩΣ (70 + 25 > 85)', () => {
    expect(areaRelation({ center: NEAR_EAST_EDGE, radiusKm: 0 }, REGION)).toBe('within');
    expect(areaRelation({ center: NEAR_EAST_EDGE, radiusKm: 0.07 }, REGION)).toBe('intersects');
  });

  it('🔒 η ανοχή ΜΕΤΡΑΕΙ: ίδιο σημείο, ανοχή 100 m ⇒ ΙΣΩΣ, όχι «μέσα»', () => {
    expect(areaRelation({ center: NEAR_EAST_EDGE, radiusKm: 0 }, { ...REGION, toleranceM: 100 })).toBe('intersects');
  });

  it('μακριά έξω ⇒ disjoint (και από τον φτηνό αποκλεισμό του ορθογωνίου)', () => {
    expect(areaRelation({ center: { lat: 40.63, lng: 22.94 }, radiusKm: 0.25 }, REGION)).toBe('disjoint');
  });

  it('λίγο έξω, με αβεβαιότητα που φτάνει το σύνορο ⇒ ίσως', () => {
    expect(areaRelation({ center: { lat: 40.67, lng: 22.921 }, radiusKm: 0.25 }, REGION)).toBe('intersects');
  });

  it('τρύπα στο όριο: σημείο μέσα στην τρύπα ⇒ disjoint (περιττό πλήθος δακτυλίων)', () => {
    const holed: GeoRegion = {
      ...REGION,
      rings: [...REGION.rings, [
        { lat: 40.665, lng: 22.905 },
        { lat: 40.665, lng: 22.915 },
        { lat: 40.675, lng: 22.915 },
        { lat: 40.675, lng: 22.905 },
      ]],
    };
    expect(areaRelation({ center: CENTRE, radiusKm: 0 }, holed)).toBe('disjoint');
  });
});

describe('το όριο ως γεωμετρία ερωτήματος', () => {
  it('isGeoRegion διακρίνει το όριο από κύκλο και ορθογώνιο', () => {
    expect(isGeoRegion(REGION)).toBe(true);
    expect(isGeoRegion({ center: CENTRE, radiusKm: 1 })).toBe(false);
    expect(isGeoRegion(REGION.bbox)).toBe(false);
  });

  it('το ορθογώνιο ανάγνωσης του ορίου είναι το ορθογώνιο της ΑΛΗΘΙΝΗΣ γεωμετρίας', () => {
    expect(areaBoundingBox(REGION)).toBe(REGION.bbox);
  });

  it('όριο ως υποκείμενο κρίνεται με το ορθογώνιό του (συντηρητικά)', () => {
    expect(areaRelation(REGION, { center: CENTRE, radiusKm: 50 })).toBe('within');
    expect(areaRelation(REGION, { center: { lat: 38, lng: 23.7 }, radiusKm: 5 })).toBe('disjoint');
  });
});
