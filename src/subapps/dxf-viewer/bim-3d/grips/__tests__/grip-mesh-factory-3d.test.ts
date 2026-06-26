/**
 * ADR-535 Φ1/Φ2 — grip-mesh-factory-3d: GripInfo[] → world-placed cubes + hitboxes.
 *
 * Locks the coordinate mapping (DXF plan-mm + PER-GRIP top-surface elevation (mm) → world
 * via the `dxfPlanToWorld` SSoT: world.x = x_mm·0.001, world.y = elevMm·0.001,
 * world.z = −y_mm·0.001) and the hitbox→gripIndex map (one hitbox per grip, keyed by the
 * stable grip index). Φ2: each grip rides its OWN elevation (tilted-slab slope plane).
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
    const set = createGrip3DMeshes([grip(0, 1000, 2000)], () => 3000); // 3000mm → 3m top
    expect(set.parts).toHaveLength(1);
    const w = set.parts[0].world;
    expect(w.x).toBeCloseTo(1, 6); // 1000mm → 1m east
    expect(w.y).toBeCloseTo(3, 6); // slab top
    expect(w.z).toBeCloseTo(-2, 6); // 2000mm north → −2m world z
    set.dispose();
  });

  it('rides a PER-GRIP elevation (tilted slab → each vertex its own Y, Φ2)', () => {
    // A slope: the elevation resolver returns a different mm per grip plan-X.
    const elevMmFor = (g: GripInfo): number => 3000 + g.position.x; // +1mm per mm east
    const set = createGrip3DMeshes([grip(0, 0, 0), grip(1, 2000, 0)], elevMmFor);
    expect(set.parts[0].world.y).toBeCloseTo(3, 6); // 3000mm
    expect(set.parts[1].world.y).toBeCloseTo(5, 6); // 3000+2000mm = 5m → grips NOT coplanar
    set.dispose();
  });

  it('maps every hitbox back to its grip index', () => {
    const set = createGrip3DMeshes([grip(0, 0, 0), grip(5, 500, 0)], () => 0);
    expect(set.hitboxToIndex.size).toBe(2);
    for (const part of set.parts) {
      expect(set.hitboxToIndex.get(part.hitbox)).toBe(part.gripIndex);
    }
    expect([...set.hitboxToIndex.values()].sort((a, b) => a - b)).toEqual([0, 5]);
    set.dispose();
  });

  it('builds an empty root for no grips', () => {
    const set = createGrip3DMeshes([], () => 0);
    expect(set.parts).toHaveLength(0);
    expect(set.root).toBeInstanceOf(THREE.Group);
    set.dispose();
  });
});
