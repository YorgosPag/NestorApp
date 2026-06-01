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
  tiltCompensateWallTopClip,
  wallTopFaceCrossingBreakpoints,
  type WallTopClipContext,
  type WallTopLoftBand,
} from '../wall-top-clip';
import { buildWallLoftBandGeometry } from '../wall-piece-geometry';
import { wallTiltShearAt } from '../../../bim/geometry/wall-tilt';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import type { HostFootprintInput, Pt2 } from '../../../bim/geometry/wall-host-plan-builder';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';

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
    expect(band.huLocalM).toBeCloseTo(2.5, TOL);
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
    huLocalM: 2.5, nominalLocalM: 3.0,
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

  it('μηδενικό ύψος ζώνης (nominal ≤ hu) → null', () => {
    expect(buildWallLoftBandGeometry({ ...validBand, nominalLocalM: 2.5 })).toBeNull();
  });
});
