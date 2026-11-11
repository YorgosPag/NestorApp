/**
 * ADR-937 Φάση Γ — όψεις από περίγραμμα κτιρίου στον χάρτη (αληθινός Βορράς).
 *
 *   Χ1  ορθογώνιο κτίριο ευθυγραμμισμένο με τους μεσημβρινούς: οι τέσσερις ακμές ⇒ Ν · Α · Β · Δ
 *   Χ2  η κλειστή κορυφή του GeoJSON δεν γεννά εκφυλισμένη ακμή · MultiPolygon ⇒ ο μεγαλύτερος δακτύλιος
 *   Χ3  φορά δακτυλίου (δεξιόστροφα/αριστερόστροφα) δεν αλλάζει το «προς τα έξω»
 *   Χ4  επιλογή ακμών ⇒ μόνο οι επιλεγμένες, στη σειρά του λεξιλογίου
 */

import type { MultiPolygon, Polygon } from 'geojson';

import { buildingRingOf, edgeOrientationsOf, orientationsOfSelectedEdges } from '../orientation-from-map';

// Μικρό ορθογώνιο στην Αθήνα, αριστερόστροφα: ΝΔ → ΝΑ → ΒΑ → ΒΔ (lng, lat).
const CCW: Polygon = {
  type: 'Polygon',
  coordinates: [[[23.7, 37.9], [23.7002, 37.9], [23.7002, 37.9001], [23.7, 37.9001], [23.7, 37.9]]],
};

describe('orientation-from-map', () => {
  it('Χ1 οι τέσσερις ακμές βλέπουν Ν · Α · Β · Δ', () => {
    const ring = buildingRingOf(CCW);
    expect(ring).not.toBeNull();
    expect(edgeOrientationsOf(ring ?? [])).toEqual(['south', 'east', 'north', 'west']);
  });

  it('Χ2 κλειστή κορυφή αφαιρείται · MultiPolygon ⇒ ο μεγαλύτερος δακτύλιος', () => {
    expect(buildingRingOf(CCW)).toHaveLength(4);
    const tiny = [[23.8, 38.0], [23.80001, 38.0], [23.80001, 38.00001], [23.8, 38.0]];
    const multi: MultiPolygon = { type: 'MultiPolygon', coordinates: [[tiny], CCW.coordinates] };
    expect(buildingRingOf(multi)).toHaveLength(4);
    expect(buildingRingOf(multi)?.[0]).toEqual({ lat: 37.9, lng: 23.7 });
  });

  it('Χ3 δεξιόστροφος δακτύλιος δίνει τις ίδιες εξωτερικές όψεις', () => {
    const cw: Polygon = { type: 'Polygon', coordinates: [[...CCW.coordinates[0]].reverse()] };
    const orientations = edgeOrientationsOf(buildingRingOf(cw) ?? []);
    expect([...orientations].sort()).toEqual(['east', 'north', 'south', 'west']);
  });

  it('Χ4 μόνο οι επιλεγμένες ακμές, στη σειρά του λεξιλογίου', () => {
    const ring = buildingRingOf(CCW) ?? [];
    expect(orientationsOfSelectedEdges(ring, new Set([3, 0]))).toEqual(['south', 'west']);
    expect(orientationsOfSelectedEdges(ring, new Set())).toEqual([]);
  });
});
