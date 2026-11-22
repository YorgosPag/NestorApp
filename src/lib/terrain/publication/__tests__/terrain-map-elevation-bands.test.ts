/**
 * ADR-920 Β6.2 — υψομετρικές ζώνες της κάτοψης, πάνω σε ΑΛΗΘΙΝΟ στιγμιότυπο (`buildListingTerrainSnapshot`).
 *
 *   `PLANE`: οικόπεδο 20 × 20 m, ανεβαίνει 10 % προς ανατολάς από 120 m ⇒ z = 120 + (x + 10) / 10 στο πλαίσιο του
 *   στιγμιοτύπου (x από −10 ως 10). Το ύψος είναι γραμμικό στο x, άρα το μερίδιο εμβαδού κάθε ζώνης = εύρος / ανάγλυφο,
 *   ακριβώς. Το πλέγμα ανά 2 m βάζει κορυφές ΑΚΡΙΒΩΣ πάνω στα επίπεδα 120,2 · 120,4 · … (η εκφυλισμένη περίπτωση).
 */

import { terrainElevationHex } from '@/lib/terrain/elevation-ramp';
import type { TopoPoint } from '@/lib/terrain/terrain-types';

import { buildListingTerrainSnapshot } from '../listing-terrain-snapshot';
import { LISTING_TERRAIN_MAP_MAX_ELEVATION_BANDS, LISTING_TERRAIN_MAP_MIN_BAND_WIDTH_PX } from '../listing-terrain-config';
import type { ListingTerrainContour, ListingTerrainSnapshot } from '../listing-terrain-types';
import {
  bandLevelsOf,
  contourLevelsOf,
  elevationBandsOf,
  intermediateBandsNarrow,
  type BandLevelRule,
} from '../terrain-map-elevation-bands';
import { meshTriangles } from '../terrain-map-regions';

const E0 = 400_000_000;
const N0 = 4_200_000_000;
const every = (from: number, to: number, step: number): number[] =>
  Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);

function snapshotOf(xs: readonly number[], ys: readonly number[], zMmAt: (xM: number, yM: number) => number): ListingTerrainSnapshot {
  const points: TopoPoint[] = xs.flatMap((x) => ys.map((y) => ({ x: E0 + x * 1000, y: N0 + y * 1000, z: zMmAt(x, y) })));
  const result = buildListingTerrainSnapshot({ points, boundaryWorldMm: null, envelope: null });
  if (!result.ok) throw new Error(`expected a snapshot, got ${result.reason}`);
  return result.snapshot;
}

const PLANE = snapshotOf(every(0, 20, 2), every(0, 20, 2), (x) => 120_000 + 100 * x);
/** Λόφος: κορυφή στο κέντρο, κλίση προς όλες τις πλευρές (ζώνες σε δακτυλίους). */
const HILL = snapshotOf(every(0, 20, 1), every(0, 20, 1), (x, y) => 120_000 + 4_000 - 20 * ((x - 10) ** 2 + (y - 10) ** 2));

function bandsOf(snapshot: ListingTerrainSnapshot) {
  const { minElevationM, maxElevationM } = snapshot.stats;
  return elevationBandsOf(snapshot.mesh, meshTriangles(snapshot.mesh), contourLevelsOf(snapshot.contours), minElevationM, maxElevationM);
}

/** Κάθε ζεύγος `x y` ενός path (SVG: y προς τα κάτω). */
function pathPoints(pathData: string): { x: number; y: number }[] {
  const numbers = (pathData.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  return Array.from({ length: numbers.length / 2 }, (_, i) => ({ x: numbers[2 * i], y: numbers[2 * i + 1] }));
}

describe('elevationBandsOf — επίπεδο με κλίση 10 %', () => {
  const bands = bandsOf(PLANE);
  const relief = PLANE.stats.maxElevationM - PLANE.stats.minElevationM;

  it('οι ζώνες καλύπτουν όλο το ανάγλυφο, συνεχόμενες, και τα όριά τους είναι ΤΑ επίπεδα των ισοϋψών', () => {
    expect(bands[0].fromM).toBe(PLANE.stats.minElevationM);
    expect(bands[bands.length - 1].toM).toBe(PLANE.stats.maxElevationM);
    for (let i = 1; i < bands.length; i++) expect(bands[i].fromM).toBe(bands[i - 1].toM);
    const inner = bands.slice(1).map((band) => band.fromM);
    expect(inner.every((level) => contourLevelsOf(PLANE.contours).includes(level))).toBe(true);
  });

  it('μερίδιο εμβαδού = εύρος / ανάγλυφο, ακριβώς (το ύψος είναι γραμμικό στο x)', () => {
    for (const band of bands) expect(band.areaShare).toBeCloseTo((band.toM - band.fromM) / relief, 9);
    expect(bands.reduce((sum, band) => sum + band.areaShare, 0)).toBeCloseTo(1, 9);
  });

  it('κάθε ζώνη είναι ΕΝΑΣ δακτύλιος — τα σημεία τομής μοιράζονται ανάμεσα σε γειτονικά τρίγωνα, χωρίς ραφή', () => {
    for (const band of bands) expect((band.pathData.match(/M/g) ?? []).length).toBe(1);
  });

  it('κάθε κορυφή ζώνης είναι στο όριο της έκτασης ή ΠΑΝΩ στην ισοϋψή που την κλείνει', () => {
    for (const band of bands) {
      for (const p of pathPoints(band.pathData)) {
        const z = 120 + (p.x + 10) / 10;
        const onLevel = Math.abs(z - band.fromM) < 1e-6 || Math.abs(z - band.toM) < 1e-6;
        expect(onLevel || Math.abs(p.y) === 10).toBe(true);
      }
    }
  });

  it('χρώμα = η μία υψομετρική κλίμακα στο μέσο ύψος της ζώνης', () => {
    for (const band of bands) {
      const t = ((band.fromM + band.toM) / 2 - PLANE.stats.minElevationM) / relief;
      expect(band.color).toBe(terrainElevationHex(t));
    }
    expect(bands[0].color).not.toBe(bands[bands.length - 1].color);
  });
});

describe('elevationBandsOf — λόφος', () => {
  const bands = bandsOf(HILL);

  it('το άθροισμα των μεριδίων είναι 1 και η χαμηλότερη ζώνη έχει τον τόνο της κοιλάδας', () => {
    expect(bands.reduce((sum, band) => sum + band.areaShare, 0)).toBeCloseTo(1, 9);
    expect(bands[0].color).toBe(terrainElevationHex(((bands[0].fromM + bands[0].toM) / 2 - HILL.stats.minElevationM)
      / (HILL.stats.maxElevationM - HILL.stats.minElevationM)));
  });

  it('η κορυφή είναι μία κλειστή ζώνη γύρω από το κέντρο (ένας δακτύλιος)', () => {
    const top = bands[bands.length - 1];
    expect((top.pathData.match(/M/g) ?? []).length).toBe(1);
    for (const p of pathPoints(top.pathData)) expect(Math.hypot(p.x, p.y)).toBeLessThan(10);
  });
});

describe('elevationBandsOf — άκρα', () => {
  it('επίπεδο έδαφος χωρίς ισοϋψείς ⇒ μία ζώνη, όλο το εμβαδόν', () => {
    const flat = snapshotOf(every(0, 20, 5), every(0, 20, 5), () => 120_000);
    const { minElevationM, maxElevationM } = flat.stats;
    const bands = elevationBandsOf(flat.mesh, meshTriangles(flat.mesh), [], minElevationM, maxElevationM);
    expect(bands).toHaveLength(1);
    expect(bands[0].areaShare).toBe(1);
    expect(bands[0].color).toBe(terrainElevationHex(0));
  });
});

describe('bandLevelsOf — όρια ζωνών σε ΖΩΓΡΑΦΙΣΜΕΝΑ επίπεδα, ποτέ ζώνη ανά γραμμή (Β6.8)', () => {
  /** Μία γραμμή ανά επίπεδο· κύρια όταν το επίπεδο είναι πολλαπλάσιο του `majorM`. */
  const contoursAt = (levels: readonly number[], majorM: number): ListingTerrainContour[] =>
    levels.map((levelM) => ({
      levelM,
      major: Math.abs(levelM / majorM - Math.round(levelM / majorM)) < 1e-9,
      closed: false,
      points: [0, 0, 1, 1],
    }));
  const rule = (majorContourIntervalM: number): BandLevelRule =>
    ({ majorContourIntervalM, minorShown: 'all', intermediateBandsNarrow: false });
  const tenths = (from: number, count: number) => Array.from({ length: count }, (_, i) => Math.round((from + i / 10) * 10) / 10);

  it('λίγα επίπεδα ⇒ όλα (καμία αλλαγή από το Β6.2)', () => {
    const levels = tenths(120.1, 8);
    expect(bandLevelsOf(contoursAt(levels, 0.5), rule(0.5))).toEqual(levels);
  });

  it('πολλά επίπεδα ⇒ μόνο οι κύριες, ≤ όριο ζωνών', () => {
    const out = bandLevelsOf(contoursAt(tenths(120.1, 19), 0.5), rule(0.5));
    expect(out).toEqual([120.5, 121, 121.5]);
    expect(out.length + 1).toBeLessThanOrEqual(LISTING_TERRAIN_MAP_MAX_ELEVATION_BANDS);
  });

  it.each(['some', 'none'] as const)(
    'όταν οι ενδιάμεσες δεν σχεδιάζονται όλες (%s), καμία ενδιάμεση δεν γίνεται όριο (εκεί μπορεί να λείπει η γραμμή)',
    (minorShown) => {
      const levels = tenths(120.1, 8);
      expect(bandLevelsOf(contoursAt(levels, 0.5), { ...rule(0.5), minorShown })).toEqual([120.5]);
    },
  );

  it('ακόμη και οι κύριες πολλές ⇒ πολλαπλάσια της κύριας (2, 5, 10 …)', () => {
    const metres = Array.from({ length: 30 }, (_, i) => i + 1);
    const out = bandLevelsOf(contoursAt(metres, 1), rule(1));
    expect(out).toEqual([5, 10, 15, 20, 25, 30]);
  });

  it('ζώνες ενός διαστήματος πολύ στενές στην οθόνη ⇒ μόνο οι κύριες (το χρώμα δεν αλλάζει σε κάθε γραμμή)', () => {
    const levels = tenths(120.1, 8);
    expect(bandLevelsOf(contoursAt(levels, 0.5), { ...rule(0.5), intermediateBandsNarrow: true })).toEqual([120.5]);
  });
});

describe('intermediateBandsNarrow — πλάτος ζώνης στην οθόνη = διάστημα / κλίση × px ανά m (Β6.8)', () => {
  /** PLANE: κλίση 10 % παντού ⇒ ζώνη ενός διαστήματος = διάστημα / 0,1 m στο έδαφος. */
  const bandWidthM = PLANE.contourIntervalM / 0.1;
  const atBoundary = LISTING_TERRAIN_MAP_MIN_BAND_WIDTH_PX / bandWidthM;

  it('κάτω από το όριο ⇒ στενές', () => {
    expect(intermediateBandsNarrow(PLANE.mesh, PLANE.contourIntervalM, atBoundary * 0.9)).toBe(true);
  });

  it('πάνω από το όριο ⇒ όχι στενές', () => {
    expect(intermediateBandsNarrow(PLANE.mesh, PLANE.contourIntervalM, atBoundary * 1.1)).toBe(false);
  });

  it('επίπεδο έδαφος ⇒ ποτέ στενές, σε οποιαδήποτε κλίμακα', () => {
    const flat = snapshotOf(every(0, 20, 5), every(0, 20, 5), () => 120_000);
    expect(intermediateBandsNarrow(flat.mesh, 0.1, 1)).toBe(false);
  });
});
