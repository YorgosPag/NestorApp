/**
 * ADR-401 Phase B2 — stepped/sloped 3D wall solid.
 *
 * Καλύπτει το piece-wise prism με μεταβλητή κορυφή (lower-envelope προφίλ):
 *   - flat back-compat (μηδέν profile → αμετάβλητα pieces, σταθερό ύψος)
 *   - οριζόντιο σκαλωτό (δοκάρι σε μερική κάλυψη → 3 επίπεδα κομμάτια)
 *   - profile breakpoint splitting (split στα segment όρια)
 *   - κεκλιμένη κορυφή → custom wedge BufferGeometry (zTopAM ≠ zTopBM)
 *   - ADR §1 παράδειγμα 3.00 → 2.50
 *   - άνοιγμα + σκαλωτή κορυφή (jamb/πρέκι ακολουθούν το προφίλ)
 *
 * Integration: resolveWallTopProfile (Phase A) → makeWallTopLocalFn (mm→local m)
 * → computeWallOpeningPieces / buildSlopedWallPieceGeometry.
 */

import { computeWallOpeningPieces } from '../wall-opening-pieces';
import { buildSlopedWallPieceGeometry } from '../wall-piece-geometry';
import { makeWallTopLocalFn } from '../BimToThreeConverter';
import {
  resolveWallTopProfile,
  type HostUndersidePlan,
  type WallVerticalParams,
} from '../../../bim/geometry/wall-top-profile';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import { computeOpeningGeometry } from '../../../bim/geometry/opening-geometry';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { OpeningEntity, OpeningParams } from '../../../bim/types/opening-types';

// ── Fixtures ('m' scene, 5m × 250mm, ύψος 3000mm) ─────────────────────────────

function makeWall(o?: Partial<WallParams>): WallEntity {
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 }, end: { x: 5, y: 0, z: 0 },
    height: 3000, thickness: 250,
    flip: false, baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
    sceneUnits: 'm', ...o,
  };
  return {
    id: 'w', type: 'wall', kind: 'straight', layerId: '0', params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as WallEntity;
}

function makeOpening(wall: WallEntity, o?: Partial<OpeningParams>): OpeningEntity {
  const params: OpeningParams = {
    kind: 'door', wallId: 'w', offsetFromStart: 2000, width: 1000, height: 2100,
    sillHeight: 0, handing: 'left', openDirection: 'inward', ...o,
  };
  return {
    id: 'op', type: 'opening', kind: params.kind, layerId: '0', params,
    geometry: computeOpeningGeometry(params, wall, wall.params.sceneUnits ?? 'mm'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as OpeningEntity;
}

/** Προφίλ από έναν host (absolute mm) πάνω σε attached τοίχο ύψους 3000mm. */
function profileFromHost(host: HostUndersidePlan | null) {
  const params: WallVerticalParams = {
    baseBinding: 'storey-floor', topBinding: 'attached', baseOffset: 0, topOffset: 0,
    height: 3000, attachTopToIds: ['h1'],
  };
  return resolveWallTopProfile(params, {
    floorElevationMm: 0,
    resolveHost: (id) => (id === 'h1' ? host : null),
  });
}

const TOL = 3;

// ── Flat back-compat ──────────────────────────────────────────────────────────

describe('B2 — flat back-compat (χωρίς προφίλ)', () => {
  it('χωρίς wallTop → 1 κομμάτι, επίπεδη κορυφή στο ύψος τοίχου (3.0m)', () => {
    const pieces = computeWallOpeningPieces(makeWall(), [])!;
    expect(pieces).toHaveLength(1);
    expect(pieces[0].zBotAM).toBe(0);
    expect(pieces[0].zBotBM).toBe(0);
    expect(pieces[0].zTopAM).toBeCloseTo(3.0, TOL);
    expect(pieces[0].zTopBM).toBeCloseTo(3.0, TOL); // flat
  });
});

// ── Οριζόντιο σκαλωτό (δοκάρι μερικής κάλυψης) ─────────────────────────────────

describe('B2 — οριζόντιο σκαλωτό (lower-envelope)', () => {
  it('δοκάρι στο [0.3,0.7] @2500mm → 3 επίπεδα κομμάτια 3.0/2.5/3.0', () => {
    const profile = profileFromHost({ hostId: 'h1', hostType: 'beam', t0: 0.3, t1: 0.7, z0mm: 2500, z1mm: 2500 });
    const wallTop = makeWallTopLocalFn(profile, 0);
    const pieces = computeWallOpeningPieces(makeWall(), [], wallTop)!;

    expect(pieces).toHaveLength(3);
    // Όλα επίπεδα (zTopAM === zTopBM) — οριζόντιο δοκάρι.
    for (const p of pieces) expect(p.zTopAM).toBeCloseTo(p.zTopBM, TOL);
    const tops = pieces.map((p) => p.zTopAM);
    expect(tops[0]).toBeCloseTo(3.0, TOL);
    expect(tops[1]).toBeCloseTo(2.5, TOL); // κάτω από το δοκάρι
    expect(tops[2]).toBeCloseTo(3.0, TOL);
  });

  it('ADR §1 παράδειγμα: δοκάρι κάτω-παρειά 2500mm → τοίχος 2.5m εκεί', () => {
    const profile = profileFromHost({ hostId: 'h1', hostType: 'beam', t0: 0, t1: 1, z0mm: 2500, z1mm: 2500 });
    const wallTop = makeWallTopLocalFn(profile, 0);
    const pieces = computeWallOpeningPieces(makeWall(), [], wallTop)!;
    expect(pieces).toHaveLength(1);
    expect(pieces[0].zTopAM).toBeCloseTo(2.5, TOL);
    expect(pieces[0].zTopBM).toBeCloseTo(2.5, TOL);
  });
});

// ── Profile breakpoint splitting ──────────────────────────────────────────────

describe('B2 — split στα profile breakpoints', () => {
  it('breakpoints {0.3,0.7} → split ακόμη και χωρίς ανοίγματα', () => {
    const profile = profileFromHost({ hostId: 'h1', hostType: 'beam', t0: 0.3, t1: 0.7, z0mm: 2500, z1mm: 2500 });
    const wallTop = makeWallTopLocalFn(profile, 0);
    expect(wallTop.breakpoints).toEqual([0.3, 0.7]);
    const pieces = computeWallOpeningPieces(makeWall(), [], wallTop)!;
    expect(pieces).toHaveLength(3);
  });
});

// ── Κεκλιμένη κορυφή → custom wedge ────────────────────────────────────────────

describe('B2 — κεκλιμένη κορυφή (wedge BufferGeometry)', () => {
  it('κεκλιμένος host 2000→3000mm → 1 κομμάτι με zTopAM ≠ zTopBM', () => {
    const profile = profileFromHost({ hostId: 'h1', hostType: 'roof', t0: 0, t1: 1, z0mm: 2000, z1mm: 3000 });
    const wallTop = makeWallTopLocalFn(profile, 0);
    const pieces = computeWallOpeningPieces(makeWall(), [], wallTop)!;
    expect(pieces).toHaveLength(1);
    expect(pieces[0].zTopAM).toBeCloseTo(2.0, TOL);
    expect(pieces[0].zTopBM).toBeCloseTo(3.0, TOL); // κεκλιμένο
  });

  it('buildSlopedWallPieceGeometry → 8 κορυφές, σωστά top Y ανά boundary', () => {
    const geo = buildSlopedWallPieceGeometry({
      quad: [
        { x: 0, y: 0.125, z: 0 }, { x: 5, y: 0.125, z: 0 },
        { x: 5, y: -0.125, z: 0 }, { x: 0, y: -0.125, z: 0 },
      ],
      zBotAM: 0, zBotBM: 0, zTopAM: 2.0, zTopBM: 3.0,
    })!;
    expect(geo).not.toBeNull();
    const pos = geo.getAttribute('position');
    expect(pos.count).toBe(8);
    // top verts: idx 4 (Ao)=zTopAM, idx 5 (Bo)=zTopBM. Y = component 1.
    expect(pos.getY(4)).toBeCloseTo(2.0, TOL);
    expect(pos.getY(5)).toBeCloseTo(3.0, TOL);
    // bottom verts @0
    expect(pos.getY(0)).toBeCloseTo(0, TOL);
    expect(geo.getIndex()!.count).toBe(36); // 12 τρίγωνα
  });

  it('εκφυλισμένο (κορυφή ≤ βάση) → null', () => {
    const geo = buildSlopedWallPieceGeometry({
      quad: [
        { x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 },
      ],
      zBotAM: 3, zBotBM: 3, zTopAM: 3, zTopBM: 3,
    });
    expect(geo).toBeNull();
  });
});

// ── Άνοιγμα + σκαλωτή κορυφή ───────────────────────────────────────────────────

describe('B2 — άνοιγμα + σκαλωτή κορυφή', () => {
  it('πόρτα + δοκάρι @2500mm: πρέκι/jambs ακολουθούν την κορυφή του προφίλ', () => {
    const wall = makeWall();
    const op = makeOpening(wall); // door sill 0, height 2100 (lintel @2.1m)
    const profile = profileFromHost({ hostId: 'h1', hostType: 'beam', t0: 0, t1: 1, z0mm: 2500, z1mm: 2500 });
    const wallTop = makeWallTopLocalFn(profile, 0);
    const pieces = computeWallOpeningPieces(wall, [op], wallTop)!;

    // Κανένα κομμάτι δεν ξεπερνά την κορυφή του δοκαριού (2.5m) πέρα από ανοχή.
    for (const p of pieces) {
      expect(p.zTopAM).toBeLessThanOrEqual(2.5 + 1e-3);
      expect(p.zTopBM).toBeLessThanOrEqual(2.5 + 1e-3);
    }
    // Υπάρχει πρέκι πάνω από την πόρτα (zBot = lintel 2.1m, zTop = 2.5m).
    const lintel = pieces.find((p) => Math.abs(p.zBotAM - 2.1) < 1e-2);
    expect(lintel).toBeDefined();
    expect(lintel!.zTopAM).toBeCloseTo(2.5, 2);
  });
});
