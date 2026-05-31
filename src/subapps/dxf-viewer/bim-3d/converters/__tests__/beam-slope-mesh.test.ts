/**
 * ADR-401 Phase E/(β) — tilted beam 3D mesh (shear).
 *
 * Ελέγχει ότι το `beamToMesh` γέρνει την επίπεδη extruded δοκό κατά μήκος του
 * άξονα, καταναλώνοντας το `beamSlopeOffsetZmm` SSoT:
 *   - flat → οριζόντια πάνω παρειά (no-op fast-path)
 *   - tilted → per-vertex shear === slope plane (vs flat baseline)
 *   - σταθερό βάθος (top & bottom γέρνουν ίσα)
 *   - wall-consistency: κάτω παρειά === `beamUndersideZmmAt` (ο τοίχος εφάπτεται)
 */

import { beamToMesh } from '../BimToThreeConverter';
import { beamSlopeOffsetZmm, beamUndersideZmmAt } from '../../../bim/geometry/beam-slope';
import { computeBeamGeometry } from '../../../bim/geometry/beam-geometry';
import type { BeamEntity, BeamParams } from '../../../bim/types/beam-types';

const MM_TO_M = 0.001;
const TOL = 6;

function makeBeam(over: Partial<BeamParams> = {}): BeamEntity {
  const params: BeamParams = {
    kind: 'straight',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 1000, y: 0, z: 0 },
    width: 250,
    depth: 400,
    topElevation: 3000,
    sceneUnits: 'mm',
    ...over,
  } as BeamParams;
  return {
    id: 'b',
    type: 'beam',
    kind: params.kind,
    ifcType: 'IfcBeam',
    layerId: '0',
    params,
    geometry: computeBeamGeometry(params),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as BeamEntity;
}

function positions(mesh: { geometry: { getAttribute(n: string): { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number } } }) {
  const p = mesh.geometry.getAttribute('position');
  const out: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < p.count; i++) out.push({ x: p.getX(i), y: p.getY(i), z: p.getZ(i) });
  return out;
}

describe('beamToMesh — flat back-compat', () => {
  it('οριζόντια δοκός → πάνω παρειά οριζόντια (σταθερό geo Y)', () => {
    const mesh = beamToMesh(makeBeam())!;
    expect(mesh).not.toBeNull();
    const ys = positions(mesh).map((p) => p.y);
    // ExtrudeGeometry: bottom @0, top @depthM=0.4 (πριν το mesh.position.y).
    expect(Math.min(...ys)).toBeCloseTo(0, TOL);
    expect(Math.max(...ys)).toBeCloseTo(0.4, TOL);
  });
});

describe('beamToMesh — tilted (shear === slope plane)', () => {
  const tilted: Partial<BeamParams> = { topElevationEnd: 3500 }; // Δ = 500mm

  it('per-vertex shear ταιριάζει με το beamSlopeOffsetZmm SSoT', () => {
    const flat = positions(beamToMesh(makeBeam())!);
    const tilt = positions(beamToMesh(makeBeam(tilted))!);
    expect(tilt.length).toBe(flat.length);
    const params = makeBeam(tilted).params;
    for (let i = 0; i < flat.length; i++) {
      expect(tilt[i].x).toBeCloseTo(flat[i].x, TOL);
      expect(tilt[i].z).toBeCloseTo(flat[i].z, TOL);
      // plan-point = {x, y:−z}· offset(mm)·MM_TO_M.
      const offsetM = beamSlopeOffsetZmm(params, { x: flat[i].x, y: -flat[i].z }) * MM_TO_M;
      expect(tilt[i].y).toBeCloseTo(flat[i].y + offsetM, TOL);
    }
  });

  it('σταθερό βάθος — top/bottom γέρνουν ίσα (vertical extent 0.4 παντού)', () => {
    const tilt = positions(beamToMesh(makeBeam(tilted))!);
    const byCol = new Map<string, number[]>();
    for (const p of tilt) {
      const k = `${p.x.toFixed(3)}|${p.z.toFixed(3)}`;
      (byCol.get(k) ?? byCol.set(k, []).get(k)!).push(p.y);
    }
    for (const ys of byCol.values()) {
      if (ys.length < 2) continue;
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.4, TOL);
    }
  });

  it('wall-consistency: κάτω παρειά (geo + position.y) === beamUndersideZmmAt·MM_TO_M', () => {
    const params = makeBeam(tilted).params;
    // mesh.position.y = (topElevation + zOffset − depth)·MM_TO_M (start nominal).
    const positionY = (params.topElevation + (params.zOffset ?? 0) - params.depth) * MM_TO_M;
    const tilt = positions(beamToMesh(makeBeam(tilted))!);
    for (const p of tilt) {
      const offsetM = beamSlopeOffsetZmm(params, { x: p.x, y: -p.z }) * MM_TO_M;
      const flatY = p.y - offsetM; // 0 (bottom) ή 0.4 (top)
      if (Math.abs(flatY) < 1e-4) {
        const worldUnderside = p.y + positionY;
        const expected = beamUndersideZmmAt(params, { x: p.x, y: -p.z }) * MM_TO_M;
        expect(worldUnderside).toBeCloseTo(expected, TOL);
      }
    }
  });
});
