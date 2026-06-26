/**
 * ADR-535 Φ1 — grip-mesh-factory-3d: GripInfo[] → world-placed squares + hitboxes.
 *
 * Locks the coordinate mapping (DXF plan-mm + slab-top elevation → world via the
 * `dxfPlanToWorld` SSoT: world.x = x_mm·0.001, world.y = elev, world.z = −y_mm·0.001)
 * and the hitbox→gripIndex map (one hitbox per grip, keyed by the stable grip index).
 */

import * as THREE from 'three';
import type { GripInfo } from '../../../hooks/grip-types';
import { createGrip3DMeshes } from '../grip-mesh-factory-3d';

function grip(index: number, x: number, y: number): GripInfo {
  return {
    entityId: 's1', gripIndex: index, type: 'vertex',
    position: { x, y }, movesEntity: false, slabGripKind: `slab-vertex-${index}`,
  };
}

describe('createGrip3DMeshes', () => {
  it('places each grip at the DXF→world position on the slab-top plane', () => {
    const planeWorldY = 3; // 3m slab top
    const set = createGrip3DMeshes([grip(0, 1000, 2000)], planeWorldY);
    expect(set.parts).toHaveLength(1);
    const w = set.parts[0].world;
    expect(w.x).toBeCloseTo(1, 6); // 1000mm → 1m east
    expect(w.y).toBeCloseTo(3, 6); // slab top
    expect(w.z).toBeCloseTo(-2, 6); // 2000mm north → −2m world z
    set.dispose();
  });

  it('maps every hitbox back to its grip index', () => {
    const set = createGrip3DMeshes([grip(0, 0, 0), grip(5, 500, 0)], 0);
    expect(set.hitboxToIndex.size).toBe(2);
    for (const part of set.parts) {
      expect(set.hitboxToIndex.get(part.hitbox)).toBe(part.gripIndex);
    }
    expect([...set.hitboxToIndex.values()].sort((a, b) => a - b)).toEqual([0, 5]);
    set.dispose();
  });

  it('builds an empty root for no grips', () => {
    const set = createGrip3DMeshes([], 0);
    expect(set.parts).toHaveLength(0);
    expect(set.root).toBeInstanceOf(THREE.Group);
    set.dispose();
  });
});
