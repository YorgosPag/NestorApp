/**
 * ADR-401 (γ) Phase γ2 — base-attach consumers (3D / 2D / BOQ).
 *
 * Η μηχανή (γ1: `resolveWallBaseProfile`) είναι αόρατη χωρίς consumers. Εδώ
 * επαληθεύεται ότι ο μεταβλητός **πάτος** διαχέεται:
 *   1. 3D: `computeWallOpeningPieces` με `wallBase` → μεταβλητό `zBotAM/zBotBM`
 *      (flat lowered / σκαλωτό → πολλά κομμάτια / κεκλιμένο → wedge).
 *   2. 2D τομή: `wallSection` → `yMin` αποτιμάται από το base profile στο cut.
 *   3. BOQ: `computeWallGeometry` → ύψος/area/volume = top − base.
 *
 * @see wall-base-profile.ts (engine, γ1) · wall-opening-pieces.ts · section-intersect.ts · wall-geometry.ts
 */

import { computeWallOpeningPieces, type WallBaseLocalFn } from '../wall-opening-pieces';
import { makeWallBaseLocalFn } from '../BimToThreeConverter';
import { wallSection, type WallPlan } from '../../2d-section/section-intersect';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import type { WallBaseProfile } from '../../../bim/geometry/wall-base-profile';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';

const TOL = 3;
const MM_TO_M = 0.001;

function makeWall(o?: Partial<WallParams>): WallEntity {
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 }, end: { x: 5, y: 0, z: 0 }, // 'm' scene
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

/** WallBaseProfile literal helper (απόλυτα mm). */
function baseProfile(
  segments: WallBaseProfile['segments'],
  nominalBaseZmm = 0,
): WallBaseProfile {
  let min = Infinity, max = -Infinity;
  for (const s of segments) { min = Math.min(min, s.z0mm, s.z1mm); max = Math.max(max, s.z0mm, s.z1mm); }
  return {
    nominalBaseZmm,
    segments,
    minBaseZmm: min,
    maxBaseZmm: max,
    hasAttach: segments.some((s) => s.source === 'attached'),
    missingHostIds: [],
  };
}

// ── 3D: μεταβλητός πάτος ──────────────────────────────────────────────────────

describe('γ2 3D — computeWallOpeningPieces με μεταβλητό πάτο', () => {
  it('flat lowered base (-0.5m θεμέλιο) → 1 κομμάτι, zBot = -0.5 και στα δύο boundaries', () => {
    const wallBase: WallBaseLocalFn = { breakpoints: [], at: () => -0.5 };
    const pieces = computeWallOpeningPieces(makeWall(), [], undefined, wallBase)!;
    expect(pieces).toHaveLength(1);
    expect(pieces[0].zBotAM).toBeCloseTo(-0.5, TOL);
    expect(pieces[0].zBotBM).toBeCloseTo(-0.5, TOL);
    expect(pieces[0].zTopAM).toBeCloseTo(3.0, TOL); // top αμετάβλητο (nominal)
  });

  it('σκαλωτός πάτος (βήμα στο 0.4) → split, bottoms -0.5 μετά 0', () => {
    const wallBase: WallBaseLocalFn = { breakpoints: [0.4], at: (f) => (f < 0.4 ? -0.5 : 0) };
    const pieces = computeWallOpeningPieces(makeWall(), [], undefined, wallBase)!;
    expect(pieces.length).toBeGreaterThanOrEqual(2);
    expect(pieces[0].zBotAM).toBeCloseTo(-0.5, TOL);
    expect(pieces[pieces.length - 1].zBotAM).toBeCloseTo(0, TOL);
  });

  it('makeWallBaseLocalFn + κεκλιμένη βάση -0.5→0 → 1 wedge κομμάτι zBotAM ≠ zBotBM', () => {
    const profile = baseProfile([{ t0: 0, t1: 1, z0mm: -500, z1mm: 0, source: 'attached', hostId: 'h1' }]);
    const wallBase = makeWallBaseLocalFn(profile, 0);
    const pieces = computeWallOpeningPieces(makeWall(), [], undefined, wallBase)!;
    expect(pieces).toHaveLength(1);
    expect(pieces[0].zBotAM).toBeCloseTo(-0.5, TOL);
    expect(pieces[0].zBotBM).toBeCloseTo(0.0, TOL);
  });

  it('πρέκι ΔΕΝ ακολουθεί τη βάση (lintel σταθερό) ενώ jambs/ποδιά πέφτουν', () => {
    const wall = makeWall();
    // door sill 0, height 2100 → lintel @2.1m
    const op = {
      id: 'op', type: 'opening', kind: 'door', layerId: '0',
      params: { kind: 'door', wallId: 'w', offsetFromStart: 2000, width: 1000, height: 2100, sillHeight: 0, handing: 'left', openDirection: 'inward' },
      geometry: undefined, visible: true,
    } as unknown as import('../../../bim/types/opening-types').OpeningEntity;
    const wallBase: WallBaseLocalFn = { breakpoints: [], at: () => -0.5 };
    const pieces = computeWallOpeningPieces(wall, [op], undefined, wallBase)!;
    // jambs πέφτουν στο -0.5
    expect(pieces.some((p) => Math.abs(p.zBotAM - -0.5) < 1e-2)).toBe(true);
    // πρέκι: πάτος @2.1m (floor-relative, ΔΕΝ -0.5)
    const lintel = pieces.find((p) => Math.abs(p.zBotAM - 2.1) < 1e-2);
    expect(lintel).toBeDefined();
  });
});

// ── 2D τομή: yMin ─────────────────────────────────────────────────────────────

describe('γ2 2D — wallSection yMin από το base profile', () => {
  const plan = (bp?: WallBaseProfile): WallPlan => ({
    id: 'w', sx: 0, sy: 0, ex: 10, ey: 0, thicknessM: 0.25,
    baseY: bp ? bp.minBaseZmm * MM_TO_M : 0, topY: 2.85,
    baseProfile: bp,
  });

  it('κεκλιμένη attached βάση -500→0 → yMin αποτιμάται στο cut (mid → -0.25m)', () => {
    const bp = baseProfile([{ t0: 0, t1: 1, z0mm: -500, z1mm: 0, source: 'attached', hostId: 'h1' }]);
    const rect = wallSection(plan(bp), 'x', 5)!;
    expect(rect).not.toBeNull();
    expect(rect.yMin).toBeCloseTo(-0.25, 6);
  });

  it('flat (μη-attached) βάση → yMin = baseY (back-compat)', () => {
    const rect = wallSection(plan(), 'x', 5)!;
    expect(rect.yMin).toBeCloseTo(0, 6);
  });
});

// ── BOQ: ύψος/area = top − base ────────────────────────────────────────────────

describe('γ2 BOQ — computeWallGeometry top − base', () => {
  it('flat lowered base -500 → ύψος 3500mm → area 17.5m², volume 4.375m³', () => {
    const bp = baseProfile([{ t0: 0, t1: 1, z0mm: -500, z1mm: -500, source: 'attached', hostId: 'h1' }]);
    const geo = computeWallGeometry(makeWall().params, 'straight', undefined, undefined, bp);
    expect(geo.area).toBeCloseTo(17.5, 2);    // 5m × 3.5m
    expect(geo.volume).toBeCloseTo(4.375, 3); // × 0.25m
    expect(geo.bbox.min.z).toBeCloseTo(-0.5, 3); // bottom πέφτει στο θεμέλιο
    expect(geo.bbox.max.z).toBeCloseTo(3.0, 3);  // top nominal
  });

  it('χωρίς base profile → back-compat ύψος 3000mm → area 15m²', () => {
    const geo = computeWallGeometry(makeWall().params, 'straight');
    expect(geo.area).toBeCloseTo(15, 2);
  });
});
