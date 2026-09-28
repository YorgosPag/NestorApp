/**
 * @jest-environment node
 *
 * ADR-889 Φ5 — από σχήμα καννάβου σε GeoJSON του χάρτη: τρύπες από τη φορά, εσωτερικό σημείο σε κοίλη ζώνη,
 * φορά RFC 7946 μετά την προβολή.
 */

import type { ShapeCoordinate } from '../shapefile';
import { gridInteriorPoint, groupGridPolygons, toGeoMultiLine, toGeoMultiPolygon } from '../zone-geometry';
import { clockwiseSquare } from './shapefile-fixtures';

/** Αριστερόστροφο τετράγωνο (ESRI: τρύπα). */
function counterClockwiseSquare(x: number, y: number, size: number): ShapeCoordinate[] {
  return [...clockwiseSquare(x, y, size)].reverse();
}

/** Διπλάσιο προσημασμένο εμβαδόν σε [lng, lat] — θετικό = αριστερόστροφο. */
function signedArea(ring: readonly GeoJSON.Position[]): number {
  let sum = 0;
  for (let i = 0; i + 1 < ring.length; i += 1) sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return sum;
}

const E = 476_000;
const N = 4_205_000;

describe('groupGridPolygons', () => {
  it('η τρύπα (αριστερόστροφη) πάει στον εξωτερικό που την περιέχει', () => {
    const polygons = groupGridPolygons([clockwiseSquare(E, N, 100), counterClockwiseSquare(E + 40, N + 40, 20), clockwiseSquare(E + 500, N, 50)]);
    expect(polygons.map((polygon) => polygon.length)).toEqual([2, 1]);
  });
});

describe('gridInteriorPoint', () => {
  it('σε κοίλη ζώνη σχήματος Π πέφτει ΜΕΣΑ (το κεντροειδές θα έπεφτε στο κενό)', () => {
    // Π: δύο πόδια 0–30 και 70–100, ένωση πάνω 70–100.
    const shapeP: ShapeCoordinate[] = [[0, 0], [0, 100], [100, 100], [100, 0], [70, 0], [70, 70], [30, 70], [30, 0], [0, 0]];
    const [x, y] = gridInteriorPoint(groupGridPolygons([shapeP]));
    const inLeftLeg = x > 0 && x < 30;
    const inRightLeg = x > 70 && x < 100;
    expect(y).toBe(50);
    expect(inLeftLeg || inRightLeg).toBe(true);
  });

  it('δεν πέφτει ποτέ μέσα σε τρύπα', () => {
    const [x, y] = gridInteriorPoint(groupGridPolygons([clockwiseSquare(0, 0, 100), counterClockwiseSquare(20, 20, 60)]));
    expect(x > 20 && x < 80 && y > 20 && y < 80).toBe(false);
  });
});

describe('toGeoMultiPolygon', () => {
  it('WGS84, κλειστοί δακτύλιοι, εξωτερικός αριστερόστροφος και τρύπα δεξιόστροφη (RFC 7946)', () => {
    const polygons = groupGridPolygons([clockwiseSquare(E, N, 100), counterClockwiseSquare(E + 40, N + 40, 20)]);
    const geometry = toGeoMultiPolygon(polygons, 2);
    const [outer, hole] = geometry?.coordinates[0] ?? [];
    expect(outer[0]).toEqual(outer[outer.length - 1]);
    expect(signedArea(outer)).toBeGreaterThan(0);
    expect(signedArea(hole)).toBeLessThan(0);
    // Ελλάδα, όχι κάπου αλλού: η προβολή + datum έτρεξαν.
    expect(outer[0][0]).toBeGreaterThan(20);
    expect(outer[0][1]).toBeGreaterThan(35);
  });

  it('ζώνη μικρότερη από την ανοχή ⇒ null (μετριέται από τον καλούντα, δεν χάνεται σιωπηλά)', () => {
    expect(toGeoMultiPolygon(groupGridPolygons([clockwiseSquare(E, N, 1)]), 5)).toBeNull();
  });
});

describe('toGeoMultiLine', () => {
  it('κρατά τις γραμμές, πετά όσες εκφυλίστηκαν σε σημείο', () => {
    const geometry = toGeoMultiLine([[[E, N], [E + 50, N]], [[E, N], [E, N]]]);
    expect(geometry?.coordinates).toHaveLength(1);
  });
});
