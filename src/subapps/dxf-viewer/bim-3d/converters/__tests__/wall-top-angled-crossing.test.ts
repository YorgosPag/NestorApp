/**
 * ADR-401 — γωνιακή διασταύρωση τοίχου/host (footprint-clip flat-top «αγκάλιασμα»).
 *
 * Όταν ο τοίχος περνά **υπό γωνία** κάτω από δοκάρι, η κορυφή του ΔΕΝ είναι μία
 * κεκλιμένη πλάκα (αυτό άφηνε τριγωνικά κενά + overlap). Είναι **επίπεδες περιοχές**
 * (κάτω-παρειά host / nominal) με **κατακόρυφο σκαλοπάτι** στην αληθινή ακμή του host.
 * Το `clipWallBandTopRegions` κόβει το plan-quad κάθε κομματιού με τα host footprints
 * → μία επίπεδη/planar περιοχή ανά κομμάτι (κάθε μία prism μέσω `buildColumnPrismGeometry`).
 *
 * Καλύπτει:
 *   - γωνιακή διασταύρωση → 2 περιοχές (inside @underside + outside @nominal), επίπεδες
 *   - πλήρης κάλυψη → 1 περιοχή @underside· καμία κάλυψη → 1 περιοχή @nominal
 *   - μηδέν poke/gap (όλες οι κορυφές ∈ [underside, nominal])
 *   - κεκλιμένο host → planar per-vertex top
 *   - region → buildColumnPrismGeometry (συμπαγές prism)
 *   - safeDifference unit
 *   - computeWallOpeningPieces.topFollowsProfile flag (jamb=true / ποδιά=undefined)
 */

import { clipWallBandTopRegions, wallTopFaceCrossingBreakpoints } from '../wall-top-clip';
import { buildColumnPrismGeometry } from '../column-piece-geometry';
import { computeWallOpeningPieces } from '../wall-opening-pieces';
import { safeDifference } from '../../../bim/geometry/shared/safe-polygon-boolean';
import type { HostFootprintInput, Pt2 } from '../../../bim/geometry/wall-host-plan-builder';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import { computeOpeningGeometry } from '../../../bim/geometry/opening-geometry';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { OpeningEntity, OpeningParams } from '../../../bim/types/opening-types';

const TOL = 6;

// Band κατά μήκος του x: 4 × πάχος 0.25 (y ∈ [-0.125, 0.125]).
const BAND: Pt2[] = [
  { x: 0, y: 0.125 }, { x: 4, y: 0.125 }, { x: 4, y: -0.125 }, { x: 0, y: -0.125 },
];

/** Host footprint (flat underside @ undersideZmm). */
function flatHost(footprint: Pt2[], undersideZmm: number): HostFootprintInput {
  return { hostId: 'h1', hostType: 'beam', footprint, undersideZmm };
}

const flat = (xs: readonly number[]): boolean =>
  Math.max(...xs) - Math.min(...xs) < 1e-6;

/** Signed εμβαδόν (shoelace)· >0 ⇒ CCW στο plan. */
const signedArea = (pts: readonly Pt2[]): number => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
};

// ── Γωνιακή διασταύρωση → 2 επίπεδες περιοχές + κατακόρυφο σκαλοπάτι ───────────

describe('ADR-401 — clip γωνιακής διασταύρωσης: επίπεδες περιοχές', () => {
  // Host καλύπτει το +x μέρος της band· η αριστερή του ακμή περνά **διαγώνια** από
  // (1.0,0.2) σε (2.0,-0.2) → τέμνει την band λοξά (y ∈ ±0.125).
  const host = flatHost(
    [{ x: 1.0, y: 0.2 }, { x: 2.0, y: -0.2 }, { x: 10, y: -0.2 }, { x: 10, y: 0.2 }],
    2500,
  );

  it('2 περιοχές: inside @2.5 (επίπεδη) + outside @3.0 (επίπεδη)', () => {
    const regions = clipWallBandTopRegions(BAND, [host], 3000, 0, 0);
    expect(regions).toHaveLength(2);

    for (const r of regions) {
      expect(flat(r.topLocalM)).toBe(true); // κάθε περιοχή επίπεδη (μηδέν κεκλιμένο)
      expect(r.baseLocalM.every((b) => Math.abs(b) < 1e-9)).toBe(true);
      expect(r.footprint.length).toBe(r.topLocalM.length);
    }
    const tops = regions.map((r) => r.topLocalM[0]).sort((a, b) => a - b);
    expect(tops[0]).toBeCloseTo(2.5, TOL); // inside (υπό δοκάρι)
    expect(tops[1]).toBeCloseTo(3.0, TOL); // outside (nominal)
  });

  it('μηδέν poke/gap: κάθε κορυφή ∈ [underside 2.5, nominal 3.0]', () => {
    const regions = clipWallBandTopRegions(BAND, [host], 3000, 0, 0);
    for (const r of regions) {
      for (const z of r.topLocalM) {
        expect(z).toBeGreaterThanOrEqual(2.5 - 1e-6);
        expect(z).toBeLessThanOrEqual(3.0 + 1e-6);
      }
    }
  });

  it('ΟΛΑ τα regions είναι CCW (συνεπή caps normals → ομοιόχρωμος φωτισμός)', () => {
    const regions = clipWallBandTopRegions(BAND, [host], 3000, 0, 0);
    expect(regions.length).toBeGreaterThan(0);
    // CW winding → ανεστραμμένο top cap (normal −Y) → διαφορετική σκιά. Όλα CCW.
    for (const r of regions) expect(signedArea(r.footprint)).toBeGreaterThan(0);
  });
});

// ── Πλήρης κάλυψη / καμία κάλυψη ───────────────────────────────────────────────

describe('ADR-401 — clip degenerate κάλυψη', () => {
  it('host καλύπτει όλη την band → 1 περιοχή @underside', () => {
    const host = flatHost([{ x: -1, y: -1 }, { x: 5, y: -1 }, { x: 5, y: 1 }, { x: -1, y: 1 }], 2500);
    const regions = clipWallBandTopRegions(BAND, [host], 3000, 0, 0);
    expect(regions).toHaveLength(1);
    expect(flat(regions[0].topLocalM)).toBe(true);
    expect(regions[0].topLocalM[0]).toBeCloseTo(2.5, TOL);
  });

  it('host εκτός band → 1 περιοχή @nominal (== ίσιος τοίχος)', () => {
    const host = flatHost([{ x: 20, y: -1 }, { x: 21, y: -1 }, { x: 21, y: 1 }, { x: 20, y: 1 }], 2500);
    const regions = clipWallBandTopRegions(BAND, [host], 3000, 0, 0);
    expect(regions).toHaveLength(1);
    expect(regions[0].topLocalM.every((z) => Math.abs(z - 3.0) < 1e-6)).toBe(true);
  });

  it('χωρίς hosts → καμία περιοχή (ο builder κρατά το fast path)', () => {
    expect(clipWallBandTopRegions(BAND, [], 3000, 0, 0)).toHaveLength(0);
  });
});

// ── Κεκλιμένο host → planar per-vertex top ────────────────────────────────────

describe('ADR-401 — clip κεκλιμένου host (planar top)', () => {
  it('undersideZmmAt slope → η inside περιοχή έχει μεταβλητό (μη-επίπεδο) top', () => {
    const host: HostFootprintInput = {
      hostId: 'h1', hostType: 'roof',
      footprint: [{ x: -1, y: -1 }, { x: 5, y: -1 }, { x: 5, y: 1 }, { x: -1, y: 1 }],
      undersideZmm: 2500,
      undersideZmmAt: (pt) => 2000 + pt.x * 200, // 2000mm @x=0 → 2800mm @x=4
    };
    const regions = clipWallBandTopRegions(BAND, [host], 3000, 0, 0);
    expect(regions).toHaveLength(1);
    // Μεταβλητό top (clamped ≤ nominal 3.0): @x=0 →2.0, @x=4 →2.8.
    expect(flat(regions[0].topLocalM)).toBe(false);
    for (const z of regions[0].topLocalM) {
      expect(z).toBeLessThanOrEqual(3.0 + 1e-6);
      expect(z).toBeGreaterThanOrEqual(2.0 - 1e-6);
    }
  });
});

// ── region → buildColumnPrismGeometry (συμπαγές) ──────────────────────────────

describe('ADR-401 — region → prism (συμπαγές, μηδέν τρύπα)', () => {
  it('κάθε clipped region χτίζει non-null flat prism (non-indexed)', () => {
    const host = flatHost(
      [{ x: 1.0, y: 0.2 }, { x: 2.0, y: -0.2 }, { x: 10, y: -0.2 }, { x: 10, y: 0.2 }],
      2500,
    );
    const regions = clipWallBandTopRegions(BAND, [host], 3000, 0, 0);
    expect(regions.length).toBeGreaterThan(0);
    for (const r of regions) {
      const prism = buildColumnPrismGeometry(r.footprint, r.baseLocalM, r.topLocalM);
      expect(prism).not.toBeNull();
      // Flat shading → non-indexed· κάθε τρίγωνο 3 ξεχωριστές κορυφές (πολλαπλάσιο του 3).
      expect(prism!.getIndex()).toBeNull();
      expect(prism!.getAttribute('position').count % 3).toBe(0);
    }
  });
});

// ── safeDifference unit ───────────────────────────────────────────────────────

describe('ADR-401 — safeDifference (rectangle − rectangle)', () => {
  it('αφαιρεί το δεξί μισό → μένει το αριστερό', () => {
    const full = [[[0, 0], [4, 0], [4, 2], [0, 2]]] as [number, number][][];
    const right = [[[2, -1], [5, -1], [5, 3], [2, 3]]] as [number, number][][];
    const diff = safeDifference(full, right);
    expect(diff.length).toBeGreaterThan(0);
    // Όλα τα vertices με x ≤ 2 (+ tol).
    for (const poly of diff) for (const ring of poly) for (const [x] of ring) {
      expect(x).toBeLessThanOrEqual(2 + 1e-6);
    }
  });
});

// ── topFollowsProfile flag (jamb=true / ποδιά=undefined) ──────────────────────

function makeWall(): WallEntity {
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 }, end: { x: 5, y: 0, z: 0 },
    height: 3000, thickness: 250,
    flip: false, baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
    sceneUnits: 'm',
  };
  return {
    id: 'w', type: 'wall', kind: 'straight', layerId: '0', params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as WallEntity;
}

function makeDoor(wall: WallEntity): OpeningEntity {
  const params: OpeningParams = {
    kind: 'door', wallId: 'w', offsetFromStart: 2000, width: 1000, height: 2100,
    sillHeight: 0, handing: 'left', openDirection: 'inward',
  };
  return {
    id: 'op', type: 'opening', kind: 'door', layerId: '0', params,
    geometry: computeOpeningGeometry(params, wall, 'm'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as OpeningEntity;
}

describe('ADR-401 — computeWallOpeningPieces.topFollowsProfile', () => {
  it('jamb full-height → topFollowsProfile=true· ποδιά πόρτας → undefined', () => {
    const wall = makeWall();
    const pieces = computeWallOpeningPieces(wall, [makeDoor(wall)])!;
    // Jambs (full-height, κορυφή στο ύψος τοίχου 3.0) → topFollowsProfile.
    const jambs = pieces.filter((p) => p.topFollowsProfile);
    expect(jambs.length).toBeGreaterThan(0);
    for (const j of jambs) expect(j.zTopAM).toBeCloseTo(3.0, 2);
    // Πόρτα sill 0 → καμία ποδιά (πάτος==σιλ). Αν υπάρχει lintel, είναι topFollowsProfile.
    const lintel = pieces.find((p) => Math.abs(p.zBotAM - 2.1) < 1e-2);
    if (lintel) expect(lintel.topFollowsProfile).toBe(true);
  });
});

// ── FACE crossings → ορθογώνια ακριανά + τρίγωνα (όχι πεντάγωνα) ────────────────
//
// Regression για το πεντάγωνο bug: ο τοίχος ΠΡΕΠΕΙ να σπάει στα σημεία που τον
// τέμνουν οι ΠΑΡΕΙΕΣ, ΟΧΙ ο άξονας. Host με διαγώνια αριστερή ακμή
// (1.0,0.2)→(2.0,-0.2): η εξωτερική παρειά (y=+0.125) τέμνεται @x=1.1875
// (t≈0.297)· η εσωτερική (y=-0.125) @x=1.8125 (t≈0.453)· ο άξονας (y=0) @x=1.5
// (t=0.375 — ΕΝΑ μόνο). Σπάζοντας στις 2 face crossings → ακριανό = ορθογώνιο,
// μεσαίο = 2 τρίγωνα.
describe('ADR-401 — wallTopFaceCrossingBreakpoints (παρειές, όχι άξονας)', () => {
  const angledHost = flatHost(
    [{ x: 1.0, y: 0.2 }, { x: 2.0, y: -0.2 }, { x: 10, y: -0.2 }, { x: 10, y: 0.2 }],
    2500,
  );
  const geom = {
    outerEdge: { points: [{ x: 0, y: 0.125 }, { x: 4, y: 0.125 }] as Pt2[] },
    innerEdge: { points: [{ x: 0, y: -0.125 }, { x: 4, y: -0.125 }] as Pt2[] },
  };

  it('επιστρέφει 2 εσωτερικά breakpoints (outer ≠ inner), όχι 1 axis crossing', () => {
    const bps = wallTopFaceCrossingBreakpoints(geom, [angledHost]);
    expect(bps).toHaveLength(2);
    expect(bps[0]).toBeCloseTo(0.296875, 5); // outer face @x=1.1875 / 4
    expect(bps[1]).toBeCloseTo(0.453125, 5); // inner face @x=1.8125 / 4
    // Αυστηρά μέσα στον τοίχο (το 0/1 δεν σπάει).
    for (const t of bps) { expect(t).toBeGreaterThan(0); expect(t).toBeLessThan(1); }
  });

  it('χωρίς hosts / άδειες παρειές → καμία breakpoint (fast path)', () => {
    expect(wallTopFaceCrossingBreakpoints(geom, [])).toHaveLength(0);
    expect(wallTopFaceCrossingBreakpoints(
      { outerEdge: { points: [] }, innerEdge: { points: [] } }, [angledHost],
    )).toHaveLength(0);
  });
});

describe('ADR-401 — split στα face crossings → ορθογώνια άκρα + τρίγωνα', () => {
  const angledHost = flatHost(
    [{ x: 1.0, y: 0.2 }, { x: 2.0, y: -0.2 }, { x: 10, y: -0.2 }, { x: 10, y: 0.2 }],
    2500,
  );
  // Wall κατά τον x: start(0,0)→end(4,0), thickness 250mm → παρειές y=±0.125.
  const wall = ((): WallEntity => {
    const params: WallParams = {
      category: 'exterior',
      start: { x: 0, y: 0, z: 0 }, end: { x: 4, y: 0, z: 0 },
      height: 3000, thickness: 250,
      flip: false, baseBinding: 'storey-floor', topBinding: 'attached', baseOffset: 0, topOffset: 0,
      sceneUnits: 'm',
    };
    return {
      id: 'w', type: 'wall', kind: 'straight', layerId: '0', params,
      geometry: computeWallGeometry(params, 'straight'),
      validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
    } as unknown as WallEntity;
  })();

  // Mirror του converter: clipWallTop με FACE breakpoints + nominal (το clip
  // ξαναϋπολογίζει την κορυφή).
  const breakpoints = wallTopFaceCrossingBreakpoints(wall.geometry, [angledHost]);
  const clipWallTop = { breakpoints, at: () => 3.0 };

  it('3 κομμάτια (2 breakpoints) — όχι 2 (axis)', () => {
    const pieces = computeWallOpeningPieces(wall, [], clipWallTop)!;
    expect(pieces).toHaveLength(3);
  });

  it('ακριανά κομμάτια → καθαρό ορθογώνιο, μία επίπεδη περιοχή (μηδέν πεντάγωνα)', () => {
    const pieces = computeWallOpeningPieces(wall, [], clipWallTop)!;
    // Το host καλύπτει το +x μισό: αριστερό άκρο @nominal 3.0, δεξί άκρο (κάτω από
    // το δοκάρι) @underside 2.5 — και τα δύο ΟΡΘΟΓΩΝΙΑ (4 κορυφές, μία περιοχή).
    const expectRectEnd = (pc: typeof pieces[number], expectedTop: number): void => {
      const regions = clipWallBandTopRegions(pc.quad, [angledHost], 3000, 0, pc.zBotAM);
      expect(regions).toHaveLength(1);
      expect(regions[0].footprint.length).toBe(4);
      expect(flat(regions[0].topLocalM)).toBe(true);
      expect(regions[0].topLocalM[0]).toBeCloseTo(expectedTop, TOL);
    };
    expectRectEnd(pieces[0], 3.0);
    expectRectEnd(pieces[pieces.length - 1], 2.5);
  });

  it('μεσαίο κομμάτι → 2 καθαρά τρίγωνα (ένα @3.0, ένα @2.5· μηδέν πεντάγωνα)', () => {
    const pieces = computeWallOpeningPieces(wall, [], clipWallTop)!;
    const mid = pieces[1];
    const regions = clipWallBandTopRegions(mid.quad, [angledHost], 3000, 0, mid.zBotAM);
    expect(regions).toHaveLength(2);
    for (const r of regions) {
      expect(r.footprint.length).toBe(3);  // καθαρό τρίγωνο (μηδέν πεντάγωνα/diagonals)
      expect(flat(r.topLocalM)).toBe(true); // κάθε τρίγωνο επίπεδο
    }
    const tops = regions.map((r) => r.topLocalM[0]).sort((a, b) => a - b);
    expect(tops[0]).toBeCloseTo(2.5, TOL); // κάτω από το δοκάρι
    expect(tops[1]).toBeCloseTo(3.0, TOL); // nominal
  });
});
