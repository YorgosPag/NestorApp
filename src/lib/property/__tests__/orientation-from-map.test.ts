/**
 * ADR-937 Φάση Γ — όψεις από περίγραμμα κτιρίου στον χάρτη (αληθινός Βορράς).
 *
 *   Χ1  ορθογώνιο κτίριο ευθυγραμμισμένο με τους μεσημβρινούς: οι τέσσερις ακμές ⇒ Ν · Α · Β · Δ
 *   Χ2  η κλειστή κορυφή του GeoJSON δεν γεννά εκφυλισμένη ακμή · MultiPolygon ⇒ ο μεγαλύτερος δακτύλιος
 *   Χ3  φορά δακτυλίου (δεξιόστροφα/αριστερόστροφα) δεν αλλάζει το «προς τα έξω»
 *   Χ4  επιλογή ακμών ⇒ μόνο οι επιλεγμένες, στη σειρά του λεξιλογίου
 *   Χ5  κλικ κοντά σε πλευρά (μέσα στην ανοχή) ⇒ η πλησιέστερη · έξω από την ανοχή ⇒ καμία (ποτέ άλλο κτίριο)
 *   Χ6  πρόταση κτιρίου: αυτό που περιέχει τη θέση (το μεγαλύτερο) · αλλιώς το πλησιέστερο μέσα στην ακτίνα · αλλιώς κανένα
 */

import type { MultiPolygon, Polygon } from 'geojson';

import {
  EDGE_PICK_TOLERANCE_PX,
  buildingRingOf,
  edgeOrientationsOf,
  nearestEdgeIndex,
  orientationsOfSelectedEdges,
  suggestedBuildingIndex,
} from '../orientation-from-map';

/** Τετράγωνο 100×100 px οθόνης: ακμή 0 = πάνω, 1 = δεξιά, 2 = κάτω, 3 = αριστερά. */
const SQUARE_PX = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
const shift = (dx: number) => SQUARE_PX.map((p) => ({ x: p.x + dx, y: p.y }));

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

  it('Χ5 κλικ με ανοχή ⇒ η πλησιέστερη πλευρά · έξω από την ανοχή ⇒ καμία', () => {
    expect(nearestEdgeIndex(SQUARE_PX, { x: 50, y: 0 })).toBe(0);
    expect(nearestEdgeIndex(SQUARE_PX, { x: 50, y: -(EDGE_PICK_TOLERANCE_PX - 1) })).toBe(0);
    expect(nearestEdgeIndex(SQUARE_PX, { x: 108, y: 50 })).toBe(1);
    expect(nearestEdgeIndex(SQUARE_PX, { x: 50, y: 95 })).toBe(2);
    expect(nearestEdgeIndex(SQUARE_PX, { x: 50, y: -(EDGE_PICK_TOLERANCE_PX + 1) })).toBeNull();
    expect(nearestEdgeIndex(SQUARE_PX, { x: 50, y: 50 })).toBeNull();
    expect(nearestEdgeIndex([], { x: 0, y: 0 })).toBeNull();
  });

  it('Χ6 πρόταση κτιρίου: περιέχει (το μεγαλύτερο) · αλλιώς πλησιέστερο στην ακτίνα · αλλιώς κανένα', () => {
    const part = [{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 30, y: 30 }, { x: 10, y: 30 }];
    expect(suggestedBuildingIndex([part, SQUARE_PX], { x: 20, y: 20 })).toBe(1);
    expect(suggestedBuildingIndex([shift(300), shift(160)], { x: 130, y: 50 })).toBe(1);
    expect(suggestedBuildingIndex([shift(300)], { x: 130, y: 50 })).toBeNull();
    expect(suggestedBuildingIndex([], { x: 0, y: 0 })).toBeNull();
  });
});
