/**
 * ADR-535 Φ1 — grip-3d-reshape-grips filter: only footprint reshape grips reach 3D.
 *
 * The 3D overlay surfaces ONLY the slab per-vertex / edge-midpoint grips (the gizmo
 * owns whole-entity move/rotate). The filter must keep grips with a `slabGripKind`
 * and `movesEntity:false`, and drop everything else (whole-entity, no-kind grips).
 */

import type { GripInfo } from '../../../hooks/grip-types';
import { reshapeGripsForSlab } from '../grip-3d-reshape-grips';

function vertexGrip(i: number): GripInfo {
  return {
    entityId: 's1', gripIndex: i, type: 'vertex',
    position: { x: i * 100, y: 0 }, movesEntity: false,
    slabGripKind: `slab-vertex-${i}`,
  };
}

function midpointGrip(i: number): GripInfo {
  return {
    entityId: 's1', gripIndex: 10 + i, type: 'midpoint',
    position: { x: i * 50, y: 50 }, movesEntity: false,
    edgeVertexIndices: [i, i + 1],
    slabGripKind: `slab-edge-midpoint-${i}`,
  };
}

describe('reshapeGripsForSlab', () => {
  it('keeps vertex + edge-midpoint slab grips in order', () => {
    const grips = [vertexGrip(0), midpointGrip(0), vertexGrip(1)];
    const out = reshapeGripsForSlab(grips);
    expect(out.map((g) => g.slabGripKind)).toEqual([
      'slab-vertex-0', 'slab-edge-midpoint-0', 'slab-vertex-1',
    ]);
  });

  it('drops whole-entity grips (movesEntity:true)', () => {
    const wholeEntity: GripInfo = {
      entityId: 's1', gripIndex: 99, type: 'center',
      position: { x: 0, y: 0 }, movesEntity: true, slabGripKind: 'slab-vertex-0',
    };
    expect(reshapeGripsForSlab([wholeEntity, vertexGrip(0)])).toHaveLength(1);
  });

  it('drops grips without a slabGripKind', () => {
    const plain: GripInfo = {
      entityId: 's1', gripIndex: 0, type: 'vertex',
      position: { x: 0, y: 0 }, movesEntity: false,
    };
    expect(reshapeGripsForSlab([plain])).toHaveLength(0);
  });
});
