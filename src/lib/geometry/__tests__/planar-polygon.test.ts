/**
 * ADR-884 Φ2στ-γ Γ3 — ο επίπεδος πυρήνας (εμβαδόν · σημείο-μέσα · αυτοτομή · απόσταση από τμήμα), ΕΝΑ σπίτι για
 * dxf-viewer (επανεξαγωγή) και περιήγηση. Η ταυτότητα της επανεξαγωγής ελέγχεται ΜΕΣΑ στο subapp
 * (`dxf-viewer/bim/geometry/shared/__tests__/planar-polygon-reexport.test.ts`) — lib → subapp απαγορεύεται (CHECK 3.62).
 */

import {
  distanceToSegment, intersectLines, isPolygonSelfIntersecting, pointInPolygon, polygonArea, segmentsIntersect, shoelaceArea,
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

/**
 * ADR-920 §14.11 (Α) — εμβαδόν σε ΕΓΣΑ'87 canonical mm (x ~4·10⁸, y ~4,5·10⁹). Τα γινόμενα του shoelace φτάνουν ~10¹⁸,
 * όπου το float64 κρατά ανάλυση ~256 mm²: ΜΕΤΡΗΜΕΝΟ πριν από τη διόρθωση, 100 m² ⇒ 99.999.744 mm² και κολόνα 30×30 cm ⇒
 * 89.856 mm² (−0,16%). Ακέραια mm, άρα η απάντηση είναι ΑΚΡΙΒΗΣ — `toBe`, όχι ανοχή.
 */
describe('εμβαδόν μακριά από την αρχή των αξόνων (ΕΓΣΑ mm)', () => {
  const X0 = 412_345_679;
  const Y0 = 4_498_765_432;
  const rect = (w: number, h: number) => [
    { x: X0, y: Y0 }, { x: X0 + w, y: Y0 }, { x: X0 + w, y: Y0 + h }, { x: X0, y: Y0 + h },
  ];

  it('ορθογώνια: ακριβές εμβαδόν, ίδιο με το ίδιο σχήμα στην αρχή των αξόνων', () => {
    expect(polygonArea(rect(10_000, 10_000))).toBe(100_000_000);
    expect(polygonArea(rect(300, 300))).toBe(90_000);
    expect(polygonArea(rect(12_340, 5_670))).toBe(12_340 * 5_670);
  });

  it('το πρόσημο της φοράς μένει ίδιο', () => {
    expect(shoelaceArea(rect(300, 300))).toBe(90_000);
    expect(shoelaceArea([...rect(300, 300)].reverse())).toBe(-90_000);
  });

  it('πολύγωνο πολλών κορυφών: η μετατόπιση δεν αλλάζει το εμβαδόν (2000 κορυφές, r = 50 m)', () => {
    const local = Array.from({ length: 2000 }, (_, i) => {
      const t = (i / 2000) * 2 * Math.PI;
      return { x: Math.round(50_000 * Math.cos(t)), y: Math.round(50_000 * Math.sin(t)) };
    });
    const world = local.map((p) => ({ x: p.x + X0, y: p.y + Y0 }));
    expect(Math.abs(polygonArea(world) - polygonArea(local))).toBeLessThan(1);
  });
});

describe('intersectLines — τομή ΕΥΘΕΙΩΝ (όχι τμημάτων)', () => {
  it('κάθετες · τομή ΕΞΩ από τα δοσμένα σημεία (ευθείες, όχι τμήματα) · παράλληλες ⇒ null', () => {
    expect(intersectLines({ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 3, y: 5 }, { x: 0, y: -1 })).toEqual({ x: 3, y: 1 });
    expect(intersectLines({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 10, y: 0 }, { x: -1, y: 1 })).toEqual({ x: 5, y: 5 });
    expect(intersectLines({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 2 }, { x: -3, y: 0 })).toBeNull();
  });
});
