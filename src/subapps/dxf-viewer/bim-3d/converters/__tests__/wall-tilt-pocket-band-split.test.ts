/**
 * ADR-404 ↔ ADR-401 (Phase 4.2) — **οριζόντιος διαχωρισμός pocket γερμένου τοίχου**
 * στην κάτω παρειά δοκαριού (7→9 κομμάτια).
 *
 * Σε **κεκλιμένο** attached τοίχο κάτω από **κατακόρυφο** δοκάρι, ο ομοιόμορφος shear
 * (ADR-404 Phase 4 `emit()`) γέρνει ΚΑΙ τη διαγώνια κοπή του δοκαριού → η ζώνη
 * `Hu→nominal` ξεφεύγει από την κατακόρυφη παρειά. `clipWallBandTopRegionsTilted`
 * σπάει κάθε **outside** περιοχή στο `Hu`:
 *   - κάτω prism (`base→Hu`, σταθερό footprint) — γέρνει ομοιόμορφα (watertight).
 *   - πάνω **loft band** (`Hu→nominal`): `bottomFootprint ≠ topFootprint` ώστε μετά
 *     τον shear η κοπή να ξαναγίνεται **κατακόρυφη** στο `host_real`.
 *
 * @see ../wall-top-clip.ts (clipWallBandTopRegionsTilted)
 * @see ../wall-piece-geometry.ts (buildWallLoftBandGeometry)
 */

import {
  clipWallBandTopRegions,
  clipWallBandTopRegionsTilted,
  computeTiltLoftCriticalTs,
  tiltCompensateWallTopClip,
  wallTopFaceCrossingBreakpoints,
  type WallTopClipContext,
  type WallTopLoftBand,
} from '../wall-top-clip';
import { buildWallLoftBandGeometry } from '../wall-piece-geometry';
import { wallTiltShearAt } from '../../../bim/geometry/wall-tilt';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import { beamHostInput } from '../../../bim/geometry/wall-host-plan-builder';
import { computeWallOpeningPieces } from '../wall-opening-pieces';
import type { HostFootprintInput, Pt2 } from '../../../bim/geometry/wall-host-plan-builder';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { BeamEntity } from '../../../bim/types/beam-types';

const TOL = 4;
const DEG = Math.PI / 180;

/**
 * Δοκάρι που διασχίζει τον τοίχο με **διαγώνια** αριστερή ακμή (1,2)→(2,-2),
 * **ψηλό** στον perp άξονα (y∈[-2,2]) ώστε να παραμένει επικαλυπτόμενο μετά το
 * un-shear (ρεαλιστικό crossing beam). Flat underside @2500mm.
 */
const ANGLED_HOST: HostFootprintInput = {
  hostId: 'h1', hostType: 'beam',
  footprint: [{ x: 1.0, y: 2 }, { x: 2.0, y: -2 }, { x: 10, y: -2 }, { x: 10, y: 2 }],
  undersideZmm: 2500,
};

/** host_real αριστερή ακμή (1,2)→(2,-2): κατεύθυνση (1,-4) → normal (4,1). */
const distToHostEdgeLine = (p: Pt2): number => (p.x - 1) * 4 + (p.y - 2) * 1;

/** Πλήρης band = παρειές τοίχου y=±0.125 πάνω από x∈[0,4]. */
const QUAD: Pt2[] = [
  { x: 0, y: 0.125 }, { x: 4, y: 0.125 }, { x: 4, y: -0.125 }, { x: 0, y: -0.125 },
];

function makeWall(tiltAngle?: number): WallEntity {
  const params = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 }, end: { x: 4, y: 0, z: 0 },
    height: 3000, thickness: 250,
    flip: false, baseBinding: 'storey-floor', topBinding: 'attached', baseOffset: 0, topOffset: 0,
    sceneUnits: 'm', attachTopToIds: ['h1'],
    ...(tiltAngle !== undefined ? { tilt: { angle: tiltAngle } } : {}),
  } as unknown as WallParams;
  return {
    id: 'w', type: 'wall', kind: 'straight', layerId: '0', params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as WallEntity;
}

function makeCtx(wall: WallEntity): WallTopClipContext {
  return {
    hosts: [ANGLED_HOST],
    nominalTopMm: 3000,
    breakpoints: wallTopFaceCrossingBreakpoints(wall.geometry, [ANGLED_HOST]),
  };
}

const same = (a: Pt2, b: Pt2): boolean => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
const sameRing = (a: readonly Pt2[], b: readonly Pt2[]): boolean =>
  a.length === b.length && a.every((p, i) => same(p, b[i]));

// ── Tilted: 9-piece split (κάτω prism + πάνω loft) ────────────────────────────

describe('ADR-404↔401 — clipWallBandTopRegionsTilted (tilted 9-piece)', () => {
  const angle = 20;
  const wall = makeWall(angle);
  // Όπως ο converter: αντιστάθμισε τα hosts (−shear(Hu)) ΠΡΙΝ το tilt clip.
  const comp = tiltCompensateWallTopClip(makeCtx(wall), wall.params, 0, wall.geometry);
  const result = clipWallBandTopRegionsTilted(QUAD, comp.hosts, 3000, 0, 0, wall.params);

  it('παράγει 1 loft band + 2 prisms (pocket @2.5 + lower-outside @2.5)', () => {
    expect(result.lofts).toHaveLength(1);
    expect(result.prisms).toHaveLength(2);
    for (const p of result.prisms) {
      expect(p.topLocalM.every((z) => Math.abs(z - 2.5) < 1e-3)).toBe(true);
      expect(p.baseLocalM.every((z) => Math.abs(z) < 1e-9)).toBe(true);
    }
  });

  it('loft: bottomFootprint ≠ topFootprint (η κοπή μετακινείται κατά −Δcut), ίδιο count', () => {
    const band = result.lofts[0];
    expect(band.bottomFootprint.length).toBe(band.topFootprint.length);
    expect(band.bottomLocalM.length).toBe(band.bottomFootprint.length);
    expect(band.bottomLocalM.every((z) => Math.abs(z - 2.5) < 1e-3)).toBe(true); // flat host → όλα @2.5
    expect(band.nominalLocalM).toBeCloseTo(3.0, TOL);
    // Τουλάχιστον μία κορυφή (η cut) διαφέρει.
    const differs = band.bottomFootprint.some((p, i) => !same(p, band.topFootprint[i]));
    expect(differs).toBe(true);
  });

  it('watertight: lower-outside prism footprint ≡ loft bottomFootprint', () => {
    const band = result.lofts[0];
    const lowerOutside = result.prisms.find((p) => sameRing(p.footprint, band.bottomFootprint));
    expect(lowerOutside).toBeDefined();
  });

  it('ΚΑΤΑΚΟΡΥΦΗ κοπή: cut κορυφές, μετά τον shear, πέφτουν στην ακμή του host_real', () => {
    const band = result.lofts[0];
    const sHu = wallTiltShearAt(wall.params, 2.5);
    const sNom = wallTiltShearAt(wall.params, 3.0);
    let cutVerts = 0;
    band.bottomFootprint.forEach((b, i) => {
      const t = band.topFootprint[i];
      if (same(b, t)) return; // wall-face vertex (fixed un-sheared) — όχι κοπή
      cutVerts++;
      // bottom@Hu + shear(Hu) ∈ host_real edge· top@nominal + shear(nominal) ∈ host_real edge
      // → η κοπή ζει στο ΙΔΙΟ κατακόρυφο επίπεδο (παρειά κατακόρυφου δοκαριού).
      expect(distToHostEdgeLine({ x: b.x + sHu.dx, y: b.y + sHu.dy })).toBeCloseTo(0, TOL);
      expect(distToHostEdgeLine({ x: t.x + sNom.dx, y: t.y + sNom.dy })).toBeCloseTo(0, TOL);
    });
    expect(cutVerts).toBeGreaterThan(0);
  });
});

// ── Flat (no tilt) → fallback στο vertical clip (μηδέν regression) ─────────────

describe('ADR-404↔401 — flat wall → fallback vertical clip', () => {
  it('lofts κενά + prisms ≡ clipWallBandTopRegions (single-footprint, gate)', () => {
    const flatWall = makeWall(); // χωρίς tilt
    const result = clipWallBandTopRegionsTilted(QUAD, [ANGLED_HOST], 3000, 0, 0, flatWall.params);
    expect(result.lofts).toHaveLength(0);
    expect(result.prisms).toEqual(clipWallBandTopRegions(QUAD, [ANGLED_HOST], 3000, 0, 0));
  });
});

// ── buildWallLoftBandGeometry ─────────────────────────────────────────────────

describe('ADR-404↔401 — buildWallLoftBandGeometry', () => {
  const validBand: WallTopLoftBand = {
    bottomFootprint: [{ x: 0, y: 0.1 }, { x: 1.2, y: 0.1 }, { x: 1.3, y: -0.1 }, { x: 0, y: -0.1 }],
    topFootprint: [{ x: 0, y: 0.1 }, { x: 1.1, y: 0.1 }, { x: 1.2, y: -0.1 }, { x: 0, y: -0.1 }],
    bottomLocalM: [2.5, 2.5, 2.5, 2.5], nominalLocalM: 3.0,
  };

  it('valid band → non-null, non-indexed (flat), count πολλαπλάσιο του 3', () => {
    const geo = buildWallLoftBandGeometry(validBand)!;
    expect(geo).not.toBeNull();
    expect(geo.getIndex()).toBeNull();
    expect(geo.getAttribute('position').count % 3).toBe(0);
  });

  it('|bottom| ≠ |top| → null', () => {
    expect(buildWallLoftBandGeometry({
      ...validBand, topFootprint: validBand.topFootprint.slice(0, 3),
    })).toBeNull();
  });

  it('|bottomLocalM| ≠ |bottom| → null', () => {
    expect(buildWallLoftBandGeometry({ ...validBand, bottomLocalM: [2.5, 2.5, 2.5] })).toBeNull();
  });

  it('μηδενικό ύψος ζώνης (nominal ≤ max(bottom)) → null', () => {
    expect(buildWallLoftBandGeometry({ ...validBand, nominalLocalM: 2.5 })).toBeNull();
  });

  it('sloped bottom (per-vertex bottomLocalM) → non-null, count%3==0', () => {
    const sloped: WallTopLoftBand = { ...validBand, bottomLocalM: [2.500, 2.501, 2.503, 2.500] };
    const geo = buildWallLoftBandGeometry(sloped)!;
    expect(geo).not.toBeNull();
    expect(geo.getAttribute('position').count % 3).toBe(0);
  });
});

// ── Sloped-underside host (ΚΕΚΛΙΜΕΝΟ δοκάρι) — exact real-world repro (Giorgio) ─────
// Δοκάρι με topElevation=3000 / topElevationEnd=3003.7 (κλίση 3.7mm) → undersideZmmAt set.
// ΠΡΙΝ το fix: το fallback gate παρέκαμπτε το band-split → lofts=0 → τριγωνικές τρύπες.

const MM_TO_M = 0.001;

function makeWallAt(
  start: Pt2, end: Pt2, tiltAngle: number, thickness: number,
): WallEntity {
  const params = {
    category: 'exterior',
    start: { x: start.x, y: start.y, z: 0 }, end: { x: end.x, y: end.y, z: 0 },
    height: 3000, thickness,
    flip: false, baseBinding: 'storey-floor', topBinding: 'attached', baseOffset: 0, topOffset: 0,
    sceneUnits: 'm', attachTopToIds: ['beam-sloped'],
    ...(tiltAngle !== 0 ? { tilt: { angle: tiltAngle } } : {}),
  } as unknown as WallParams;
  return {
    id: 'w', type: 'wall', kind: 'straight', layerId: '0', params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as WallEntity;
}

/** Δοκάρι όπως η production: beamHostInput → footprint + undersideZmmAt (sloped). */
function slopedBeamHost(): HostFootprintInput {
  const beam = {
    id: 'beam-sloped', type: 'beam', kind: 'straight', layerId: '0',
    params: {
      kind: 'straight',
      startPoint: { x: 10.1514, y: 7.3, z: 0 }, endPoint: { x: 10.1514, y: 11.0, z: 0 },
      width: 250, depth: 500, topElevation: 3000, topElevationEnd: 3003.7,
      zOffset: 0, supportType: 'simple', sceneUnits: 'm', offsetFromStorey: 0,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as BeamEntity;
  return beamHostInput(beam);
}

/** Τρέχει τη διαδρομή του converter (per-piece) και επιστρέφει lofts + eff host. */
function runConverterPath(wall: WallEntity): {
  lofts: WallTopLoftBand[];
  prisms: { footprint: readonly Pt2[]; topLocalM: readonly number[] }[];
  host: HostFootprintInput;
} {
  const host = slopedBeamHost();
  const ctx: WallTopClipContext = {
    hosts: [host], nominalTopMm: 3000,
    breakpoints: wallTopFaceCrossingBreakpoints(wall.geometry, [host]),
  };
  const tilted = wall.params.tilt !== undefined && wall.params.tilt.angle !== 0;
  const eff = tilted ? tiltCompensateWallTopClip(ctx, wall.params, 0, wall.geometry) : ctx;
  const clipWallTop = { breakpoints: eff.breakpoints, at: (): number => 3.0 };
  const pieces = computeWallOpeningPieces(wall, [], clipWallTop)!;
  const lofts: WallTopLoftBand[] = [];
  const prisms: { footprint: readonly Pt2[]; topLocalM: readonly number[] }[] = [];
  for (const pc of pieces) {
    const flatBase = Math.abs(pc.zBotAM - pc.zBotBM) < 1e-6;
    if (!pc.topFollowsProfile || !flatBase) continue;
    const quad = pc.quad.map((p) => ({ x: p.x, y: p.y }));
    const r = clipWallBandTopRegionsTilted(quad, eff.hosts, 3000, 0, pc.zBotAM, wall.params);
    lofts.push(...r.lofts);
    prisms.push(...r.prisms);
  }
  return { lofts, prisms, host: eff.hosts[0] };
}

describe('ADR-404↔401 — sloped-underside host (real-world repro)', () => {
  const wall = makeWallAt({ x: 10.9166, y: 7.8982 }, { x: 8.6577, y: 9.2837 }, -15, 200);
  const { lofts, prisms, host } = runConverterPath(wall);

  it('gate ΔΕΝ χτυπά πια → δημιουργούνται loft bands (lofts>0)', () => {
    expect(lofts.length).toBeGreaterThan(0);
  });

  it('lower prisms (base→Hu) ακολουθούν per-vertex την κεκλιμένη κάτω-παρειά', () => {
    // Τα prisms με κορυφή στη ζώνη Hu (~2.5) = base→Hu· η κορυφή τους = host underside per-vertex.
    const huPrisms = prisms.filter((p) => p.topLocalM.every((z) => z < 2.9));
    expect(huPrisms.length).toBeGreaterThan(0);
    for (const p of huPrisms) {
      p.footprint.forEach((pt, i) => {
        const expected = Math.min(3.0, host.undersideZmmAt!(pt) * MM_TO_M);
        expect(p.topLocalM[i]).toBeCloseTo(expected, TOL);
      });
    }
  });

  it('η κλίση όντως αποτυπώνεται (κάποια Hu-κορυφή ≠ 2.5)', () => {
    const huTops = prisms.filter((p) => p.topLocalM.every((z) => z < 2.9)).flatMap((p) => p.topLocalM);
    expect(huTops.some((z) => Math.abs(z - 2.5) > 1e-4)).toBe(true);
  });

  it('κάθε loft band βγάζει έγκυρη γεωμετρία (non-null, count%3==0)', () => {
    for (const band of lofts) {
      const geo = buildWallLoftBandGeometry(band)!;
      expect(geo).not.toBeNull();
      expect(geo.getAttribute('position').count % 3).toBe(0);
    }
  });

  it('μη-tilted τοίχος + sloped host → fallback (lofts:[])', () => {
    const flatWall = makeWallAt({ x: 10.9166, y: 7.8982 }, { x: 8.6577, y: 9.2837 }, 0, 200);
    const res = runConverterPath(flatWall);
    expect(res.lofts).toHaveLength(0);
  });
});

// ── ADR-404 Phase 4.3 — topology-aware sub-loft (η κοπή αλλάζει τοπολογία με το ύψος) ──

const shoelace = (pts: readonly Pt2[]): number => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
};

/** Επίπεδο ΛΟΞΟ δοκάρι που, με γερμένο τοίχο, παράγει αλλαγή τοπολογίας (split). */
function flatDiagBeamHost(): HostFootprintInput {
  const beam = {
    id: 'b', type: 'beam', kind: 'straight', layerId: '0', params: {
      kind: 'straight', startPoint: { x: 9.0, y: 6.5, z: 0 }, endPoint: { x: 13.5, y: 11.0, z: 0 },
      width: 250, depth: 500, topElevation: 3000, zOffset: 0, supportType: 'simple', sceneUnits: 'm', offsetFromStorey: 0,
    }, validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as BeamEntity;
  return beamHostInput(beam);
}

describe('ADR-404 Phase 4.3 — topology-aware sub-loft', () => {
  const wall = makeWallAt({ x: 8.0, y: 8.55 }, { x: 12.0, y: 8.55 }, -15, 540);
  const host = flatDiagBeamHost();
  const ctx: WallTopClipContext = {
    hosts: [host], nominalTopMm: 3000, breakpoints: wallTopFaceCrossingBreakpoints(wall.geometry, [host]),
  };
  const eff = tiltCompensateWallTopClip(ctx, wall.params, 0, wall.geometry);
  const clipWallTop = { breakpoints: eff.breakpoints, at: (): number => 3.0 };
  const pieces = computeWallOpeningPieces(wall, [], clipWallTop)!;
  const cHost = eff.hosts[0];
  const sNom = wallTiltShearAt(wall.params, 3.0);
  const sHu = wallTiltShearAt(wall.params, 2.5);
  const dCut: Pt2 = { x: sNom.dx - sHu.dx, y: sNom.dy - sHu.dy };

  // Μάζεψε ανά transition piece το clip result.
  const perPiece = pieces
    .filter((pc) => pc.topFollowsProfile && Math.abs(pc.zBotAM - pc.zBotBM) < 1e-6)
    .map((pc) => {
      const quad = pc.quad.map((p) => ({ x: p.x, y: p.y }));
      return { quad, r: clipWallBandTopRegionsTilted(quad, eff.hosts, 3000, 0, pc.zBotAM, wall.params) };
    });
  const transitions = perPiece.filter((p) => p.r.lofts.length > 0);

  it('υπάρχει piece με αλλαγή τοπολογίας (computeTiltLoftCriticalTs > 0)', () => {
    const anySplit = perPiece.some((p) => computeTiltLoftCriticalTs(p.quad, cHost.footprint, dCut).length > 0);
    expect(anySplit).toBe(true);
  });

  it('topology piece → πολλαπλά stacked slab lofts (όχι ένα single band)', () => {
    expect(transitions.length).toBeGreaterThan(0);
    const splitPiece = transitions.find((p) => computeTiltLoftCriticalTs(p.quad, cHost.footprint, dCut).length > 0);
    expect(splitPiece).toBeDefined();
    // criticalTs=k → (k+1) slabs × (≥1 polygon) → > 1 loft.
    expect(splitPiece!.r.lofts.length).toBeGreaterThan(1);
  });

  it('base→Hu watertight: pockets + lower-prisms (top≈Hu) καλύπτουν το quad', () => {
    for (const { quad, r } of transitions) {
      const quadArea = shoelace(quad);
      const huArea = r.prisms
        .filter((p) => p.topLocalM.every((z) => Math.abs(z - 2.5) < 1e-3))
        .reduce((s, p) => s + shoelace(p.footprint), 0);
      expect(huArea).toBeCloseTo(quadArea, 4); // καμία τρύπα/overlap στη ζώνη base→Hu
    }
  });

  it('slab stacking watertight: τα ύψη των slabs σχηματίζουν συνεχή αλυσίδα Hu→nominal', () => {
    for (const { r } of transitions) {
      // Συγκέντρωσε μοναδικά (bottom,top) ύψη· πρέπει να καλύπτουν [2.5, 3.0] χωρίς κενό.
      const tops = [...new Set(r.lofts.map((b) => Number(b.nominalLocalM.toFixed(6))))].sort((a, b) => a - b);
      expect(tops[tops.length - 1]).toBeCloseTo(3.0, 4); // η τελευταία φέτα φτάνει nominal
      // κάθε bottomLocalM ≥ 2.5−eps και ≤ nominal.
      for (const band of r.lofts) {
        for (const z of band.bottomLocalM) {
          expect(z).toBeGreaterThanOrEqual(2.5 - 1e-3);
          expect(z).toBeLessThanOrEqual(3.0 + 1e-3);
        }
      }
    }
  });

  it('κάθε slab loft → έγκυρη γεωμετρία', () => {
    for (const { r } of transitions) {
      for (const band of r.lofts) {
        const geo = buildWallLoftBandGeometry(band)!;
        expect(geo).not.toBeNull();
        expect(geo.getAttribute('position').count % 3).toBe(0);
      }
    }
  });

  it('computeTiltLoftCriticalTs: μηδενικό dCut (host ακίνητο) → κενό', () => {
    const sq: Pt2[] = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 0, y: 1 }];
    const h: Pt2[] = [{ x: 1, y: -1 }, { x: 2, y: -1 }, { x: 2, y: 2 }, { x: 1, y: 2 }];
    expect(computeTiltLoftCriticalTs(sq, h, { x: 0, y: 0 })).toEqual([]); // host δεν κινείται → ίδια τοπολογία
  });
});

// ── ADR-404 Phase 4.3 robustness — ΟΧΙ clipper failure στην degenerate runtime σκηνή ──
// Root cause (Giorgio, browser console): wall_c23277ef + beam_f704603a → το λεπτό δοκάρι
// (250) μόλις-μόλις γεφυρώνει τον λεπτό τοίχο (200) στο ύψος προσάρτησης (t≈0) → το
// polygon-clipping πετούσε «Unable to complete output ring» → safeDifference graceful
// fallback κενό → διαφθορά τοπολογίας (κενά + penetration). Με analytic half-plane peel
// (convexPolygonDifference) ο tilted clip ΔΕΝ αγγίζει πια το fragile clipper για κυρτό host.

describe('ADR-404 Phase 4.3 — robustness (exact runtime coords, μηδέν clipper failure)', () => {
  const isClipperFailure = (args: unknown[]): boolean =>
    args.some((a) => typeof a === 'string'
      && (a.includes('polygon difference failed') || a.includes('Unable to complete output ring')));

  it('runConverterPath στις ακριβείς coords → καμία SafePolygonBoolean αποτυχία + lofts>0 + watertight', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const wall = makeWallAt({ x: 10.9166, y: 7.8982 }, { x: 8.6577, y: 9.2837 }, -15, 200);
      const { lofts, prisms } = runConverterPath(wall);

      // (1) Κανένα clipper failure στη ροή (το πρώην root cause).
      const failures = [...errSpy.mock.calls, ...warnSpy.mock.calls].filter(isClipperFailure);
      expect(failures).toEqual([]);

      // (2) Δημιουργήθηκαν loft bands (όχι κενό λόγω fallback).
      expect(lofts.length).toBeGreaterThan(0);

      // (3) Κάθε band: 1:1 vertex correspondence + έγκυρη γεωμετρία.
      for (const band of lofts) {
        expect(band.topFootprint.length).toBe(band.bottomFootprint.length);
        expect(band.bottomLocalM.length).toBe(band.bottomFootprint.length);
        const geo = buildWallLoftBandGeometry(band)!;
        expect(geo).not.toBeNull();
        expect(geo.getAttribute('position').count % 3).toBe(0);
      }

      // (4) Watertight base→Hu: τα prisms με κορυφή στη ζώνη Hu καλύπτουν θετικό εμβαδόν.
      const huArea = prisms
        .filter((p) => p.topLocalM.every((z) => z < 2.9))
        .reduce((s, p) => s + shoelace(p.footprint), 0);
      expect(huArea).toBeGreaterThan(0);
    } finally {
      errSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
