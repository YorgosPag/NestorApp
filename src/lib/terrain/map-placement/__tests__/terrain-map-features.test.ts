/**
 * ADR-920 §14.12 Β2 — το δημοσιευμένο ανάγλυφο ως στοιχεία χάρτη, πάνω σε ΑΛΗΘΙΝΟ στιγμιότυπο (`buildListingTerrainSnapshot`).
 *
 *   `HILL`: αποτύπωση 20 × 20 m (σημεία ανά 1 m) στην Αττική, λόφος z = 124 − 0,02·r² γύρω από το κέντρο του πλαισίου.
 *   Στα μέσα των πλευρών z = 122, στις γωνίες z = 120 ⇒ οι χαμηλές ζώνες είναι ΝΗΣΙΑ στις γωνίες, οι ψηλές ΔΑΧΤΥΛΙΔΙΑ με
 *   τρύπα, η κορυφή δίσκος — και τα τρία σχήματα που ο χάρτης δεν ζωγραφίζει σωστά χωρίς ιεραρχία δακτυλίων.
 *
 * Η άγκυρα των ζωνών δεν ρωτά τη συνάρτηση που ελέγχει: ρωτά τον ΤΥΠΟ του λόφου σε δείγματα του πλαισίου.
 */

import { geographicToGrid } from '@/lib/geo/egsa87-projection';
import { wgs84ToGgrs87 } from '@/lib/geo/ggrs87-datum';
import { pointInPolygon } from '@/lib/geometry/planar-polygon';
import { buildListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-snapshot';
import type { ListingTerrainInput, ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';
import { terrainMapModelOf } from '@/lib/terrain/publication/terrain-map-model';
import type { TopoPoint } from '@/lib/terrain/terrain-types';

import { terrainMapFeaturesOf, type TerrainMapFeatures } from '../terrain-map-features';

const E0_M = 476_000;
const N0_M = 4_202_000;
const SIDE_M = 20;
/** Κέντρο του πλαισίου στον κάνναβο (το κέντρο των ορίων της αποτύπωσης). */
const CENTRE = { E: E0_M + SIDE_M / 2, N: N0_M + SIDE_M / 2 };
const hillM = (x: number, y: number): number => 124 - 0.02 * (x * x + y * y);

function hillInput(extra: Partial<ListingTerrainInput>): ListingTerrainInput {
  const points: TopoPoint[] = [];
  for (let i = 0; i <= SIDE_M; i++) {
    for (let j = 0; j <= SIDE_M; j++) {
      const z = hillM(i - SIDE_M / 2, j - SIDE_M / 2);
      points.push({ x: (E0_M + i) * 1000, y: (N0_M + j) * 1000, z: Math.round(z * 1000) });
    }
  }
  return { points, boundaryWorldMm: null, envelope: null, ...extra };
}

function snapshotOf(extra: Partial<ListingTerrainInput>): ListingTerrainSnapshot {
  const built = buildListingTerrainSnapshot(hillInput(extra));
  if (!built.ok) throw new Error(`expected a snapshot, got ${built.reason}`);
  return built.snapshot;
}

const OUTLINE_HALF_MM = 8_000;
const OUTLINE = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => ({
  x: CENTRE.E * 1000 + sx * OUTLINE_HALF_MM,
  y: CENTRE.N * 1000 + sy * OUTLINE_HALF_MM,
}));

const HILL = snapshotOf({ georeference: { coordinateSystem: 'EPSG:2100' }, plotOutlineWorldMm: OUTLINE });

function featuresOf(snapshot: ListingTerrainSnapshot): TerrainMapFeatures {
  const features = terrainMapFeaturesOf(snapshot);
  if (features === null) throw new Error('expected map features');
  return features;
}

const FEATURES = featuresOf(HILL);

/** Θέση GeoJSON → μέτρα από το κέντρο του πλαισίου, με τα δύο σκαλιά της προβολής χωριστά. */
function frameOf([lng, lat]: GeoJSON.Position): { x: number; y: number } {
  const local = wgs84ToGgrs87(lat, lng);
  const grid = geographicToGrid(local.lat, local.lon);
  return { x: grid.E - CENTRE.E, y: grid.N - CENTRE.N };
}

/** Γεμίζει το στοιχείο το σημείο του πλαισίου; — ο ορισμός του MultiPolygon: μέσα σε εξωτερικό, έξω από τις τρύπες του. */
function fills(feature: GeoJSON.Feature<GeoJSON.MultiPolygon>, x: number, y: number): boolean {
  const at = FEATURES.placement.toGeo(x, y);
  const inside = (ring: GeoJSON.Position[]) => pointInPolygon({ x: at.lng, y: at.lat }, ring.map(([px, py]) => ({ x: px, y: py })));
  return feature.geometry.coordinates.some(([outer, ...holes]) => inside(outer) && !holes.some(inside));
}

describe('terrainMapFeaturesOf — θέση', () => {
  it('χωρίς γεωαναφορά δεν τοποθετείται τίποτα (Β-6)', () => {
    expect(terrainMapFeaturesOf(snapshotOf({}))).toBeNull();
    expect(terrainMapFeaturesOf(snapshotOf({ georeference: { coordinateSystem: 'local' } }))).toBeNull();
  });

  it('οι θέσεις γράφονται [lng, lat] και πέφτουν στην Αττική', () => {
    const [lng, lat] = FEATURES.extent.geometry.coordinates[0][0][0];
    expect(lng).toBeGreaterThan(23);
    expect(lng).toBeLessThan(24);
    expect(lat).toBeGreaterThan(37.5);
    expect(lat).toBeLessThan(38.5);
  });

  it('η έκταση είναι ΕΝΑ πολύγωνο χωρίς τρύπες, κλειστό, και πιάνει τα όρια της αποτύπωσης μέσα σε 2 cm', () => {
    const { coordinates } = FEATURES.extent.geometry;
    expect(coordinates).toHaveLength(1);
    expect(coordinates[0]).toHaveLength(1);
    const ring = coordinates[0][0];
    expect(ring[ring.length - 1]).toEqual(ring[0]);
    const frame = ring.map(frameOf);
    for (const pick of [Math.min, Math.max]) {
      expect(Math.abs(Math.abs(pick(...frame.map((p) => p.x))) - SIDE_M / 2)).toBeLessThan(0.02);
      expect(Math.abs(Math.abs(pick(...frame.map((p) => p.y))) - SIDE_M / 2)).toBeLessThan(0.02);
    }
  });
});

describe('terrainMapFeaturesOf — ισοϋψείς', () => {
  it('μία γραμμή ανά δημοσιευμένη ισοϋψή, με το επίπεδο και την τάξη της', () => {
    const { features } = FEATURES.contours;
    expect(features.map((f) => f.properties)).toEqual(HILL.contours.map(({ levelM, major }) => ({ levelM, major })));
  });

  it('κλειστή ισοϋψής ⇒ η γραμμή κλείνει· κάθε κορυφή της βρίσκεται στο ύψος που δηλώνει', () => {
    HILL.contours.forEach((contour, i) => {
      const line = FEATURES.contours.features[i].geometry.coordinates;
      expect(line).toHaveLength(contour.points.length / 2 + (contour.closed ? 1 : 0));
      if (contour.closed) expect(line[line.length - 1]).toEqual(line[0]);
      for (const position of line) {
        const { x, y } = frameOf(position);
        // Το πλέγμα είναι γραμμικό ανά τρίγωνο 1 m: απέχει από τον τύπο του λόφου το πολύ ~1 cm.
        expect(Math.abs(hillM(x, y) - contour.levelM)).toBeLessThan(0.05);
      }
    });
  });
});

describe('terrainMapFeaturesOf — ζώνες υψομέτρου', () => {
  const bands = FEATURES.elevationBands.features;

  it('είναι ΟΙ ζώνες της κάτοψης: ίδια όρια, ίδιο χρώμα, ίδιο μερίδιο — ένα υπόμνημα για δύο επιφάνειες', () => {
    const sheet = terrainMapModelOf(HILL).elevationBands.map(({ pathData: _pathData, ...legend }) => legend);
    expect(bands.map((f) => f.properties)).toEqual(sheet);
  });

  it('κάθε σημείο του εδάφους γεμίζει από ΜΙΑ ζώνη — εκείνη που περιέχει το ύψος του (νησιά, δαχτυλίδια, δίσκος)', () => {
    let judged = 0;
    for (let x = -9.73; x < 10; x += 1.37) {
      for (let y = -9.61; y < 10; y += 1.43) {
        const z = hillM(x, y);
        // Δείγματα κολλητά σε όριο ζώνης δεν κρίνονται: εκεί ο τύπος και το πλέγμα διαφέρουν νόμιμα κατά ~1 cm.
        if (bands.some((f) => Math.abs(z - f.properties.fromM) < 0.05 || Math.abs(z - f.properties.toM) < 0.05)) continue;
        const filled = bands.filter((f) => fills(f, x, y));
        expect(filled).toHaveLength(1);
        expect(z).toBeGreaterThan(filled[0].properties.fromM);
        expect(z).toBeLessThan(filled[0].properties.toM);
        judged++;
      }
    }
    expect(judged).toBeGreaterThan(100);
  });

  it('το δαχτυλίδι γύρω από την κορυφή έχει ΤΡΥΠΑ — δεν σκεπάζει τη ζώνη που περικλείει', () => {
    expect(bands.some((f) => f.geometry.coordinates.some((polygon) => polygon.length > 1))).toBe(true);
    const top = bands[bands.length - 1];
    expect(top.geometry.coordinates).toHaveLength(1);
    expect(top.geometry.coordinates[0]).toHaveLength(1);
  });
});

describe('terrainMapFeaturesOf — κλίσεις, όριο, περίγραμμα', () => {
  it('οι κλάσεις κλίσης με έδαφος καλύπτουν όλο το εμβαδόν, από την πιο επίπεδη', () => {
    const classes = FEATURES.slopeClasses.features;
    expect(classes.length).toBeGreaterThan(0);
    expect(classes.reduce((sum, f) => sum + f.properties.areaShare, 0)).toBeCloseTo(1, 9);
    const indices = classes.map((f) => f.properties.classIndex);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(classes.every((f) => f.geometry.coordinates.length > 0)).toBe(true);
    expect(fills(classes[0], 0.13, 0.17)).toBe(true);
  });

  it('χωρίς αποκοπή δεν υπάρχει όριο οικοπέδου· το περίγραμμα κουβαλά τους αριθμούς του στιγμιοτύπου', () => {
    expect(FEATURES.boundary).toBeNull();
    const outline = FEATURES.plotOutline;
    if (outline === null || HILL.plotOutline === null) throw new Error('expected a plot outline');
    const { ring: _ring, ...numbers } = HILL.plotOutline;
    expect(outline.properties).toEqual(numbers);
    const frame = outline.geometry.coordinates[0][0].map(frameOf);
    expect(frame).toHaveLength(5);
    for (const p of frame) {
      expect(Math.abs(Math.abs(p.x) - OUTLINE_HALF_MM / 1000)).toBeLessThan(0.02);
      expect(Math.abs(Math.abs(p.y) - OUTLINE_HALF_MM / 1000)).toBeLessThan(0.02);
    }
  });

  it('χωρίς περίγραμμα στο στιγμιότυπο δεν ζωγραφίζεται περίγραμμα', () => {
    expect(featuresOf(snapshotOf({ georeference: { coordinateSystem: 'EPSG:2100' } })).plotOutline).toBeNull();
  });
});
