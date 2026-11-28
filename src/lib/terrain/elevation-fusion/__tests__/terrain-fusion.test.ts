/**
 * ADR-920 §14.12 Β3 — ο ψηφιδωτής υψομέτρων πάνω σε ΑΛΗΘΙΝΟ στιγμιότυπο (`buildListingTerrainSnapshot`).
 *
 *   `SURVEY`: αποτύπωση 20 × 20 m (σημεία ανά 1 m) στην Αττική, ΕΠΙΠΕΔΟ z = 100 + 0,1·x + 0,05·y στο πλαίσιο. Το TIN ενός
 *   επιπέδου είναι το ίδιο το επίπεδο, άρα κάθε προσδοκία ύψους βγαίνει από τον ΤΥΠΟ, όχι από τη συνάρτηση που ελέγχεται.
 *   Το χοντρό είναι επίσης τύπος: γραμμικό στις συντεταγμένες Mercator ⇒ η διγραμμική ανάγνωσή του είναι ακριβής, και
 *   πάνω από σύνορα πλακιδίων.
 *
 * Το μέγεθος πλακιδίου είναι παράμετρος του πυρήνα: εδώ 8 και 16 pixels, ώστε ένα πλακίδιο z20 και τα τέσσερα παιδιά
 * του στο z21 να έχουν ΤΑ ΙΔΙΑ κέντρα pixels — η άγκυρα του «καθαρή συνάρτηση του σημείου».
 */

import { nestRings } from '@/lib/geometry/ring-nesting';
import { pointInPolygon, shoelaceArea, type PlanarPoint } from '@/lib/geometry/planar-polygon';
import type { ArchiveTileAddress } from '@/lib/geo/osm/osm-archive-tile';
import { readTerrarium } from '@/lib/maps/elevation-terrarium';
import { MAPLIBRE_TILE_SIZE_PX, worldPixelToLngLat } from '@/lib/maps/metric-size';
import { terrainMapFeaturesOf } from '@/lib/terrain/map-placement/terrain-map-features';
import { LISTING_TERRAIN_FUSION_PROJECTION_TOLERANCE_M } from '@/lib/terrain/publication/listing-terrain-config';
import { buildListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-snapshot';
import type { ListingTerrainInput, ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';
import type { TopoPoint } from '@/lib/terrain/terrain-types';

import { coarseFieldOf, coarseNeighbourhoodOf, coarsePrimaryFor, type CoarseElevationField } from '../coarse-elevation-field';
import { createFusedElevationSink, fusedElevationAt, fuseElevationInto, fusionPointOf } from '../terrain-fused-elevation';
import {
  createGroundVerdictSink,
  groundVerdictAt,
  groundVerdictInto,
  terrainFusionSurfaceOf,
  terrainFusionTransitionM,
  type TerrainFusionSurface,
} from '../terrain-fusion-surface';
import { composeFusedElevationTile, type FusedElevationTile } from '../terrain-fusion-tile';
import { transitionZoneOf } from '../terrain-fusion-transition';

const E0_M = 476_000;
const N0_M = 4_202_000;
const HALF_M = 10;
const WIDTH_M = 30;
const planeM = (x: number, y: number): number => 100 + 0.1 * x + 0.05 * y;

/** Σημεία ανά 1 m στο τετράγωνο ±10 m γύρω από το κέντρο, πάνω στο επίπεδο· `extra` = πρόσθετα σημεία στο πλαίσιο. */
function surveyInput(extra: readonly (readonly [number, number, number])[] = []): ListingTerrainInput {
  const points: TopoPoint[] = [];
  const add = (x: number, y: number, z: number): void => {
    points.push({ x: (E0_M + HALF_M + x) * 1000, y: (N0_M + HALF_M + y) * 1000, z: Math.round(z * 1000) });
  };
  for (let x = -HALF_M; x <= HALF_M; x++) for (let y = -HALF_M; y <= HALF_M; y++) add(x, y, planeM(x, y));
  extra.forEach(([x, y, z]) => add(x, y, z));
  return { points, boundaryWorldMm: null, envelope: null, georeference: { coordinateSystem: 'EPSG:2100' } };
}

function snapshotOf(input: ListingTerrainInput): ListingTerrainSnapshot {
  const built = buildListingTerrainSnapshot(input);
  if (!built.ok) throw new Error(`expected a snapshot, got ${built.reason}`);
  return built.snapshot;
}

function surfaceOf(snapshot: ListingTerrainSnapshot, widthM: number): TerrainFusionSurface {
  const surface = terrainFusionSurfaceOf(snapshot, widthM);
  if (surface === null) throw new Error('expected a fusion surface');
  return surface;
}

const SURVEY = snapshotOf(surveyInput());
const SURFACE = surfaceOf(SURVEY, WIDTH_M);
const CENTRE = fusionPointOf(SURFACE.placement.centre);

// ── το χοντρό ως τύπος ─────────────────────────────────────────────────────

const COARSE_ZOOM = 12;
const COARSE_PX = 8;
/** Γραμμικό σε (u, v): ~3,8 m ανά 30 m προς τα ανατολικά στο πλάτος της Αττικής. */
const coarseModelM = (u: number, v: number): number => 300 + 4e6 * (u - CENTRE.u) - 2.5e6 * (v - CENTRE.v);

function coarseTileOf(address: ArchiveTileAddress): Float32Array {
  const n = 2 ** address.z;
  return Float32Array.from({ length: COARSE_PX * COARSE_PX }, (_, i) => {
    const column = i % COARSE_PX;
    const row = Math.floor(i / COARSE_PX);
    return coarseModelM((address.x + (column + 0.5) / COARSE_PX) / n, (address.y + (row + 0.5) / COARSE_PX) / n);
  });
}

/** Το πεδίο γύρω από το χοντρό πλακίδιο που κρατά το `tile`, με όλους τους γείτονες. */
function coarseAround(tile: ArchiveTileAddress): CoarseElevationField {
  const primary = coarsePrimaryFor(tile, COARSE_ZOOM);
  const tiles = coarseNeighbourhoodOf(primary).map((address) => ({ address, heights: coarseTileOf(address) }));
  return coarseFieldOf(primary, COARSE_PX, tiles);
}

function tileAt(z: number): ArchiveTileAddress {
  return { z, x: Math.floor(CENTRE.u * 2 ** z), y: Math.floor(CENTRE.v * 2 ** z) };
}

const COARSE = coarseAround(tileAt(COARSE_ZOOM));
const geo = (x: number, y: number) => SURFACE.placement.toGeo(x, y);
/**
 * Εκεί όπου ΠΡΑΓΜΑΤΙΚΑ πέφτει στο πλαίσιο το σημείο της γης `geo(x, y)`: ο δρόμος πλαίσιο → γη → πλαίσιο κρατά λίγα
 * χιλιοστά (Β2: < 5 mm), και πάνω σε κλίση αυτά είναι δέκατα του χιλιοστού σε ύψος. Οι προσδοκίες ύψους ενός σημείου της
 * ΓΗΣ βγαίνουν από τον τύπο ΣΕ ΑΥΤΟ το σημείο — ο ψηφιδωτής κρίνεται για το ύψος, όχι για την αντιστροφή της προβολής.
 */
const landed = (x: number, y: number) => SURFACE.placement.toFrame(geo(x, y));
/** Το χοντρό στο σημείο (x, y) του πλαισίου, από τον ΤΥΠΟ. */
const coarseAtFrameM = (x: number, y: number): number => {
  const { u, v } = fusionPointOf(geo(x, y));
  return coarseModelM(u, v);
};

// ── ανάγνωση pixels ───────────────────────────────────────────────────────

function heightOfPixel(tile: FusedElevationTile, sizePx: number, row: number, column: number): number {
  const at = (row * sizePx + column) * 4;
  return readTerrarium(tile.rgba[at], tile.rgba[at + 1], tile.rgba[at + 2]);
}

/** Το κέντρο του pixel πάνω στη γη — με το Mercator του χάρτη, ανεξάρτητα από τον ψηφιδωτή. */
function centreOfPixel(tile: ArchiveTileAddress, sizePx: number, row: number, column: number) {
  const n = 2 ** tile.z;
  const [lng, lat] = worldPixelToLngLat(
    ((tile.x + (column + 0.5) / sizePx) / n) * MAPLIBRE_TILE_SIZE_PX,
    ((tile.y + (row + 0.5) / sizePx) / n) * MAPLIBRE_TILE_SIZE_PX,
    0,
  );
  return { lat, lng };
}

/** Το μισό βήμα της κωδικοποίησης Terrarium, με ανοχή αριθμητικής. */
const TERRARIUM_HALF_STEP_M = 1 / 512 + 1e-9;

/**
 * Πόσο μπορούν να διαφέρουν σε ύψος οι δύο δρόμοι προβολής (Β3.1) ΣΕ ΑΥΤΗ τη σκηνή: κλίση της σύντηξης × σφάλμα θέσης.
 * Η πιο απότομη κλίση εδώ είναι στη ζώνη, όπου το χοντρό του τύπου (~300 m) απέχει ~200 m από την ακμή (~100 m) και η
 * έλξη αλλάζει το πολύ 1,5 / πλάτος ανά μέτρο ⇒ 200 · 1,5 / 30 = 10 m/m. Το πλέγμα γίνεται δεκτό στο μισό της ανοχής του
 * (5 µm) ⇒ 50 µm· το όριο αφήνει διπλάσιο περιθώριο. Σε αληθινό έδαφος η διαφορά χοντρού–μέτρησης είναι λίγα μέτρα.
 */
const ROADS_APART_M = 1e-4;

describe('groundVerdictAt — τι λέει η αποτύπωση για ένα σημείο του πλαισίου', () => {
  it('μέσα στο μετρημένο: το ύψος της επιφάνειας, αμετάβλητο (Β-3)', () => {
    for (const [x, y] of [[0, 0], [2.3, -7.1], [-9.9, 9.9], [10, 0]]) {
      const verdict = groundVerdictAt(SURFACE, x, y);
      expect(verdict.kind).toBe('measured');
      if (verdict.kind === 'measured') expect(verdict.elevationM).toBeCloseTo(planeM(x, y), 6);
    }
  });

  it('στη ζώνη: το ύψος του πλησιέστερου σημείου της ακμής, και έλξη 3t² − 2t³ της απόστασης', () => {
    const verdict = groundVerdictAt(SURFACE, HALF_M + 15, 3.4);
    expect(verdict.kind).toBe('transition');
    if (verdict.kind !== 'transition') return;
    expect(verdict.distanceM).toBeCloseTo(15, 9);
    expect(verdict.edgeElevationM).toBeCloseTo(planeM(HALF_M, 3.4), 6);
    expect(verdict.weight).toBeCloseTo(0.5, 9);
    const quarter = groundVerdictAt(SURFACE, 0, -HALF_M - 7.5);
    if (quarter.kind !== 'transition') throw new Error('expected the transition zone');
    // t = 0,75 ⇒ 3·0,75² − 2·0,75³ = 0,84375
    expect(quarter.weight).toBeCloseTo(0.84375, 9);
  });

  it('απέναντι από γωνία: η απόσταση είναι από την κορυφή και το ύψος είναι το δικό της', () => {
    const verdict = groundVerdictAt(SURFACE, HALF_M + 3, HALF_M + 4);
    if (verdict.kind !== 'transition') throw new Error('expected the transition zone');
    expect(verdict.distanceM).toBeCloseTo(5, 9);
    expect(verdict.edgeElevationM).toBeCloseTo(planeM(HALF_M, HALF_M), 6);
  });

  it('η ζώνη συναντά το μετρημένο χωρίς σκαλοπάτι και σβήνει στο πλάτος της', () => {
    const touching = groundVerdictAt(SURFACE, HALF_M + 1e-6, 0);
    if (touching.kind !== 'transition') throw new Error('expected the transition zone');
    expect(touching.weight).toBeCloseTo(1, 9);
    const fading = groundVerdictAt(SURFACE, HALF_M + WIDTH_M - 1e-3, 0);
    if (fading.kind !== 'transition') throw new Error('expected the transition zone');
    expect(fading.weight).toBeLessThan(1e-8);
    expect(groundVerdictAt(SURFACE, HALF_M + WIDTH_M + 1e-3, 0).kind).toBe('outside');
  });

  it('πλάτος 0 ⇒ καμία ζώνη· αρνητικό ή μη αριθμός μετρά ως 0', () => {
    expect(groundVerdictAt(surfaceOf(SURVEY, 0), HALF_M + 0.5, 0).kind).toBe('outside');
    expect(terrainFusionSurfaceOf(SURVEY, -5)).toBe(terrainFusionSurfaceOf(SURVEY, 0));
    expect(terrainFusionSurfaceOf(SURVEY, Number.NaN)).toBe(terrainFusionSurfaceOf(SURVEY, 0));
  });

  it('χτίζεται μία φορά ανά στιγμιότυπο και πλάτος· χωρίς γεωαναφορά δεν υπάρχει (Β-6)', () => {
    expect(terrainFusionSurfaceOf(SURVEY, WIDTH_M)).toBe(SURFACE);
    const { georeference: _georeference, ...withoutPosition } = surveyInput();
    expect(terrainFusionSurfaceOf(snapshotOf(withoutPosition), WIDTH_M)).toBeNull();
  });

  it('το πλάτος βγαίνει από το δείγμα εδάφους του χοντρού (ένα κελί του GLO-30 = 30 m)', () => {
    expect(terrainFusionTransitionM(30)).toBe(30);
  });
});

describe('fusedElevationAt — το ύψος και η προέλευσή του', () => {
  it('μετρημένο: η αποτύπωση, ό,τι κι αν λέει το χοντρό', () => {
    const at = landed(2, 3);
    const expected = { elevationM: expect.closeTo(planeM(at.x, at.y), 6), provenance: 'measured', cause: null };
    expect(fusedElevationAt(SURFACE, COARSE, geo(2, 3))).toEqual(expected);
    expect(fusedElevationAt(SURFACE, null, geo(2, 3))).toEqual(expected);
  });

  it('ζώνη μετάβασης: το χοντρό έλκεται προς το ύψος της ακμής — παρεμβολή, με την αιτία της', () => {
    const coarseM = coarseAtFrameM(HALF_M + 15, 0);
    const fused = fusedElevationAt(SURFACE, COARSE, geo(HALF_M + 15, 0));
    expect(fused.provenance).toBe('interpolated');
    expect(fused.cause).toBe('transition');
    // Στο σημείο όπου πέφτει: απόσταση από την ανατολική ακμή, t = 1 − απόσταση / πλάτος, έλξη 3t² − 2t³ (≈ 0,5).
    const at = landed(HALF_M + 15, 0);
    const t = 1 - (at.x - HALF_M) / WIDTH_M;
    const pull = 3 * t * t - 2 * t * t * t;
    expect(pull).toBeCloseTo(0.5, 3);
    expect(fused.elevationM).toBeCloseTo(coarseM + pull * (planeM(HALF_M, at.y) - coarseM), 3);
  });

  it('πέρα από τη ζώνη: το χοντρό, ενδεικτικό', () => {
    const fused = fusedElevationAt(SURFACE, COARSE, geo(80, -60));
    expect(fused).toEqual({ elevationM: expect.closeTo(coarseAtFrameM(80, -60), 2), provenance: 'indicative', cause: null });
  });

  it('χωρίς χοντρό: 0 m ως υποκατάστατο, και η προέλευση το λέει — ποτέ «ενδεικτικό 0 m»', () => {
    expect(fusedElevationAt(SURFACE, null, geo(80, -60))).toEqual({ elevationM: 0, provenance: 'none', cause: null });
    expect(fusedElevationAt(null, null, geo(0, 0))).toEqual({ elevationM: 0, provenance: 'none', cause: null });
  });

  it('χωρίς αποτύπωση: το χοντρό παντού, και εκεί όπου θα ήταν το οικόπεδο', () => {
    expect(fusedElevationAt(null, COARSE, geo(0, 0)).provenance).toBe('indicative');
  });

  it('αραιό τρίγωνο: η επιφάνεια της αποτύπωσης, αλλά παρεμβολή ανάμεσα σε μακρινά σημεία', () => {
    // Ένα σημείο 50 m ανατολικά της αποτύπωσης ⇒ μακριά τρίγωνα ως αυτό (το διαγραμμισμένο μέρος της κάτοψης).
    const surface = surfaceOf(snapshotOf(surveyInput([[60, 0, 108]])), WIDTH_M);
    const { index } = surface;
    const triangle = index.sparse.findIndex(Boolean);
    expect(triangle).toBeGreaterThanOrEqual(0);
    const corners = index.triangles[triangle];
    const mean = (pick: (v: number) => number): number => corners.reduce((sum, v) => sum + pick(v), 0) / 3;
    const centroid = { x: mean((v) => index.xy[v][0]), y: mean((v) => index.xy[v][1]) };
    const fused = fusedElevationAt(surface, COARSE, surface.placement.toGeo(centroid.x, centroid.y));
    expect(fused.provenance).toBe('interpolated');
    expect(fused.cause).toBe('sparse-survey');
    // Στο κέντρο βάρους ενός τριγώνου η επιφάνεια είναι ο μέσος όρος των τριών κορυφών του.
    // Ανοχή 5 mm: το σημείο ξαναμπαίνει στο πλαίσιο μέσα σε λίγα χιλιοστά (Β2), και η κλίση του τριγώνου είναι < 1.
    expect(fused.elevationM).toBeCloseTo(mean((v) => index.z[v]), 2);
  });
});

describe('composeFusedElevationTile — το πλακίδιο', () => {
  const PARENT = tileAt(20);
  const PARENT_PX = 16;
  const PARENT_COARSE = coarseAround(PARENT);
  const parent = composeFusedElevationTile({ tile: PARENT, tileSizePx: PARENT_PX, coarse: PARENT_COARSE, surface: SURFACE });

  it('κάθε pixel είναι το ύψος στο ΚΕΝΤΡΟ του: μέσα στην αποτύπωση το επίπεδο, αλλού η μία συνάρτηση', () => {
    let onSurvey = 0;
    for (let row = 0; row < PARENT_PX; row++) {
      for (let column = 0; column < PARENT_PX; column++) {
        const centre = centreOfPixel(PARENT, PARENT_PX, row, column);
        const pixelM = heightOfPixel(parent, PARENT_PX, row, column);
        const frame = SURFACE.placement.toFrame(centre);
        if (Math.abs(frame.x) < HALF_M - 0.01 && Math.abs(frame.y) < HALF_M - 0.01) {
          onSurvey++;
          expect(Math.abs(pixelM - planeM(frame.x, frame.y))).toBeLessThan(TERRARIUM_HALF_STEP_M + 1e-4);
        }
        // Ο ΟΡΙΣΜΟΣ είναι ο ακριβής δρόμος· το πλακίδιο παίρνει τον δρόμο του πλέγματος (Β3.1) και κρίνεται απέναντί του.
        const fusedM = fusedElevationAt(SURFACE, PARENT_COARSE, centre).elevationM;
        expect(Math.abs(pixelM - fusedM)).toBeLessThan(TERRARIUM_HALF_STEP_M + ROADS_APART_M);
      }
    }
    expect(onSurvey).toBeGreaterThan(0);
    // Το «μέσα» του test αφήνει 1 cm περιθώριο από την ακμή, άρα ο ψηφιδωτής μπορεί να μετρά λίγα pixels παραπάνω.
    expect(parent.pixels.measured).toBeGreaterThanOrEqual(onSurvey);
  });

  it('τα pixels αθροίζουν στο μέγεθος του πλακιδίου, και το πλακίδιο έχει πάντα το μέγεθος που ζητήθηκε', () => {
    const { measured, interpolated, indicative, none } = parent.pixels;
    expect(measured + interpolated + indicative + none).toBe(PARENT_PX * PARENT_PX);
    expect(parent.rgba).toHaveLength(PARENT_PX * PARENT_PX * 4);
    expect(none).toBe(0);
  });

  it('άλλο ζουμ, ίδιο σημείο, ίδιο ύψος: τα τέσσερα παιδιά του z21 ξαναγράφουν τα pixels του γονέα', () => {
    const CHILD_PX = PARENT_PX / 2;
    for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const tile = { z: PARENT.z + 1, x: 2 * PARENT.x + i, y: 2 * PARENT.y + j };
      const child = composeFusedElevationTile({ tile, tileSizePx: CHILD_PX, coarse: coarseAround(tile), surface: SURFACE });
      for (let row = 0; row < CHILD_PX; row++) {
        for (let column = 0; column < CHILD_PX; column++) {
          const inParent = heightOfPixel(parent, PARENT_PX, j * CHILD_PX + row, i * CHILD_PX + column);
          // Ίδιο σημείο ⇒ το πολύ ένα βήμα κωδικοποίησης διαφορά (στρογγύλευση πάνω σε όριο βήματος).
          expect(Math.abs(heightOfPixel(child, CHILD_PX, row, column) - inParent)).toBeLessThanOrEqual(1 / 256 + 1e-9);
        }
      }
    }
  });

  it('ίδια είσοδος, ίδια bytes', () => {
    const again = composeFusedElevationTile({ tile: PARENT, tileSizePx: PARENT_PX, coarse: PARENT_COARSE, surface: SURFACE });
    expect(Array.from(again.rgba)).toEqual(Array.from(parent.rgba));
  });

  it('πλακίδιο μακριά από την αποτύπωση: καθαρό χοντρό — τα ίδια bytes με το «χωρίς αποτύπωση»', () => {
    const far = { z: PARENT.z, x: PARENT.x + 40, y: PARENT.y - 25 };
    const coarse = coarseAround(far);
    const withSurvey = composeFusedElevationTile({ tile: far, tileSizePx: PARENT_PX, coarse, surface: SURFACE });
    const without = composeFusedElevationTile({ tile: far, tileSizePx: PARENT_PX, coarse, surface: null });
    expect(withSurvey.pixels.indicative).toBe(PARENT_PX * PARENT_PX);
    expect(Array.from(withSurvey.rgba)).toEqual(Array.from(without.rgba));
    const centre = centreOfPixel(far, PARENT_PX, 5, 9);
    const { u, v } = fusionPointOf(centre);
    expect(heightOfPixel(withSurvey, PARENT_PX, 5, 9)).toBeCloseTo(coarseModelM(u, v), 2);
  });

  it('ποτέ κενό: χωρίς χοντρό και χωρίς αποτύπωση, 0 m παντού και αδιαφανές', () => {
    const flat = composeFusedElevationTile({ tile: PARENT, tileSizePx: PARENT_PX, coarse: null, surface: null });
    expect(flat.pixels.none).toBe(PARENT_PX * PARENT_PX);
    for (let at = 0; at < flat.rgba.length; at += 4) {
      expect([flat.rgba[at], flat.rgba[at + 1], flat.rgba[at + 2], flat.rgba[at + 3]]).toEqual([128, 0, 0, 255]);
    }
  });

  it('ρηχό πλακίδιο (z10, κάτω από το βάθος του αρχείου): έχει το ίδιο μέγεθος και διαβάζει το δικό του επίπεδο', () => {
    const shallow = tileAt(10);
    const coarse = coarseAround(shallow);
    expect(coarse.primary).toEqual(shallow);
    const tile = composeFusedElevationTile({ tile: shallow, tileSizePx: COARSE_PX, coarse, surface: SURFACE });
    expect(tile.rgba).toHaveLength(COARSE_PX * COARSE_PX * 4);
    // Ίδιο μέγεθος με το χοντρό ⇒ τα κέντρα συμπίπτουν: pixel εκτός αποτύπωσης = το ίδιο το pixel του αρχείου.
    const heights = coarseTileOf(shallow);
    expect(heightOfPixel(tile, COARSE_PX, 0, 0)).toBeCloseTo(heights[0], 2);
  });
});

describe('transitionZoneOf — η ζώνη μετάβασης ως σχήμα', () => {
  const zone = transitionZoneOf(SURFACE);
  if (zone === null) throw new Error('expected a transition zone');
  /** Απόσταση από το τετράγωνο ±10 m — ο ΤΥΠΟΣ, όχι το ευρετήριο ακμών. */
  const distanceToSquare = ({ x, y }: PlanarPoint): number =>
    Math.hypot(Math.max(Math.abs(x) - HALF_M, 0), Math.max(Math.abs(y) - HALF_M, 0));
  const polygons = nestRings(zone.rings);
  const fills = (point: PlanarPoint): boolean =>
    polygons.some((p) => pointInPolygon(point, p.outer) && !p.holes.some((hole) => pointInPolygon(point, hole)));

  it('το έξω όριο απέχει από το μετρημένο όσο το πλάτος, μέσα στο δηλωμένο σφάλμα του πλέγματος', () => {
    expect(zone.widthM).toBe(WIDTH_M);
    expect(zone.stepM).toBeCloseTo(WIDTH_M / 16, 9);
    const outer = zone.rings.filter((ring) => ring.some((p) => distanceToSquare(p) > 1));
    expect(outer).toHaveLength(1);
    const errors = outer[0].map((p) => Math.abs(distanceToSquare(p) - WIDTH_M));
    expect(Math.max(...errors)).toBeLessThan((zone.stepM * Math.SQRT2) / 2);
    // Μακριά από πτυχές του πεδίου απόστασης το σφάλμα είναι ~βήμα² / (8 · πλάτος) ≈ 1,5 cm.
    expect(errors.reduce((sum, e) => sum + e, 0) / errors.length).toBeLessThan(0.05);
  });

  it('με τον κανόνα even–odd γεμίζει ΑΚΡΙΒΩΣ τη ζώνη: όχι το μετρημένο, όχι το χοντρό', () => {
    expect(fills({ x: 0.3, y: 0.2 })).toBe(false);
    expect(fills({ x: HALF_M + 15, y: 0.2 })).toBe(true);
    expect(fills({ x: -HALF_M - 20, y: -HALF_M - 20 })).toBe(true);
    expect(fills({ x: HALF_M + 25, y: HALF_M + 25 })).toBe(false);
    expect(fills({ x: HALF_M + WIDTH_M + 2, y: 0.2 })).toBe(false);
  });

  it('το εμβαδόν της είναι τέσσερις λωρίδες και τέσσερα τεταρτοκύκλια', () => {
    const area = polygons.reduce(
      (sum, p) => sum + Math.abs(shoelaceArea(p.outer)) - p.holes.reduce((inner, hole) => inner + Math.abs(shoelaceArea(hole)), 0),
      0,
    );
    const expected = 4 * (2 * HALF_M) * WIDTH_M + Math.PI * WIDTH_M ** 2;
    expect(Math.abs(area - expected) / expected).toBeLessThan(0.01);
  });

  it('συμφωνεί με τα ύψη: ό,τι γεμίζει είναι «ζώνη» για τη συνάρτηση που γράφει τα pixels', () => {
    for (let x = -45.3; x < 46; x += 6.1) {
      for (let y = -44.7; y < 46; y += 5.9) {
        // Δείγματα κολλητά στο έξω όριο δεν κρίνονται: εκεί το πλέγμα διαφέρει νόμιμα κατά το δηλωμένο σφάλμα.
        if (Math.abs(distanceToSquare({ x, y }) - WIDTH_M) < zone.stepM) continue;
        expect(fills({ x, y })).toBe(groundVerdictAt(SURFACE, x, y).kind === 'transition');
      }
    }
  });

  it('χωρίς πλάτος δεν υπάρχει ζώνη', () => {
    expect(transitionZoneOf(surfaceOf(SURVEY, 0))).toBeNull();
  });

  it('στον χάρτη: ένα στοιχείο με το πλάτος του, μόνο όταν ζητηθεί — και η αποτύπωση είναι η τρύπα του', () => {
    expect(terrainMapFeaturesOf(SURVEY)?.transition).toBeNull();
    const feature = terrainMapFeaturesOf(SURVEY, { transitionM: WIDTH_M })?.transition;
    expect(feature?.properties).toEqual({ widthM: WIDTH_M });
    expect(feature?.geometry.coordinates).toHaveLength(1);
    expect(feature?.geometry.coordinates[0]).toHaveLength(2);
  });
});

describe('Β3.1 — ο γρήγορος δρόμος κρίνεται απέναντι στον ακριβή', () => {
  const lattice = SURFACE.frameLattice;

  it('το πλέγμα προβολής ανήκει στην αποτύπωση και το σφάλμα του είναι ΜΕΤΡΗΜΕΝΟ κάτω από το μισό της ανοχής', () => {
    if (lattice === null) throw new Error('expected a projection lattice');
    expect(lattice.tolerance).toBe(LISTING_TERRAIN_FUSION_PROJECTION_TOLERANCE_M);
    expect(lattice.measuredError).toBeLessThanOrEqual(lattice.tolerance / 2);
    expect(lattice.domain).toEqual({
      minU: SURFACE.geoReach.west, minV: SURFACE.geoReach.south, maxU: SURFACE.geoReach.east, maxV: SURFACE.geoReach.north,
    });
  });

  it('σε σημεία που ΔΕΝ είναι οι δοκιμές του πλέγματος, η θέση απέχει από την ακριβή προβολή λιγότερο από την ανοχή', () => {
    if (lattice === null) throw new Error('expected a projection lattice');
    const { west, east, south, north } = SURFACE.geoReach;
    const sink = { x: 0, y: 0 };
    let worst = 0;
    for (let i = 0; i < 400; i++) {
      // Άρρητα βήματα: κανένα σημείο δεν πέφτει σε κόμβο, κέντρο ή μέσο πλευράς κελιού.
      const lng = west + (east - west) * ((i * Math.SQRT2) % 1);
      const lat = south + (north - south) * ((i * Math.E) % 1);
      lattice.mapInto(sink, lng, lat);
      const exact = SURFACE.placement.toFrame({ lat, lng });
      worst = Math.max(worst, Math.hypot(sink.x - exact.x, sink.y - exact.y));
    }
    expect(worst).toBeLessThan(lattice.tolerance);
  });

  it('κάθε pixel πλακιδίου 64² γύρω από την αποτύπωση: ίδια προέλευση, ύψος μέσα στο όριο των δύο δρόμων', () => {
    const exact = createFusedElevationSink();
    const fast = createFusedElevationSink();
    const seen = new Set<string>();
    for (const z of [18, 20]) {
      const tile = tileAt(z);
      const coarse = coarseAround(tile);
      for (let row = 0; row < 64; row++) {
        for (let column = 0; column < 64; column++) {
          const point = fusionPointOf(centreOfPixel(tile, 64, row, column));
          fuseElevationInto(exact, SURFACE, coarse, point);
          fuseElevationInto(fast, SURFACE, coarse, point, 'lattice');
          expect(fast.provenance).toBe(exact.provenance);
          expect(fast.cause).toBe(exact.cause);
          expect(Math.abs(fast.elevationM - exact.elevationM)).toBeLessThan(ROADS_APART_M);
          seen.add(exact.provenance);
        }
      }
    }
    // Η σύγκριση πέρασε και από τα τρία εδάφη — αλλιώς δεν έκρινε τίποτα.
    expect([...seen].sort()).toEqual(['indicative', 'interpolated', 'measured']);
  });

  it('η προεπιλογή είναι ο ακριβής δρόμος: ο κέρσορας δεν περνά ΠΟΤΕ από το πλέγμα', () => {
    const point = fusionPointOf(geo(HALF_M + 12.3, -4.56));
    const byDefault = createFusedElevationSink();
    const exact = createFusedElevationSink();
    fuseElevationInto(byDefault, SURFACE, COARSE, point);
    fuseElevationInto(exact, SURFACE, COARSE, point, 'exact');
    expect(byDefault).toEqual(exact);
    expect(fusedElevationAt(SURFACE, COARSE, geo(HALF_M + 12.3, -4.56))).toEqual(exact);
  });

  it('η κρίση χωρίς δέσμευση είναι η ίδια κρίση: `groundVerdictInto` ≡ `groundVerdictAt`', () => {
    const sink = createGroundVerdictSink();
    for (const [x, y] of [[0, 0], [9.99, -3], [HALF_M + 5, 2], [HALF_M + 3, HALF_M + 4], [HALF_M + 45, 0], [500, 500]]) {
      groundVerdictInto(sink, SURFACE, x, y);
      const verdict = groundVerdictAt(SURFACE, x, y);
      expect(sink.kind).toBe(verdict.kind);
      if (verdict.kind === 'measured' || verdict.kind === 'sparse') {
        expect([sink.elevationM, sink.triangle]).toEqual([verdict.elevationM, verdict.triangle]);
      }
      if (verdict.kind === 'transition') {
        expect([sink.elevationM, sink.weight, sink.distanceM]).toEqual([verdict.edgeElevationM, verdict.weight, verdict.distanceM]);
      }
    }
  });
});
