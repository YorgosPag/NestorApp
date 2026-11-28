/**
 * ADR-920 §14.12 Β2 — το πλαίσιο του στιγμιοτύπου πάνω στη γη.
 *
 * Άγκυρα: αποτύπωση 40 × 40 m γύρω από γνωστό σημείο του καννάβου, περασμένη από τον ΑΛΗΘΙΝΟ builder (η γεωαναφορά είναι
 * αυτή της φάσης Α, με τη στρογγύλευσή της). Η προσδοκία κάθε σημείου είναι «κέντρο καννάβου + (x, y)» — αριθμητική πάνω
 * στα δεδομένα της αποτύπωσης — και ο έλεγχος γυρίζει από το WGS84 στον κάνναβο με τα δύο σκαλιά ΧΩΡΙΣΤΑ
 * (`wgs84ToGgrs87` → `geographicToGrid`), όχι με τη σύνθεση που χρησιμοποιεί ο κώδικας.
 */

import { geographicToGrid } from '@/lib/geo/egsa87-projection';
import { distanceMeters } from '@/lib/geo/geo-distance';
import { fromLocalMetres } from '@/lib/geo/geo-local-frame';
import { wgs84ToGgrs87 } from '@/lib/geo/ggrs87-datum';
import { buildListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-snapshot';
import type { ListingTerrainGeoreference } from '@/lib/terrain/publication/listing-terrain-types';
import type { TopoPoint } from '@/lib/terrain/terrain-types';
import type { GeoPoint } from '@/types/geo/coordinates';

import { terrainMapPlacementOf } from '../terrain-map-placement';

const HALF_M = 20;
const DEG = Math.PI / 180;

interface Site {
  readonly name: string;
  readonly eastingM: number;
  readonly northingM: number;
}

/** Αττική (δυτικά του κεντρικού μεσημβρινού, σύγκλιση αρνητική) · Ρόδος (4° ανατολικά, σύγκλιση ~ +2,5°). */
const ATTICA: Site = { name: 'Αττική', eastingM: 476_000, northingM: 4_202_000 };
const RHODES: Site = { name: 'Ρόδος', eastingM: 876_000, northingM: 4_036_000 };

function georeferenceAt(site: Site): ListingTerrainGeoreference {
  const e = site.eastingM * 1000;
  const n = site.northingM * 1000;
  const h = HALF_M * 1000;
  const points: TopoPoint[] = [
    { x: e - h, y: n - h, z: 100_000 }, { x: e + h, y: n - h, z: 101_000 },
    { x: e + h, y: n + h, z: 102_000 }, { x: e - h, y: n + h, z: 101_000 }, { x: e, y: n, z: 101_000 },
  ];
  const built = buildListingTerrainSnapshot({
    points, boundaryWorldMm: null, envelope: null, georeference: { coordinateSystem: 'EPSG:2100' },
  });
  if (!built.ok || built.snapshot.georeference === null) throw new Error('fixture: expected a georeferenced snapshot');
  return built.snapshot.georeference;
}

/** WGS84 → κάνναβος, με τα δύο σκαλιά χωριστά. */
function gridOf(point: GeoPoint): { E: number; N: number } {
  const local = wgs84ToGgrs87(point.lat, point.lng);
  return geographicToGrid(local.lat, local.lon);
}

/** Αζιμούθιο του β ως προς το α, μοίρες ανατολικά του αληθινού βορρά (μικρή απόσταση). */
function bearingDeg(a: GeoPoint, b: GeoPoint): number {
  return Math.atan2((b.lng - a.lng) * Math.cos(a.lat * DEG), b.lat - a.lat) / DEG;
}

describe.each([ATTICA, RHODES])('terrainMapPlacementOf — $name', (site) => {
  const georeference = georeferenceAt(site);
  const placement = terrainMapPlacementOf(georeference);
  const corners: ReadonlyArray<readonly [number, number]> = [[0, 0], [HALF_M, HALF_M], [-HALF_M, HALF_M], [HALF_M, -HALF_M], [-150, 320]];

  it('κάθε σημείο του πλαισίου πέφτει στο «κέντρο καννάβου + (x, y)» μέσα σε 2 cm (η στρογγύλευση της φάσης Α)', () => {
    for (const [x, y] of corners) {
      const grid = gridOf(placement.toGeo(x, y));
      expect(Math.hypot(grid.E - (site.eastingM + x), grid.N - (site.northingM + y))).toBeLessThan(0.02);
    }
  });

  it('το σχήμα δεν παραμορφώνεται: η απόσταση δύο σημείων στον κάνναβο είναι η απόστασή τους στο πλαίσιο, στα λίγα χιλιοστά', () => {
    const a = gridOf(placement.toGeo(-150, 320));
    const b = gridOf(placement.toGeo(HALF_M, -HALF_M));
    expect(Math.hypot(a.E - b.E, a.N - b.N)).toBeCloseTo(Math.hypot(-150 - HALF_M, 320 + HALF_M), 2);
  });

  it('το toFrame αντιστρέφει το toGeo στα λίγα χιλιοστά', () => {
    for (const [x, y] of corners) {
      const back = placement.toFrame(placement.toGeo(x, y));
      expect(Math.hypot(back.x - x, back.y - y)).toBeLessThan(0.005);
    }
  });

  it('ο άξονας +y του πλαισίου δείχνει εκεί που λέει η δημοσιευμένη σύγκλιση μεσημβρινού', () => {
    const bearing = bearingDeg(placement.toGeo(0, 0), placement.toGeo(0, 200));
    expect(Math.abs(bearing - georeference.gridConvergenceDeg)).toBeLessThan(0.03);
  });

  it('κουβαλά το κέντρο και τη σύγκλιση όπως δημοσιεύτηκαν', () => {
    expect(placement.centre).toEqual(georeference.centre);
    expect(placement.gridConvergenceDeg).toBe(georeference.gridConvergenceDeg);
    expect(distanceMeters(placement.toGeo(0, 0), georeference.centre)).toBeLessThan(0.005);
  });
});

describe('γιατί ΟΧΙ εφαπτόμενο επίπεδο σφαίρας', () => {
  it('στα 100 m από το κέντρο η σφαιρική τοπική προβολή απέχει δεκατόμετρα από την ακριβή θέση', () => {
    const georeference = georeferenceAt(ATTICA);
    const exact = terrainMapPlacementOf(georeference).toGeo(0, 100);
    // Η σφαιρική διαδρομή, με τη στροφή πλέγματος εφαρμοσμένη — ό,τι θα έκανε «κέντρο + στροφή + τοπικά μέτρα».
    const gamma = georeference.gridConvergenceDeg * DEG;
    const spherical = fromLocalMetres({ x: 100 * Math.sin(gamma), y: 100 * Math.cos(gamma) }, georeference.centre);
    const gap = distanceMeters(exact, spherical);
    expect(gap).toBeGreaterThan(0.1);
    expect(gap).toBeLessThan(0.5);
  });
});
