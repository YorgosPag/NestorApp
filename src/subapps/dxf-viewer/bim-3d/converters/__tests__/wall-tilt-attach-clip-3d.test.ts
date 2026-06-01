/**
 * ADR-404 ↔ ADR-401 — **tilt-aware attach clip** (`tiltCompensateWallTopClip`).
 *
 * Bug (Giorgio 2026-06-01 + screenshot): attached τοίχος + δοκάρι που «χωνεύει» στην
 * κορυφή του (ADR-401 `clipWallBandTopRegions`). Όταν δίνεις κλίση, το ADR-404 Phase 4
 * shear μετατοπίζει την κορυφή του pocket κατά `wallTiltShearAt(params, Hu)` σε plan,
 * αλλά το δοκάρι μένει ακίνητο → η εγκοπή ξεμένει («τρύπα», το δοκάρι δεν χωνεύει).
 *
 * Fix: αντιστάθμισε **κάθε host footprint κατά `−shear(Hu)` ΠΡΙΝ το clip** ώστε μετά
 * τον τελικό shear η εγκοπή να ξανακάθεται κάτω από το δοκάρι. Τα ΥΨΗ (`undersideZmm`)
 * μένουν· μόνο η plan-θέση αντισταθμίζεται· τα breakpoints recompute-άρονται.
 *
 * @see ../wall-top-clip.ts (tiltCompensateWallTopClip + clipWallBandTopRegions)
 * @see ../../../bim/geometry/wall-tilt.ts (wallTiltShearAt — ίδιο SSoT με Phase 4 & 2Δ)
 */

import * as THREE from 'three';
import {
  tiltCompensateWallTopClip,
  wallTopFaceCrossingBreakpoints,
  clipWallBandTopRegions,
  type WallTopClipContext,
} from '../wall-top-clip';
import { wallToMesh } from '../BimToThreeConverter';
import { wallTiltShearAt } from '../../../bim/geometry/wall-tilt';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import type { HostFootprintInput, Pt2 } from '../../../bim/geometry/wall-host-plan-builder';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { WallTopProfile } from '../../../bim/geometry/wall-top-profile';

const TOL = 6;
const DEG = Math.PI / 180;

/**
 * Host footprint = δοκάρι που διασχίζει τον τοίχο, με **διαγώνια** αριστερή ακμή
 * (1.0,2)→(2.0,-2) ώστε η κοπή στις παρειές να εξαρτάται από το y (να φαίνεται η
 * μετατόπιση breakpoints), **ψηλό στον perp άξονα** (y∈[-2,2]) ώστε να παραμένει
 * επικαλυπτόμενο με τον τοίχο μετά το un-shear (ρεαλιστικό crossing beam). Flat
 * underside @2500mm.
 */
const ANGLED_HOST: HostFootprintInput = {
  hostId: 'h1', hostType: 'beam',
  footprint: [{ x: 1.0, y: 2 }, { x: 2.0, y: -2 }, { x: 10, y: -2 }, { x: 10, y: 2 }],
  undersideZmm: 2500,
};

/** Straight τοίχος κατά +x, thickness 250mm (παρειές y=±0.125), με optional tilt. */
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

// ── Helper: host footprint un-shear ───────────────────────────────────────────

describe('ADR-404↔401 — tiltCompensateWallTopClip (host un-shear)', () => {
  it('flat host: footprint μετατοπίζεται κατά −wallTiltShearAt(params, HuLocalM)', () => {
    const angle = 20;
    const wall = makeWall(angle);
    const comp = tiltCompensateWallTopClip(makeCtx(wall), wall.params, 0, wall.geometry);
    const shift = wallTiltShearAt(wall.params, 2.5); // Hu = 2500mm → 2.5m local
    expect(shift.dx).toBeCloseTo(0, TOL);            // +x wall → shear ⟂ run = plan-y
    expect(shift.dy).toBeCloseTo(2.5 * Math.tan(angle * DEG), TOL);
    const orig = ANGLED_HOST.footprint;
    comp.hosts[0].footprint.forEach((p, i) => {
      expect(p.x).toBeCloseTo(orig[i].x - shift.dx, TOL);
      expect(p.y).toBeCloseTo(orig[i].y - shift.dy, TOL);
    });
    // Τα ΥΨΗ μένουν ανέπαφα — μόνο η plan-θέση αντισταθμίζεται.
    expect(comp.hosts[0].undersideZmm).toBe(2500);
    expect(comp.nominalTopMm).toBe(3000);
  });

  it('breakpoints recompute-άρονται από τα μετατοπισμένα hosts (≠ un-shifted)', () => {
    const wall = makeWall(20);
    const ctx = makeCtx(wall);
    const comp = tiltCompensateWallTopClip(ctx, wall.params, 0, wall.geometry);
    // Η διαγώνια ακμή μετατοπίστηκε σε y → τέμνει τις παρειές σε άλλο x → άλλα fractions.
    expect(comp.breakpoints).not.toEqual(ctx.breakpoints);
    expect(comp.breakpoints).toEqual(wallTopFaceCrossingBreakpoints(wall.geometry, comp.hosts));
  });

  it('μετά την αντιστάθμιση + shear, το pocket προσγειώνεται κάτω από το ΑΡΧΙΚΟ host', () => {
    // Quad = παρειές τοίχου (y=±0.125), x∈[0,4].
    const quad: Pt2[] = [{ x: 0, y: 0.125 }, { x: 4, y: 0.125 }, { x: 4, y: -0.125 }, { x: 0, y: -0.125 }];
    const wall = makeWall(20);
    const comp = tiltCompensateWallTopClip(makeCtx(wall), wall.params, 0, wall.geometry);
    const shift = wallTiltShearAt(wall.params, 2.5);
    // Clip με το αντισταθμισμένο host → pocket region(s) @ top=2.5.
    const regions = clipWallBandTopRegions(quad, comp.hosts, 3000, 0, 0);
    const pocket = regions.filter((r) => r.topLocalM.every((z) => Math.abs(z - 2.5) < 1e-3));
    expect(pocket.length).toBeGreaterThan(0);
    // Κάθε κορυφή του pocket, μετά τον shear (+shift), πρέπει να είναι ΜΕΣΑ στο αρχικό host.
    for (const r of pocket) {
      for (const p of r.footprint) {
        const sx = p.x + shift.dx;
        const sy = p.y + shift.dy;
        expect(pointInPolygon({ x: sx, y: sy }, ANGLED_HOST.footprint)).toBe(true);
      }
    }
  });
});

// ── End-to-end μέσω wallToMesh ────────────────────────────────────────────────

/** Attached profile (nominal 3000, hasAttach → pieces path ενεργό). */
const ATTACH_PROFILE: WallTopProfile = {
  baseZmm: 0,
  segments: [{ t0: 0, t1: 1, z0mm: 3000, z1mm: 3000, source: 'absolute' }],
  maxTopZmm: 3000, minTopZmm: 3000, hasAttach: true, missingHostIds: [],
};

describe('ADR-404↔401 — wallToMesh attached+tilt (clip ακολουθεί την κλίση)', () => {
  function solidVertsAtTop(obj: THREE.Object3D, targetY: number): { x: number; y: number; z: number }[] {
    const out: { x: number; y: number; z: number }[] = [];
    obj.updateMatrixWorld(true);
    obj.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry || !mesh.userData['bimType']) return;
      const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        if (Math.abs(v.y - targetY) < 1e-2) out.push({ x: v.x, y: v.y, z: v.z });
      }
    });
    return out;
  }

  it('attached+tilt → group χτίζεται· pocket κορυφή (worldY≈2.5) κάτω από το δοκάρι (worldX∈[host x])', () => {
    const wall = makeWall(20);
    const mesh = wallToMesh(wall, [], 0, 'L1', 0, ATTACH_PROFILE, undefined, makeCtx(wall))!;
    expect((mesh as THREE.Group).isGroup).toBe(true);
    // Οι κορυφές της εγκοπής βρίσκονται στο ύψος του host underside (2.5m).
    const topV = solidVertsAtTop(mesh, 2.5);
    expect(topV.length).toBeGreaterThan(0);
    // worldX της εγκοπής εντός του host x-εύρους (~[1.0,10]) — το δοκάρι χωνεύει.
    for (const v of topV) expect(v.x).toBeGreaterThan(0.9);
  });

  it('flat attached (no tilt) → χτίζεται κανονικά (regression — clip αμετάβλητο)', () => {
    const wall = makeWall();
    const mesh = wallToMesh(wall, [], 0, 'L1', 0, ATTACH_PROFILE, undefined, makeCtx(wall))!;
    expect((mesh as THREE.Group).isGroup).toBe(true);
    expect(solidVertsAtTop(mesh, 2.5).length).toBeGreaterThan(0);
  });
});

// ── Utility ───────────────────────────────────────────────────────────────────

/** Ray-casting point-in-polygon (inclusive-ish· tolerant στα όρια μέσω μικρού bias). */
function pointInPolygon(pt: Pt2, poly: readonly Pt2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect = (yi > pt.y) !== (yj > pt.y)
      && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
