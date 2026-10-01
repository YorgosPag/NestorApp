/**
 * @fileoverview ADR-896 — η δηλωμένη εμβέλεια ως σχήμα στον χάρτη: τέσσερα σκέλη, καμία μαντεψιά.
 */

import { coverageShape, mergeMultiPolygons, multiPolygonExtent, outlinesToMultiPolygon } from '../coverage-geometry';

const TRIANGLE = [
  { lat: 40, lng: 22 },
  { lat: 41, lng: 22 },
  { lat: 40, lng: 23 },
];

describe('coverageShape', () => {
  it('καμία δήλωση ⇒ none (ποτέ «παντού»)', () => {
    expect(coverageShape(null)).toEqual({ kind: 'none' });
  });

  it('όλη η Ελλάδα ⇒ nationwide, χωρίς γεωμετρία', () => {
    expect(coverageShape({ nationwide: true })).toEqual({ kind: 'nationwide' });
  });

  it('διοικητικές περιοχές ⇒ οι ταυτότητες, αυτούσιες', () => {
    expect(coverageShape({ adminIds: ['municipality:0701', 'municipality:0708'] })).toEqual({
      kind: 'admin',
      adminIds: ['municipality:0701', 'municipality:0708'],
    });
  });

  it('κενή λίστα περιοχών ⇒ none', () => {
    expect(coverageShape({ adminIds: [] })).toEqual({ kind: 'none' });
  });

  it('περίγραμμα ⇒ ένα κλειστό πολύγωνο', () => {
    const shape = coverageShape({ outline: TRIANGLE });
    expect(shape.kind).toBe('drawn');
    if (shape.kind !== 'drawn') return;
    const ring = shape.geometry.coordinates[0][0];
    expect(ring).toHaveLength(4);
    expect(ring[0]).toEqual(ring[3]);
    expect(ring[0]).toEqual([22, 40]);
  });

  it('ακτίνα ⇒ κύκλος γύρω από ΤΟ ΔΙΚΟ ΤΗΣ κέντρο, στη σωστή κλίμακα', () => {
    const shape = coverageShape({ circle: { center: { lat: 40.63, lng: 22.94 }, radiusKm: 10 } });
    expect(shape.kind).toBe('drawn');
    if (shape.kind !== 'drawn') return;
    const extent = multiPolygonExtent(shape.geometry);
    expect(extent).not.toBeNull();
    if (extent === null) return;
    // 10 km ≈ 0,09° πλάτους — κάθε πλευρά του κουτιού απέχει ~0,09° από το κέντρο.
    expect(extent.north - 40.63).toBeCloseTo(0.09, 2);
    expect(40.63 - extent.south).toBeCloseTo(0.09, 2);
  });
});

describe('βοηθοί γεωμετρίας', () => {
  it('δακτύλιος < 3 κορυφών δεν γίνεται σχήμα', () => {
    expect(outlinesToMultiPolygon([TRIANGLE.slice(0, 2)]).coordinates).toEqual([]);
  });

  it('η συγχώνευση κρατά κάθε μέρος', () => {
    const one = outlinesToMultiPolygon([TRIANGLE]);
    expect(mergeMultiPolygons([one, one]).coordinates).toHaveLength(2);
  });

  it('κενό σχήμα ⇒ κανένα κάδρο (ποτέ [0,0])', () => {
    expect(multiPolygonExtent({ type: 'MultiPolygon', coordinates: [] })).toBeNull();
  });

  it('το κάδρο της επιλογής περιλαμβάνει ΚΑΙ τις πινέζες (κατάστημα αλλού από την περιοχή)', () => {
    const extent = multiPolygonExtent(outlinesToMultiPolygon([TRIANGLE]), [{ lat: 42, lng: 21 }]);
    expect(extent).toEqual({ south: 40, west: 21, north: 42, east: 23 });
  });

  it('το κάδρο περικλείει τις κορυφές', () => {
    expect(multiPolygonExtent(outlinesToMultiPolygon([TRIANGLE]))).toEqual({ south: 40, west: 22, north: 41, east: 23 });
  });
});
