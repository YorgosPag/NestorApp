/**
 * ADR-884 Φ2στ-γ Γ3 — ο επίπεδος πυρήνας (εμβαδόν · σημείο-μέσα · αυτοτομή · απόσταση από τμήμα), ΕΝΑ σπίτι για
 * dxf-viewer (επανεξαγωγή) και περιήγηση. Η ταυτότητα της επανεξαγωγής ελέγχεται ΜΕΣΑ στο subapp
 * (`dxf-viewer/bim/geometry/shared/__tests__/planar-polygon-reexport.test.ts`) — lib → subapp απαγορεύεται (CHECK 3.62).
 */

import {
  distanceToSegment, isPolygonSelfIntersecting, pointInPolygon, polygonArea, segmentsIntersect, shoelaceArea,
} from '../planar-polygon';

const SQUARE = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
const BOWTIE = [{ x: 0, y: 0 }, { x: 4, y: 3 }, { x: 4, y: 0 }, { x: 0, y: 3 }];

describe('planar-polygon', () => {
  it('εμβαδόν: πρόσημο κατά τη φορά, απόλυτο πάντα θετικό', () => {
    expect(shoelaceArea(SQUARE)).toBe(12);
    expect(shoelaceArea([...SQUARE].reverse())).toBe(-12);
    expect(polygonArea([...SQUARE].reverse())).toBe(12);
    expect(shoelaceArea(SQUARE.slice(0, 2))).toBe(0);
  });

  it('σημείο μέσα / έξω (even-odd)', () => {
    expect(pointInPolygon({ x: 2, y: 1 }, SQUARE)).toBe(true);
    expect(pointInPolygon({ x: 5, y: 1 }, SQUARE)).toBe(false);
    expect(pointInPolygon({ x: 1, y: 1 }, SQUARE.slice(0, 2))).toBe(false);
  });

  it('αυτοτομή: ο «φιόγκος» ναι, το τετράγωνο όχι', () => {
    expect(isPolygonSelfIntersecting(BOWTIE)).toBe(true);
    expect(isPolygonSelfIntersecting(SQUARE)).toBe(false);
  });

  it('τμήματα: τομή, επαφή άκρου, παράλληλα', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 })).toBe(true);
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 5 })).toBe(true);
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 2, y: 1 })).toBe(false);
  });

  it('απόσταση από ΤΜΗΜΑ (όχι ευθεία) — και εκφυλισμένο τμήμα', () => {
    expect(distanceToSegment({ x: 1, y: 2 }, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(2);
    expect(distanceToSegment({ x: 7, y: 4 }, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(5);
    expect(distanceToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
});
