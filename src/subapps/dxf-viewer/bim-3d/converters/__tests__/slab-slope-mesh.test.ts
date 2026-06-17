/**
 * ADR-401 Phase E2 / ADR-369 §9 Q7 — tilted slab 3D mesh (shear).
 *
 * Ελέγχει ότι το `slabToMesh` γέρνει την επίπεδη extruded πλάκα κατά το slope
 * επίπεδο, καταναλώνοντας το `slabSlopeOffsetZmm` SSoT:
 *   - flat (box) → επίπεδη πάνω παρειά (no-op fast-path)
 *   - tilted → per-vertex shear === slope plane (vs flat baseline)
 *   - σταθερό πάχος (top & bottom γέρνουν ίσα)
 *   - wall-consistency: κάτω παρειά === `slabUndersideZmmAt` (ο τοίχος εφάπτεται)
 */

import * as THREE from 'three';
import { slabToMesh } from '../BimToThreeConverter';
import { slabSlopeOffsetZmm, slabUndersideZmmAt } from '../../../bim/geometry/slab-slope';
import type { SlabEntity, SlabParams } from '../../../bim/types/slab-types';

function asMesh(o: THREE.Object3D | null): THREE.Mesh {
  if (!(o instanceof THREE.Mesh)) throw new Error('expected a THREE.Mesh');
  return o;
}

const MM_TO_M = 0.001;

/** 10×10 (canvas units) τετράγωνο, γωνία στο (0,0) → AABB center (5,5). */
const SQUARE = {
  vertices: [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 10, y: 10, z: 0 },
    { x: 0, y: 10, z: 0 },
  ],
};

function makeSlab(over: Partial<SlabParams> = {}): SlabEntity {
  const params: SlabParams = {
    kind: 'roof',
    outline: SQUARE,
    levelElevation: 3000,
    thickness: 200,
    geometryType: 'box',
    sceneUnits: 'm',
    ...over,
  } as SlabParams;
  return {
    id: 's', type: 'slab', kind: params.kind, ifcType: 'IfcSlab', layerId: '0', params,
    geometry: {} as SlabEntity['geometry'],
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as SlabEntity;
}

function positions(mesh: { geometry: { getAttribute(n: string): { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number } } }) {
  const p = mesh.geometry.getAttribute('position');
  const out: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < p.count; i++) out.push({ x: p.getX(i), y: p.getY(i), z: p.getZ(i) });
  return out;
}

const TOL = 6;

describe('slabToMesh — flat (box) back-compat', () => {
  it('επίπεδη πλάκα → πάνω παρειά οριζόντια (σταθερό geo Y)', () => {
    const mesh = asMesh(slabToMesh(makeSlab()));
    expect(mesh).not.toBeNull();
    const ys = positions(mesh).map((p) => p.y);
    const top = Math.max(...ys);
    const bot = Math.min(...ys);
    // ExtrudeGeometry: bottom @0, top @thicknessM=0.2 (πριν το mesh.position.y).
    expect(bot).toBeCloseTo(0, TOL);
    expect(top).toBeCloseTo(0.2, TOL);
  });
});

describe('slabToMesh — tilted (shear === slope plane)', () => {
  const slope = { direction: 0, angle: 10, pivotEdge: 'center' as const };
  const tiltedParams = { geometryType: 'tilted' as const, slope };

  it('per-vertex shear ταιριάζει ακριβώς με το slabSlopeOffsetZmm SSoT', () => {
    const flat = positions(asMesh(slabToMesh(makeSlab())));
    const tilted = positions(asMesh(slabToMesh(makeSlab(tiltedParams))));
    expect(tilted.length).toBe(flat.length);
    for (let i = 0; i < flat.length; i++) {
      // X/Z αμετάβλητα
      expect(tilted[i].x).toBeCloseTo(flat[i].x, TOL);
      expect(tilted[i].z).toBeCloseTo(flat[i].z, TOL);
      // Y = flatY + slopeOffset(plan-point)·MM_TO_M· plan-point = {x, y:−z}
      const offsetM = slabSlopeOffsetZmm(
        makeSlab(tiltedParams).params,
        { x: flat[i].x, y: -flat[i].z },
      ) * MM_TO_M;
      expect(tilted[i].y).toBeCloseTo(flat[i].y + offsetM, TOL);
    }
  });

  it('σταθερό πάχος — top/bottom face γέρνουν ίσα (vertical extent 0.2 παντού)', () => {
    const tilted = positions(asMesh(slabToMesh(makeSlab(tiltedParams))));
    // group ανά (x,z) στήλη
    const byCol = new Map<string, number[]>();
    for (const p of tilted) {
      const k = `${p.x.toFixed(3)}|${p.z.toFixed(3)}`;
      (byCol.get(k) ?? byCol.set(k, []).get(k)!).push(p.y);
    }
    for (const ys of byCol.values()) {
      if (ys.length < 2) continue;
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.2, TOL);
    }
  });

  it('wall-consistency: κάτω παρειά (geo + position.y) === slabUndersideZmmAt·MM_TO_M', () => {
    const params = makeSlab(tiltedParams).params;
    const positionY = (params.levelElevation - params.thickness) * MM_TO_M; // mesh.position.y
    const tilted = positions(asMesh(slabToMesh(makeSlab(tiltedParams))));
    // κάτω παρειά = vertices με το χαμηλότερο flat-Y component (geoY − offset ≈ 0)
    for (const p of tilted) {
      const offsetM = slabSlopeOffsetZmm(params, { x: p.x, y: -p.z }) * MM_TO_M;
      const flatY = p.y - offsetM; // 0 (bottom) ή 0.2 (top)
      if (Math.abs(flatY) < 1e-4) {
        const worldUnderside = p.y + positionY;
        const expected = slabUndersideZmmAt(params, { x: p.x, y: -p.z }) * MM_TO_M;
        expect(worldUnderside).toBeCloseTo(expected, TOL);
      }
    }
  });
});
