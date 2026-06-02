/**
 * ADR-407 — railingToMesh: 3D solid of a path-based railing.
 *
 * Pins units-safety (canvas XY → m via sceneToM; mm sizes via MM_TO_M),
 * InstancedMesh balusters (one draw call), post boxes, and swept rail tubes.
 */

import * as THREE from 'three';
import { railingToMesh } from '../railing-to-three';
import {
  buildDefaultRailingParams,
  buildRailingEntity,
} from '../../../hooks/drawing/railing-completion';
import type { RailingEntity } from '../../../bim/types/railing-types';
import type { SceneUnits } from '../../../utils/scene-units';

function railing(
  start: { x: number; y: number },
  end: { x: number; y: number },
  units: SceneUnits = 'mm',
): RailingEntity {
  const params = buildDefaultRailingParams(start, end, {}, units);
  const res = buildRailingEntity(params, '0');
  if (!res.ok) throw new Error('test railing invalid');
  return res.entity;
}

describe('railingToMesh', () => {
  it('returns a group tagged as railing with posts + balusters + rail', () => {
    const group = railingToMesh(railing({ x: 0, y: 0 }, { x: 2000, y: 0 }), 0, '0', 0);
    expect(group).not.toBeNull();
    expect((group as THREE.Group).userData['bimType']).toBe('railing');

    const components = new Set<string>();
    (group as THREE.Group).traverse((o) => {
      const c = o.userData['railingComponent'];
      if (typeof c === 'string') components.add(c);
    });
    expect(components.has('post')).toBe(true);
    expect(components.has('baluster')).toBe(true);
    expect(components.has('rail')).toBe(true);
  });

  it('builds balusters as a single InstancedMesh (one draw call, enterprise)', () => {
    const group = railingToMesh(railing({ x: 0, y: 0 }, { x: 3000, y: 0 }), 0, '0', 0) as THREE.Group;
    const instanced = group.children.find(
      (c): c is THREE.InstancedMesh =>
        c instanceof THREE.InstancedMesh && c.userData['railingComponent'] === 'baluster',
    );
    expect(instanced).toBeDefined();
    expect((instanced as THREE.InstancedMesh).count).toBeGreaterThan(0);
  });

  it('places members at the storey datum + floor elevation (world metres)', () => {
    // floorElevationMm = 3000 → datum 3.0m; posts rise from there.
    const group = railingToMesh(railing({ x: 0, y: 0 }, { x: 1000, y: 0 }), 3000, '0', 0) as THREE.Group;
    const post = group.children.find(
      (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.userData['railingComponent'] === 'post',
    ) as THREE.Mesh;
    post.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(post);
    // Post base ≈ 3.0m, top ≈ 3.0 + 1.0 (1000mm guardrail) = 4.0m.
    expect(box.min.y).toBeCloseTo(3.0, 1);
    expect(box.max.y).toBeCloseTo(4.0, 1);
  });

  it('is units-safe: a meter-scene railing is the same physical size as mm', () => {
    const mmGroup = railingToMesh(railing({ x: 0, y: 0 }, { x: 2000, y: 0 }, 'mm'), 0, '0', 0) as THREE.Group;
    // Same 2m span expressed in metres (scene units 'm' → coords ÷1000).
    const mGroup = railingToMesh(railing({ x: 0, y: 0 }, { x: 2, y: 0 }, 'm'), 0, '0', 0) as THREE.Group;
    const widthOf = (g: THREE.Group): number => {
      g.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()).x;
    };
    expect(widthOf(mGroup)).toBeCloseTo(widthOf(mmGroup), 2);
  });

  it('returns null for a degenerate (sub-2-point) path', () => {
    const r = railing({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const bad = { ...r, geometry: { ...r.geometry, resolvedPath: [] } } as RailingEntity;
    expect(railingToMesh(bad, 0, '0', 0)).toBeNull();
  });
});
